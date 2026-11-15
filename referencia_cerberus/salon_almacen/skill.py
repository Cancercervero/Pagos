"""
salon_almacen/skill.py — Cerebro del agente de almacén para salón.

Flujos:
  1. FOTO  → ask_llm_vision() → identificar producto → confirmar → salida_stock()
  2. TEXTO → ask_llm_lite()   → detectar intención  → ejecutar operación
  3. Roles → estilista / admin / dueña con permisos distintos
"""
import json
import os
import re
import tempfile
import logging

logger = logging.getLogger("SalonAlmacen")

_BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# ── Vocab específico de salón ────────────────────────────────────────────────
_SINONIMOS = {
    "tinte":      ["color", "coloración", "coloracion", "tintura"],
    "oxidante":   ["agua oxigenada", "peroxido", "peróxido", "developer", "revelador"],
    "keratina":   ["keratin", "alisado", "tratamiento alisante"],
    "toxico":     ["tónico", "tonico"],
    "ampolleta":  ["ampolleta", "ampula", "ampollas"],
    "shampoo":    ["champú", "champu", "shampu"],
    "mascarilla": ["mask", "masque", "tratamiento"],
    "papel_aluminio": ["papel", "foil", "aluminio"],
}

_UNIDADES_SALON = {
    "ml": ["ml", "mililitros", "mililitro"],
    "g":  ["gr", "gramos", "gramo", "g"],
    "pza": ["pieza", "piezas", "pza", "unidad", "unidades", "tubos", "tubo"],
    "caja": ["caja", "cajas", "box"],
    "sobre": ["sobre", "sobres", "sachet"],
}

_PROMPT_VISION = """Eres un asistente de inventario para un salón de belleza.
Analiza esta imagen e identifica el producto de salon que aparece.
Responde SOLO con JSON válido, sin texto adicional:
{
  "nombre": "nombre del producto (marca + tipo)",
  "marca": "marca si es visible",
  "tipo": "tinte|oxidante|keratina|shampoo|mascarilla|ampolleta|otro",
  "cantidad": numero_o_null,
  "unidad": "ml|g|pza|caja|sobre",
  "confianza": "alta|media|baja"
}
Si no puedes identificar el producto con certeza, pon confianza "baja"."""

_PROMPT_INTENT = """Detecta la intención del mensaje de un empleado de salón.
Responde SOLO con JSON: {"intent": "X", "producto": "Y", "cantidad": N, "unidad": "Z"}
Intents posibles:
  use        → usó/aplicó/gastó un producto (salida de stock)
  entrada    → llegó/compraron/recibieron producto
  consulta   → pregunta por stock o precio
  alerta     → quiere ver qué está por agotarse
  pedido     → quiere lista de lo que hay que pedir
  reporte    → resumen/flujo/ventas
  ayuda      → no se entiende
Mensaje: """


def _llm_vision(image_path: str) -> dict:
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_vision
        raw = ask_llm_vision(_PROMPT_VISION, image_path)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.error(f"[SalonVision] {e}")
    return {}


def _llm_intent(texto: str) -> dict:
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        raw = ask_llm_lite(_PROMPT_INTENT + texto)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.error(f"[SalonIntent] {e}")
    return {"intent": "ayuda"}


def _normalizar_producto(nombre: str, db) -> dict | None:
    """Busca producto en DB con fuzzy matching por sinónimos."""
    nombre_lower = nombre.lower()
    productos = db.listar_productos()
    for prod in productos:
        if prod["name"].lower() in nombre_lower or nombre_lower in prod["name"].lower():
            return prod
    for prod in productos:
        for canon, variantes in _SINONIMOS.items():
            if any(v in nombre_lower for v in variantes) and canon in prod["name"].lower():
                return prod
    return None


def _check_permiso(rol: str, accion: str, config: dict) -> bool:
    permisos = config.get("permisos", {})
    return accion in permisos.get(rol, [])


# ── API pública ──────────────────────────────────────────────────────────────

def procesar_foto(image_path: str, user_id: str, config: dict,
                  db_path: str = None, photo_ref: str = None) -> dict:
    """
    Analiza foto de producto y retorna propuesta de salida pendiente de confirmación.
    El bot debe guardar el pending y preguntar al usuario.
    Retorna: {"ok": bool, "mensaje": str, "pending": dict|None}
    """
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    rol = config.get("roles", {}).get(str(user_id), "estilista")
    if not _check_permiso(rol, "reportar_uso", config):
        return {"ok": False, "mensaje": "⛔ Sin permiso para reportar uso.", "pending": None}

    vision = _llm_vision(image_path)
    if not vision or vision.get("confianza") == "baja":
        return {
            "ok": False,
            "mensaje": "🤔 No pude identificar el producto con certeza.\nManda el nombre por texto: *usé [cantidad] de [producto]*",
            "pending": None,
        }

    prod = _normalizar_producto(vision.get("nombre", ""), db)
    cantidad = vision.get("cantidad") or 1
    unidad = vision.get("unidad", "pza")

    if not prod:
        return {
            "ok": False,
            "mensaje": (
                f"🔍 Veo: *{vision.get('nombre')}* ({vision.get('marca','')})\n"
                f"No está en el inventario. ¿Quieres registrarlo o corriges el nombre?"
            ),
            "pending": None,
        }

    stock_actual = db.get_stock_actual(prod["id"])
    pending = {
        "part_id": prod["id"],
        "nombre":  prod["name"],
        "cantidad": cantidad,
        "unidad":  unidad,
        "stock_actual": stock_actual,
        "photo_ref": photo_ref,
    }
    mensaje = (
        f"📸 Identifiqué:\n"
        f"  *{prod['name']}*\n"
        f"  Cantidad visible: {cantidad} {unidad}\n"
        f"  Stock actual: {stock_actual:.1f} {prod['unit']}\n\n"
        f"¿Confirmas que usaste esto? ✅ /si  ❌ /no"
    )
    return {"ok": True, "mensaje": mensaje, "pending": pending}


def confirmar_uso(pending: dict, config: dict = None, db_path: str = None) -> str:
    """Ejecuta salida de stock tras confirmación del usuario."""
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()

    if pending["cantidad"] > pending["stock_actual"]:
        return f"⚠️ Stock insuficiente. Solo hay {pending['stock_actual']:.1f} {pending['unidad']}."

    tx_id = db.salida_stock(pending["part_id"], pending["cantidad"], precio_venta=0, notas="Uso en servicio (foto)")
    if pending.get("photo_ref") and tx_id:
        db.update_tx_photo(tx_id, pending["photo_ref"])
    stock_nuevo = db.get_stock_actual(pending["part_id"])
    prod = db.get_producto(str(pending["part_id"]))
    min_stock = prod.get("min_stock", 5) if prod else 5
    alerta = ""
    if stock_nuevo < min_stock:
        alerta = " ⚠️ *BAJO MÍNIMO — Aldo generando orden*"
        if config:
            try:
                from host_engine.products.salon_almacen.agents.aldo import generar_orden
                generar_orden(salon_nombre=config.get("salon_nombre", "Salón"), db_path=db_path)
            except Exception:
                pass
    return f"✅ Registrado: -{pending['cantidad']} {pending['unidad']} de *{pending['nombre']}*\nStock restante: {stock_nuevo:.1f}{alerta}"


def procesar_texto(texto: str, user_id: str, config: dict, db_path: str = None) -> str:
    """
    Procesa mensaje de texto. Retorna respuesta lista para Telegram.
    """
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    rol = config.get("roles", {}).get(str(user_id), "estilista")
    intent_data = _llm_intent(texto)
    intent = intent_data.get("intent", "ayuda")

    # ── Reportar uso (estilista/admin/dueña) ────────────────────────────────
    if intent == "use":
        if not _check_permiso(rol, "reportar_uso", config):
            return "⛔ Sin permiso."
        nombre = intent_data.get("producto", "")
        cantidad = float(intent_data.get("cantidad") or 1)
        prod = _normalizar_producto(nombre, db)
        if not prod:
            return f"⚠️ No encontré *{nombre}* en inventario. Verifica el nombre."
        stock_actual = db.get_stock_actual(prod["id"])
        if cantidad > stock_actual:
            return f"⚠️ Stock insuficiente de *{prod['name']}*. Disponible: {stock_actual:.1f} {prod['unit']}"
        db.salida_stock(prod["id"], cantidad, precio_venta=0, notas=f"Uso en servicio — {rol}")
        stock_nuevo = db.get_stock_actual(prod["id"])
        alerta = " ⚠️ *BAJO MÍNIMO*" if stock_nuevo < prod.get("min_stock", 0) else ""
        return f"✅ -{cantidad:.0f} {prod['unit']} de *{prod['name']}*\nStock: {stock_nuevo:.1f}{alerta}"

    # ── Entrada de stock (admin/dueña) ───────────────────────────────────────
    if intent == "entrada":
        if not _check_permiso(rol, "entrada_stock", config):
            return "⛔ Solo admin puede registrar entradas."
        nombre = intent_data.get("producto", "")
        cantidad = float(intent_data.get("cantidad") or 1)
        prod = _normalizar_producto(nombre, db)
        if not prod:
            return f"⚠️ *{nombre}* no está registrado. Regístralo primero."
        provs = db.listar_proveedores()
        prov_id = provs[0]["id"] if provs else 1
        db.entrada_stock(prod["id"], prov_id, cantidad, precio_compra=0)
        stock_nuevo = db.get_stock_actual(prod["id"])
        return f"✅ +{cantidad:.0f} {prod['unit']} de *{prod['name']}*\nStock: {stock_nuevo:.1f}"

    # ── Consulta stock ───────────────────────────────────────────────────────
    if intent == "consulta":
        if not _check_permiso(rol, "consultar_stock", config):
            return "⛔ Sin permiso."
        nombre = intent_data.get("producto", "")
        if nombre:
            prod = _normalizar_producto(nombre, db)
            if prod:
                stock = db.get_stock_actual(prod["id"])
                badge = " ⚠️ BAJO MÍNIMO" if stock < prod.get("min_stock", 0) else ""
                return f"📦 *{prod['name']}*: {stock:.1f} {prod['unit']}{badge}"
            return f"⚠️ No encontré *{nombre}*."
        # Inventario completo
        prods = db.listar_productos()
        if not prods:
            return "📦 Inventario vacío."
        lines = ["📦 *Inventario:*\n"]
        for p in prods:
            s = db.get_stock_actual(p["id"])
            badge = " ⚠️" if s < p.get("min_stock", 0) else ""
            lines.append(f"  • {p['name']}: {s:.1f} {p['unit']}{badge}")
        return "\n".join(lines)

    # ── Alertas stock bajo ───────────────────────────────────────────────────
    if intent == "alerta":
        if not _check_permiso(rol, "consultar_stock", config):
            return "⛔ Sin permiso."
        alertas = db.get_alertas_stock_bajo()
        if not alertas:
            return "✅ Todo el stock está en niveles normales."
        lines = ["⚠️ *Productos bajo mínimo:*\n"]
        for a in alertas:
            lines.append(f"  • {a['name']}: {a['stock_actual']:.1f} {a['unit']} (mín: {a['min_stock']:.1f})")
        return "\n".join(lines)

    # ── Lista de pedido ──────────────────────────────────────────────────────
    if intent == "pedido":
        if not _check_permiso(rol, "lista_pedido", config):
            return "⛔ Solo admin o dueña."
        alertas = db.get_alertas_stock_bajo()
        if not alertas:
            return "✅ No hay productos que pedir. Stock en niveles normales."
        salon = config.get("salon_nombre", "Salón")
        lines = [f"🛒 *Lista de pedido — {salon}:*\n"]
        for a in alertas:
            falta = max(0, a["min_stock"] * 2 - a["stock_actual"])
            lines.append(f"  • {a['name']}: pedir {falta:.0f} {a['unit']}")
        lines.append("\n_Generado automáticamente por Donna_")
        return "\n".join(lines)

    # ── Reporte semanal / mensual ────────────────────────────────────────────
    if intent == "reporte":
        if not _check_permiso(rol, "reporte_semana", config):
            return "⛔ Solo admin o dueña."
        dias = 7 if "seman" in texto.lower() else 30
        f = db.get_flujo_periodo(dias=dias)
        return (
            f"📊 *Flujo últimos {dias} días:*\n\n"
            f"  📥 Entradas: {f['entradas_qty']:.0f} unidades\n"
            f"  📤 Salidas: {f['salidas_qty']:.0f} unidades\n"
            f"  ⏱️ Horas trabajadas: {f['horas_labor']:.1f}h"
        )

    # ── Ayuda ────────────────────────────────────────────────────────────────
    salon = config.get("salon_nombre", "Salón")
    base = [
        f"💇 *Donna — Almacén {salon}*\n",
        "📸 Manda una *foto* del producto que usaste",
        "✍️ O escribe:",
        "  • _usé 2 tubos de tinte rojo_",
        "  • _llegaron 10 oxidantes_",
        "  • _cuánto hay de keratina_",
        "  • _qué está por agotarse_",
    ]
    if rol in ("admin", "duena"):
        base += [
            "  • _lista de pedido_",
            "  • _reporte de la semana_",
        ]
    return "\n".join(base)
