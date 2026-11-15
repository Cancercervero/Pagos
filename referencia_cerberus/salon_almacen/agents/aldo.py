"""
Aldo — Abastecedor del Salón.

Negociador nato. Conoce a todos los proveedores, sabe quién tiene el mejor precio
y en cuánto tiempo entregan. Cuando Enzo dice "stock bajo", Aldo ya tiene el pedido listo.
Genera órdenes de compra, las guarda para aprobación de Donna/admin, y cuando se aprueba
las envía al proveedor (WhatsApp message o texto listo para copiar).
"""
import json
import logging
import os
from datetime import datetime
from host_engine.cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("Aldo")

_PERSONALIDAD = (
    "Soy Aldo. Conozco a cada proveedor por su nombre. "
    "Sé cuándo están en promo, cuándo suben precios y quién entrega a tiempo. "
    "Cuando necesitas algo, ya lo tengo listo antes de que me lo pidas."
)

_ORDENES_PATH = os.path.join(os.path.dirname(__file__), "..", "ordenes_pendientes.json")

_PROMPT_ORDEN = """Eres Aldo, abastecedor de un salón de belleza.
Redacta un mensaje de WhatsApp profesional pero amigable para el proveedor,
solicitando los productos de la lista. Incluye el salón como remitente.
Máximo 5 líneas. En español."""


def _db(db_path=None) -> AlmacenDB:
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def _load_ordenes() -> list:
    if os.path.exists(_ORDENES_PATH):
        with open(_ORDENES_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_ordenes(ordenes: list):
    with open(_ORDENES_PATH, "w", encoding="utf-8") as f:
        json.dump(ordenes, f, ensure_ascii=False, indent=2)


# ── Generar orden de compra ───────────────────────────────────────────────────

def generar_orden(salon_nombre: str = "Salón", db_path=None) -> dict:
    """
    Aldo revisa qué está bajo mínimo y genera una orden de compra.
    La orden queda PENDIENTE hasta que Donna/admin la apruebe.
    """
    db = _db(db_path)
    alertas = db.get_alertas_stock_bajo()

    if not alertas:
        return {"ok": False, "motivo": "nada_bajo_minimo"}

    proveedores = db.listar_proveedores()
    prov_nombre = proveedores[0]["name"] if proveedores else "Proveedor"

    items = []
    for a in alertas:
        cantidad_pedir = max(1.0, round(a["min_stock"] * 2 - a["stock_actual"], 1))
        items.append({
            "part_id":  a["id"],
            "nombre":   a["name"],
            "sku":      a["sku"],
            "unidad":   a["unit"],
            "cantidad": cantidad_pedir,
            "stock_actual": a["stock_actual"],
            "min_stock": a["min_stock"],
        })

    # Redactar mensaje para proveedor
    lista_texto = "\n".join([f"- {i['nombre']}: {i['cantidad']:.0f} {i['unidad']}" for i in items])
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        msg_proveedor = ask_llm_lite(
            f"Salón: {salon_nombre}\nProveedor: {prov_nombre}\nProductos:\n{lista_texto}",
            system=_PROMPT_ORDEN
        )
    except Exception:
        msg_proveedor = (
            f"Hola {prov_nombre}, somos {salon_nombre}.\n"
            f"Necesitamos el siguiente pedido:\n{lista_texto}\n"
            f"¿Pueden confirmar disponibilidad y precio? Gracias 🙏"
        )

    orden = {
        "id": f"ORD-{datetime.now().strftime('%Y%m%d%H%M')}",
        "fecha": datetime.now().isoformat(),
        "salon": salon_nombre,
        "proveedor": prov_nombre,
        "items": items,
        "mensaje_proveedor": msg_proveedor,
        "estado": "pendiente_aprobacion",
    }

    ordenes = _load_ordenes()
    ordenes.append(orden)
    _save_ordenes(ordenes)

    logger.info(f"[Aldo] Orden generada: {orden['id']} — {len(items)} productos")
    return {"ok": True, "orden": orden}


def aprobar_orden(orden_id: str, db_path=None) -> str:
    """Donna/admin aprueba. Aldo dispara el WhatsApp al proveedor."""
    ordenes = _load_ordenes()
    for o in ordenes:
        if o["id"] == orden_id and o["estado"] == "pendiente_aprobacion":
            o["estado"] = "aprobada"
            o["aprobada_en"] = datetime.now().isoformat()

            # Buscar WhatsApp del proveedor en DB
            db = _db(db_path)
            prov = db.get_proveedor(o["proveedor"])
            whatsapp_num = prov.get("whatsapp", "") if prov else ""
            email_prov   = prov.get("email", "") if prov else ""

            lista_texto = "\n".join([
                f"- {i['nombre']}: {i['cantidad']:.0f} {i['unidad']}"
                for i in o["items"]
            ])

            resultado_envio = {"ok": False, "via": "ninguna"}

            # 1. WhatsApp vía Meta API
            if whatsapp_num:
                try:
                    from host_engine.products.salon_almacen.whatsapp_sender import enviar_orden_proveedor
                    resultado_envio = enviar_orden_proveedor(
                        numero=whatsapp_num,
                        nombre_proveedor=o["proveedor"],
                        nombre_salon=o["salon"],
                        lista_productos=lista_texto,
                    )
                    o["enviado_via"] = resultado_envio.get("via", "whatsapp")
                except Exception as e:
                    logger.warning(f"[Aldo] WhatsApp falló: {e}")

            # 2. Email como fallback si no hay WhatsApp o falló
            if not resultado_envio.get("ok") and email_prov:
                try:
                    from host_engine.skills.google_services.gmail_skill import enviar_correo
                    cuerpo = (
                        f"Estimado/a {o['proveedor']},\n\n"
                        f"Somos {o['salon']}. Solicitamos el siguiente pedido:\n\n"
                        f"{lista_texto}\n\n"
                        f"Por favor confirmar disponibilidad y precio.\n\n"
                        f"Gracias.\n— Donna, Sistema de Almacén"
                    )
                    enviar_correo(
                        destinatario=email_prov,
                        asunto=f"Pedido {orden_id} — {o['salon']}",
                        cuerpo=cuerpo,
                    )
                    resultado_envio = {"ok": True, "via": "email"}
                    o["enviado_via"] = "email"
                except Exception as e:
                    logger.warning(f"[Aldo] Email falló: {e}")

            _save_ordenes(ordenes)
            logger.info(f"[Aldo] Orden {orden_id} aprobada — enviada vía {resultado_envio.get('via')}")

            if resultado_envio.get("ok"):
                via = resultado_envio.get("via", "")
                icono = "📱" if "whatsapp" in via else "📧"
                return (
                    f"✅ *Orden {orden_id} enviada {icono}*\n"
                    f"  Proveedor: {o['proveedor']}\n"
                    f"  Vía: {via}\n"
                    f"  Productos: {len(o['items'])}\n\n"
                    f"_Aldo está esperando confirmación._"
                )
            else:
                return (
                    f"⚠️ Orden {orden_id} aprobada pero no se pudo enviar automáticamente.\n"
                    f"Copia este mensaje y envíalo a *{o['proveedor']}*:\n\n"
                    f"{o['mensaje_proveedor']}"
                )

    return f"⚠️ Aldo: no encontré orden {orden_id} pendiente."


def rechazar_orden(orden_id: str) -> str:
    """Admin rechaza la orden."""
    ordenes = _load_ordenes()
    for o in ordenes:
        if o["id"] == orden_id:
            o["estado"] = "rechazada"
            _save_ordenes(ordenes)
            return f"❌ Orden {orden_id} cancelada."
    return f"⚠️ No encontré orden {orden_id}."


def ordenes_pendientes() -> list:
    return [o for o in _load_ordenes() if o["estado"] == "pendiente_aprobacion"]


def buscar_ordenes_aprobadas() -> list:
    """Órdenes aprobadas y enviadas, aún no marcadas como recibidas."""
    return [o for o in _load_ordenes() if o["estado"] == "aprobada"]


def recibir_orden(orden_id: str, productos_recibidos: list = None,
                  factura_num: str = "", photo_ref: str = "") -> str:
    """
    Marca una orden como recibida.
    productos_recibidos: [{"nombre": ..., "cantidad": ...}] — lista real recibida.
    Si hay discrepancias con lo pedido, las reporta.
    """
    ordenes = _load_ordenes()
    for o in ordenes:
        if o["id"] == orden_id and o["estado"] in ("aprobada", "pendiente_aprobacion"):
            o["estado"] = "recibida"
            o["recibida_en"] = datetime.now().isoformat()
            if factura_num:
                o["factura_num"] = factura_num
            if photo_ref:
                o["factura_foto"] = photo_ref

            discrepancias = []
            if productos_recibidos:
                o["productos_recibidos"] = productos_recibidos
                pedidos = {i["nombre"].lower(): i["cantidad"] for i in o.get("items", [])}
                for pr in productos_recibidos:
                    nombre_k = pr["nombre"].lower()
                    cant_recibida = pr["cantidad"]
                    # fuzzy match
                    match_key = next((k for k in pedidos if nombre_k in k or k in nombre_k), None)
                    if match_key:
                        cant_pedida = pedidos[match_key]
                        if abs(cant_recibida - cant_pedida) > 0.01:
                            discrepancias.append(
                                f"  ⚠️ {pr['nombre']}: pedidos {cant_pedida:.0f}, "
                                f"recibidos {cant_recibida:.0f}"
                            )

            _save_ordenes(ordenes)
            logger.info(f"[Aldo] Orden {orden_id} recibida — factura {factura_num or 'N/A'}")

            msg = f"✅ *Orden {orden_id} recibida*"
            if factura_num:
                msg += f"\n  📄 Factura: {factura_num}"
            if discrepancias:
                msg += "\n\n⚠️ *Diferencias vs pedido:*\n" + "\n".join(discrepancias)
            else:
                msg += "\n  Todo coincide con lo pedido. ✅"
            return msg

    return f"⚠️ No encontré orden {orden_id} en estado aprobada."


def match_orden_por_productos(productos_recibidos: list) -> dict | None:
    """
    Busca la orden aprobada más probable para estos productos recibidos.
    Útil cuando admin no sabe el ID de la orden.
    """
    aprobadas = buscar_ordenes_aprobadas()
    if not aprobadas:
        return None

    mejor_match = None
    mejor_score = 0

    nombres_rec = {p["nombre"].lower() for p in productos_recibidos}
    for o in aprobadas:
        nombres_ord = {i["nombre"].lower() for i in o.get("items", [])}
        score = len(nombres_rec & nombres_ord)
        if score > mejor_score:
            mejor_score = score
            mejor_match = o

    return mejor_match if mejor_score > 0 else None


def reporte_aldo(db_path=None) -> str:
    """Resumen para Donna: qué hay que pedir."""
    db = _db(db_path)
    alertas = db.get_alertas_stock_bajo()
    pendientes = ordenes_pendientes()

    lines = ["🛒 *Aldo — Abastecimiento:*\n"]

    if pendientes:
        lines.append(f"⏳ {len(pendientes)} orden(es) esperando aprobación:")
        for o in pendientes:
            lines.append(f"  • {o['id']} — {len(o['items'])} productos para {o['proveedor']}")
        lines.append("")

    if alertas:
        lines.append("📉 Por reponer:")
        for a in alertas:
            falta = max(0, a["min_stock"] * 2 - a["stock_actual"])
            lines.append(f"  • {a['name']}: pedir ~{falta:.0f} {a['unit']}")
    else:
        lines.append("✅ Stock en niveles normales, no se necesita pedir nada.")

    return "\n".join(lines)
