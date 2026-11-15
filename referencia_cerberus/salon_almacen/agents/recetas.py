"""
recetas.py — Recetas de servicio del salón.

"Hice una keratina" → Donna busca receta → Enzo descuenta todo de una.

Estilista nunca tiene que reportar producto por producto.
Admin define las recetas una vez. Sistema las aplica siempre.
"""
import logging
import re

logger = logging.getLogger("Recetas")

_PROMPT_CREAR_RECETA = """Eres un asistente de inventario de salón de belleza.
El admin quiere crear una receta de servicio.
Extrae el nombre del servicio y los productos con cantidades.
Responde SOLO con JSON:
{
  "nombre": "nombre del servicio",
  "productos": [
    {"nombre": "...", "cantidad": N, "unidad": "ml|g|pza|tubo|sobre"}
  ],
  "precio_sugerido": N_o_0
}
Mensaje del admin: """

_PROMPT_DETECTAR_SERVICIO = """Detecta si este mensaje de una estilista menciona un servicio de salón.
Responde SOLO con JSON: {"es_servicio": true/false, "servicio": "nombre aproximado"}
Servicios típicos: keratina, tinte, coloración, decoloración, corte con tinte, baño de color, tratamiento, alisado.
Mensaje: """


def _db(db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


# ── Detectar si el mensaje es un servicio ────────────────────────────────────

def detectar_servicio(texto: str) -> dict:
    """Retorna {"es_servicio": bool, "servicio": str}"""
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        import json
        raw = ask_llm_lite(_PROMPT_DETECTAR_SERVICIO + texto)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.warning(f"[Recetas] detect falló: {e}")
    return {"es_servicio": False, "servicio": ""}


# ── Aplicar receta ────────────────────────────────────────────────────────────

def aplicar_receta(nombre_servicio: str, estilista_id: str, db_path=None) -> str:
    """
    Busca la receta y descuenta todos los productos vía Enzo.
    Retorna mensaje formateado para Telegram.
    """
    from host_engine.products.salon_almacen.agents.enzo import registrar_uso

    db = _db(db_path)
    receta = db.buscar_receta_fuzzy(nombre_servicio)

    if not receta:
        return (
            f"📋 No tengo receta para *{nombre_servicio}*.\n"
            f"Admin puede crearla: _nueva receta keratina: 200ml keratina, 2 guantes, 1 toalla_"
        )

    resultados = []
    errores = []
    for item in receta["items"]:
        part_id  = item.get("part_id")
        cantidad = float(item.get("cantidad", 1))
        if not part_id:
            # Intentar resolver por nombre si no tiene part_id
            prod = db.get_producto(item.get("nombre", ""))
            if prod:
                part_id = prod["id"]
            else:
                errores.append(f"⚠️ No encontré: {item.get('nombre')}")
                continue

        result = registrar_uso(part_id, cantidad,
                               nota=f"Servicio: {receta['nombre']} — estilista {estilista_id}",
                               db_path=db_path)
        if result["ok"]:
            prod = db.get_producto(str(part_id))
            nombre_p = prod["name"] if prod else f"ID:{part_id}"
            badge = " ⚠️" if result.get("bajo_minimo") else ""
            resultados.append(f"  ✅ -{cantidad:.0f} {item.get('unidad','u')} {nombre_p}{badge}")
        else:
            errores.append(f"  ⚠️ Sin stock: {item.get('nombre', part_id)}")

    lines = [f"💇 *{receta['nombre']}* aplicado:\n"] + resultados
    if errores:
        lines += ["\n"] + errores
    if any("⚠️" in r for r in resultados):
        lines.append("\n_Aldo revisará el stock bajo mínimo._")
    return "\n".join(lines)


# ── Crear receta desde texto ──────────────────────────────────────────────────

def crear_receta_desde_texto(texto: str, db_path=None, moneda: str = "$") -> str:
    """Admin escribe: 'nueva receta keratina: 200ml keratina, 2 guantes, 1 toalla'"""
    try:
        from host_engine.cerberus_core.llm_router import ask_llm
        import json

        raw = ask_llm(_PROMPT_CREAR_RECETA + texto, max_tokens=400)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            return "⚠️ No pude entender la receta. Usa: _nueva receta [servicio]: [cantidad] [producto], ..._"

        data = json.loads(m.group())
        nombre = data.get("nombre", "").strip()
        productos_raw = data.get("productos", [])
        precio = float(data.get("precio_sugerido") or 0)

        if not nombre or not productos_raw:
            return "⚠️ Falta nombre o productos en la receta."

        db = _db(db_path)
        items = []
        no_encontrados = []

        for p in productos_raw:
            prod = db.get_producto(p["nombre"])
            if not prod:
                # Buscar fuzzy
                todos = db.listar_productos()
                match = next((x for x in todos if p["nombre"].lower() in x["name"].lower()), None)
                prod = match

            if prod:
                items.append({
                    "part_id":  prod["id"],
                    "nombre":   prod["name"],
                    "cantidad": float(p.get("cantidad", 1)),
                    "unidad":   p.get("unidad", prod["unit"]),
                })
            else:
                no_encontrados.append(p["nombre"])

        if not items:
            return f"⚠️ Ningún producto de la receta está en el inventario: {', '.join(no_encontrados)}"

        rid = db.guardar_receta(nombre, items, precio)
        lines = [f"✅ *Receta '{nombre}'* guardada (ID: {rid})\n"]
        for i in items:
            lines.append(f"  • {i['cantidad']:.0f} {i['unidad']} de {i['nombre']}")
        if no_encontrados:
            lines.append(f"\n⚠️ No encontré en inventario: {', '.join(no_encontrados)}")
        if precio:
            lines.append(f"\n💰 Precio sugerido: {moneda}{precio:.0f}")
        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[Recetas] crear falló: {e}")
        return f"⚠️ Error creando receta: {e}"


def costear_receta(nombre_servicio: str, db_path=None) -> dict:
    """
    Calcula costo real de la receta con precios actuales del inventario.
    Retorna {"ok": bool, "nombre": str, "costo_total": float, "precio_sugerido": float, "items": [...]}
    """
    db = _db(db_path)
    receta = db.buscar_receta_fuzzy(nombre_servicio)
    if not receta:
        return {"ok": False, "costo_total": 0.0, "items": []}

    items_costeo = []
    costo_total = 0.0
    for item in receta["items"]:
        part_id = item.get("part_id")
        cantidad = float(item.get("cantidad", 1))
        margen = db.get_margen_producto(part_id) if part_id else {}
        costo_u = margen.get("costo_total", 0.0)
        subtotal = costo_u * cantidad
        costo_total += subtotal
        items_costeo.append({
            "nombre":        item.get("nombre", margen.get("name", f"ID:{part_id}")),
            "cantidad":      cantidad,
            "unidad":        item.get("unidad", "u"),
            "costo_unitario": round(costo_u, 2),
            "subtotal":      round(subtotal, 2),
        })

    return {
        "ok":              True,
        "nombre":          receta["nombre"],
        "precio_sugerido": float(receta.get("precio_sugerido") or 0),
        "costo_total":     round(costo_total, 2),
        "items":           items_costeo,
    }


def listar_recetas(db_path=None, moneda: str = "$") -> str:
    db = _db(db_path)
    recetas = db.listar_recetas()
    if not recetas:
        return "📋 No hay recetas. Admin puede crear: _nueva receta [servicio]: [productos]_"
    lines = ["📋 *Recetas de servicio:*\n"]
    for r in recetas:
        costeo = costear_receta(r["nombre"], db_path)
        precio_s = float(r.get("precio_sugerido") or 0)
        costo = costeo["costo_total"] if costeo["ok"] else 0.0
        precio_display = f" · {moneda}{precio_s:.0f}" if precio_s else ""
        costo_display  = f" · costo {moneda}{costo:.2f}" if costo else ""
        lines.append(f"  • *{r['nombre']}* ({len(r['items'])} productos{precio_display}{costo_display})")
    return "\n".join(lines)
