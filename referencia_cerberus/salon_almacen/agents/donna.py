"""
Donna — Orquestadora del equipo Salón.

Recibe todo del exterior. Despacha al agente correcto. Consolida respuestas.
Ella NO opera la DB directamente — para eso están Enzo, Verónica, Tomás y Aldo.
Es la única que habla con el cliente y el admin.
"""
import logging

logger = logging.getLogger("Donna")

_PERSONALIDAD = (
    "Soy Donna. Coordino a mi equipo: Enzo lleva el conteo, "
    "Verónica audita, Tomás calcula los márgenes, Aldo consigue lo que se necesita. "
    "Tú me hablas a mí. Yo me encargo del resto."
)

_PROMPT_DESPACHO = """Eres Donna, orquestadora de un sistema de inventario para salón de belleza.
Analiza el mensaje y decide a qué agente despacharlo:
  enzo      → registrar uso/entrada/merma, consultar stock
  veronica  → auditoría, patrones de consumo, anomalías
  tomas     → márgenes, precios, rentabilidad de servicios
  aldo      → proveedores, órdenes de compra, abastecimiento
  donna     → preguntas generales, saludos, ayuda
Responde SOLO con JSON: {"agente": "X", "accion": "descripcion_breve"}"""


def _detectar_agente(texto: str) -> dict:
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        import json, re
        raw = ask_llm_lite(texto, system=_PROMPT_DESPACHO)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.warning(f"[Donna] Routing falló: {e}")
    return {"agente": "donna", "accion": "general"}


def despachar_texto(texto: str, user_id: str, config: dict, db_path=None) -> str:
    """
    Punto de entrada principal. Donna recibe el texto, decide quién responde.
    """
    from host_engine.products.salon_almacen.agents import angelica as _angelica

    t_lower = texto.lower().strip()

    # "nueva receta ..." → Angélica crea receta (solo admin/dueña)
    if t_lower.startswith("nueva receta"):
        rol = config.get("roles", {}).get(str(user_id), "")
        if rol not in ("admin", "duena"):
            return "⛔ Solo admin puede crear recetas."
        return _angelica.crear(texto, db_path, moneda=config.get("moneda", "$"))

    # Angélica detecta si el mensaje menciona un servicio
    det = _angelica.detectar(texto)
    if det.get("es_servicio") and det.get("servicio"):
        if det.get("es_cotizacion"):
            return _angelica.cotizar(det["servicio"], config, db_path, user_id=user_id)
        return _angelica.aplicar_servicio(
            det["servicio"], user_id,
            nombre_cliente=det.get("cliente") or None,
            db_path=db_path
        )

    decision = _detectar_agente(texto)
    agente = decision.get("agente", "donna")
    logger.info(f"[Donna] '{texto[:40]}...' → {agente}")

    if agente == "enzo":
        return _via_enzo(texto, db_path)

    if agente == "veronica":
        return _via_veronica(texto, db_path)

    if agente == "tomas":
        return _via_tomas(db_path)

    if agente == "aldo":
        return _via_aldo(db_path)

    # Fallback: skill original de texto (manejo completo con roles)
    from host_engine.products.salon_almacen.skill import procesar_texto
    return procesar_texto(texto, user_id, config, db_path)


def despachar_foto(image_path: str, user_id: str, config: dict, db_path=None) -> dict:
    """Foto → siempre va a Enzo vía skill (necesita confirmación del usuario)."""
    from host_engine.products.salon_almacen.skill import procesar_foto
    return procesar_foto(image_path, user_id, config, db_path)


def confirmar_uso_foto(pending: dict, config: dict, db_path=None) -> str:
    """Usuario confirmó foto → Enzo ejecuta la salida."""
    from host_engine.products.salon_almacen.agents.enzo import registrar_uso
    result = registrar_uso(pending["part_id"], pending["cantidad"], db_path=db_path)
    if not result["ok"]:
        return f"⚠️ Enzo: stock insuficiente. Solo hay {result['stock_actual']:.1f}."
    msg = f"✅ Enzo registró: -{pending['cantidad']} de *{pending['nombre']}*\nStock: {result['stock_nuevo']:.1f}"
    if result.get("bajo_minimo"):
        msg += "\n⚠️ *Stock bajo mínimo — Aldo está generando orden de compra*"
        _trigger_aldo(config, db_path)
    return msg


def reporte_matutino(config: dict, db_path=None) -> str:
    """
    Donna consolida reportes de todos los agentes para el resumen de la mañana.
    Admin y dueña reciben esto cada día a la hora configurada.
    """
    from host_engine.products.salon_almacen.agents import enzo, veronica, tomas, aldo, isabel, angelica, valentina
    salon = config.get("salon_nombre", "Salón")

    moneda = config.get("moneda", "$")
    partes = [
        f"☀️ *Buenos días — {salon}*\n",
        enzo.reporte_enzo(db_path),
        "",
        isabel.reporte_isabel(db_path),
        "",
        tomas.reporte_tomas(db_path=db_path, moneda=moneda),
        "",
        aldo.reporte_aldo(db_path),
        "",
        angelica.reporte_angelica(db_path),
        "",
        valentina.reporte_valentina(db_path),
    ]

    # Verónica solo si hay anomalías
    alertas = enzo.alertas_stock_bajo(db_path)
    if alertas:
        partes.append("")
        partes.append(veronica.reporte_veronica(dias=7, db_path=db_path))

    # Tomás alerta de variaciones de precio (solo si hay cambios)
    variaciones = tomas.detectar_variaciones_precio(db_path=db_path, moneda=moneda)
    if variaciones:
        partes.append("")
        partes.append(variaciones)

    return "\n".join(partes)


def reporte_semanal_completo(config: dict, db_path=None) -> str:
    """Reporte profundo de Isabel — se manda los lunes o cuando la dueña pide."""
    from host_engine.products.salon_almacen.agents.isabel import reporte_semanal, reporte_predictivo
    salon  = config.get("salon_nombre", "Salón")
    moneda = config.get("moneda", "$")
    return (
        f"📊 *{salon} — Análisis Semanal de Isabel*\n\n"
        + reporte_semanal(db_path, moneda=moneda)
        + "\n\n"
        + reporte_predictivo(db_path)
    )


def salud_financiera(config: dict, db_path=None) -> str:
    """Diagnóstico financiero narrativo de Isabel."""
    from host_engine.products.salon_almacen.agents.isabel import salud_financiera as _sf
    moneda = config.get("moneda", "$")
    return "💳 *Isabel — Salud Financiera:*\n\n" + _sf(db_path, moneda=moneda)


def aprobar_orden(orden_id: str) -> str:
    """Admin aprueba orden → Aldo genera mensaje para proveedor."""
    from host_engine.products.salon_almacen.agents.aldo import aprobar_orden as _aprobar
    return _aprobar(orden_id)


def rechazar_orden(orden_id: str) -> str:
    from host_engine.products.salon_almacen.agents.aldo import rechazar_orden as _rechazar
    return _rechazar(orden_id)


def ordenes_pendientes_msg() -> str:
    from host_engine.products.salon_almacen.agents.aldo import ordenes_pendientes
    pendientes = ordenes_pendientes()
    if not pendientes:
        return "✅ No hay órdenes pendientes de aprobación."
    lines = ["⏳ *Órdenes pendientes (Aldo):*\n"]
    for o in pendientes:
        items_resumen = ", ".join([f"{i['nombre']} x{i['cantidad']:.0f}" for i in o["items"][:3]])
        lines.append(f"  • *{o['id']}* — {items_resumen}\n    Responde: /aprobar_{o['id']} o /rechazar_{o['id']}")
    return "\n".join(lines)


# ── Internos ──────────────────────────────────────────────────────────────────

def _via_enzo(texto: str, db_path=None) -> str:
    from host_engine.products.salon_almacen.agents.enzo import reporte_enzo, alertas_stock_bajo
    t = texto.lower()
    if any(k in t for k in ["alerta", "bajo", "falta", "poco"]):
        alertas = alertas_stock_bajo(db_path)
        if not alertas:
            return "✅ Enzo: todo el stock en niveles normales."
        lines = ["⚠️ *Enzo — Stock bajo mínimo:*\n"]
        for a in alertas:
            lines.append(f"  • {a['name']}: {a['stock_actual']:.1f} {a['unit']} (mín {a['min_stock']:.0f})")
        return "\n".join(lines)
    return reporte_enzo(db_path)


def _via_veronica(texto: str, db_path=None) -> str:
    from host_engine.products.salon_almacen.agents.veronica import auditar_periodo
    t = texto.lower()
    dias = 7 if "seman" in t else 30
    return auditar_periodo(dias=dias, db_path=db_path)


def _via_tomas(db_path=None) -> str:
    from host_engine.products.salon_almacen.agents.tomas import reporte_tomas
    return reporte_tomas(db_path=db_path)


def _via_aldo(db_path=None) -> str:
    from host_engine.products.salon_almacen.agents.aldo import reporte_aldo
    return reporte_aldo(db_path=db_path)


def _trigger_aldo(config: dict, db_path=None):
    """Cuando Enzo detecta stock bajo, Aldo genera orden automáticamente."""
    from host_engine.products.salon_almacen.agents.aldo import generar_orden
    salon = config.get("salon_nombre", "Salón")
    result = generar_orden(salon_nombre=salon, db_path=db_path)
    if result["ok"]:
        orden_id = result["orden"]["id"]
        logger.info(f"[Donna→Aldo] Orden generada automáticamente: {orden_id}")
