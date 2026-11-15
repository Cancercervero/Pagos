"""
🏪 ALMACENISTA INTELIGENTE — Cerebro del Inventario
====================================================
El Almacenista es el cerebro del sistema de inventarios.

RESPONSABILIDADES:
  1. Monitorear niveles de stock continuamente
  2. Detectar productos en nivel crítico
  3. Proponer órdenes de reabastecimiento
  4. Disparar el flujo de autorización humana (AuthGate)
  5. Reportar a Donna cuando hay alertas
  6. Calcular costos de reorden

JERARQUÍA:
  Tania → registra movimientos (entradas/salidas)
  Almacenista → analiza el estado global y propone acciones
  Donna → recibe alertas y las presenta al humano
  Auth Gate → captura la decisión del humano
  Annie → ejecuta el contacto con proveedor (si fue aprobado)
"""

from __future__ import annotations
import logging
from datetime import datetime

logger = logging.getLogger("Almacenista")


# ── Análisis de inventario ────────────────────────────────────────────────────

def analizar_inventario() -> dict:
    """
    Análisis completo del inventario.
    Retorna un dict con el estado y acciones recomendadas.
    """
    from host_engine.skills.tania_bodeguera_skill import (
        get_stock_critico, get_inventario_completo, get_movimientos_recientes
    )

    criticos = get_stock_critico()
    inventario = get_inventario_completo()
    movimientos = get_movimientos_recientes(50)

    # Calcular valor total del inventario
    valor_total = sum(p["stock"] * p["costo_unit"] for p in inventario)

    # Detectar productos sin stock (stock = 0)
    sin_stock = [p for p in inventario if p["stock"] <= 0]

    # Detectar caducidades próximas (si tienen fecha)
    hoy = datetime.now()
    caducidades_proximas = []
    for p in inventario:
        if p.get("caducidad"):
            try:
                fecha_cad = datetime.strptime(p["caducidad"], "%Y-%m-%d")
                dias = (fecha_cad - hoy).days
                if 0 <= dias <= 30:
                    caducidades_proximas.append({**p, "dias_restantes": dias})
            except Exception:
                pass

    return {
        "total_productos":       len(inventario),
        "stock_critico":         criticos,
        "sin_stock":             sin_stock,
        "caducidades_proximas":  caducidades_proximas,
        "valor_total_inventario": valor_total,
        "movimientos_hoy":       [m for m in movimientos if m["fecha"][:10] == hoy.strftime("%Y-%m-%d")],
        "timestamp":             hoy.isoformat(),
    }


def generar_propuesta_reorden(criticos: list[dict] | None = None) -> list[dict]:
    """
    Genera una propuesta de reorden para los productos críticos.
    Agrupa por proveedor para minimizar órdenes.
    
    Returns:
        Lista de propuestas agrupadas por proveedor
    """
    from host_engine.skills.tania_bodeguera_skill import get_stock_critico

    productos = criticos or get_stock_critico()
    if not productos:
        return []

    # Agrupar por proveedor
    por_proveedor: dict[str, list] = {}
    for p in productos:
        proveedor = p.get("proveedor") or "Proveedor General"
        if proveedor not in por_proveedor:
            por_proveedor[proveedor] = []
        # Cantidad a pedir = stock_min * 2 (cubrir el doble del mínimo)
        cantidad_reorden = max(p["stock_min"] * 2 - p["stock"], p["stock_min"])
        por_proveedor[proveedor].append({
            "producto_id": p["id"],
            "nombre":     p["nombre"],
            "marca":      p["marca"],
            "stock_actual": p["stock"],
            "stock_min":  p["stock_min"],
            "cantidad":   cantidad_reorden,
            "unidad":     p["unidad"],
            "costo_unit": p["costo_unit"],
            "monto_est":  cantidad_reorden * p["costo_unit"],
        })

    propuestas = []
    for proveedor, items in por_proveedor.items():
        monto_total = sum(i["monto_est"] for i in items)
        propuestas.append({
            "proveedor":   proveedor,
            "productos":   items,
            "monto_total": monto_total,
        })

    return propuestas


# ── Flujo de alerta → Donna → Annie → Humano ─────────────────────────────────

def disparar_alertas_inventario() -> list[str]:
    """
    Verifica el inventario y, si hay críticos, dispara el flujo completo:
    Almacenista → Donna (alerta) → Annie (resumen WA) → Humano (autorización)
    
    Returns:
        Lista de mensajes de log sobre lo que se hizo
    """
    from host_engine.cerberus_core.auth_gate import AUTH
    from host_engine.cerberus_core.llm_router import hive_broadcast, hive_save_fact

    analisis = analizar_inventario()
    criticos = analisis["stock_critico"]
    sin_stock = analisis["sin_stock"]
    logs = []

    if not criticos and not sin_stock:
        logs.append("✅ Inventario OK — sin alertas críticas")
        return logs

    # ── Construir resumen para Donna ──────────────────────────────────────
    resumen_donna = ["⚠️ *ALERTA DE INVENTARIO — Almacenista*\n"]

    if sin_stock:
        resumen_donna.append(f"🚨 *SIN STOCK ({len(sin_stock)} productos):*")
        for p in sin_stock:
            resumen_donna.append(f"  ✗ {p['nombre']} ({p['marca']})")

    if criticos:
        resumen_donna.append(f"\n⚠️ *STOCK CRÍTICO ({len(criticos)} productos):*")
        for p in criticos:
            resumen_donna.append(f"  • {p['nombre']}: {p['stock']} {p['unidad']} (mín: {p['stock_min']})")

    resumen_donna.append(f"\n💰 Valor actual del inventario: ${analisis['valor_total_inventario']:,.2f}")

    # Notificar a Donna via colmena
    hive_broadcast(
        from_agent="almacenista",
        event_type="inventory_alert",
        payload={
            "resumen":         "\n".join(resumen_donna),
            "criticos_count":  len(criticos),
            "sin_stock_count": len(sin_stock),
        },
        to_agent="donna",
    )
    logs.append(f"📢 Donna notificada: {len(criticos)} críticos, {len(sin_stock)} sin stock")

    # ── Generar propuestas de reorden ─────────────────────────────────────
    propuestas = generar_propuesta_reorden(criticos + sin_stock)

    for propuesta in propuestas:
        result = AUTH.nueva_orden(
            productos = propuesta["productos"],
            proveedor = propuesta["proveedor"],
            monto     = propuesta["monto_total"],
        )
        logs.append(f"🔐 AuthGate #{result['id']}: orden para {propuesta['proveedor']} [token: {result['token']}]")

        # Guardar en la colmena para que Annie lo recoja y lo envíe al humano
        hive_save_fact(
            agent_id="almacenista",
            user_id="inventario",
            fact=f"Orden pendiente auth #{result['id']}: {propuesta['proveedor']} | token: {result['token']}",
        )

        # Broadcast a Annie con el mensaje formateado para WhatsApp
        hive_broadcast(
            from_agent="almacenista",
            event_type="auth_required",
            payload={
                "solicitud_id": result["id"],
                "token":        result["token"],
                "mensaje_wa":   result["mensaje_wa"],
                "proveedor":    propuesta["proveedor"],
            },
            to_agent="annie",
        )
        logs.append(f"📱 Annie notificada para enviar al humano: {result['token']}")

    return logs


# ── Procesar respuesta de autorización ───────────────────────────────────────

def procesar_autorizacion(mensaje: str, canal: str = "whatsapp") -> str | None:
    """
    Llama al AuthGate con el mensaje del humano.
    Si hay una decisión válida, ejecuta la acción correspondiente.
    
    Returns:
        Respuesta para el humano, o None si el mensaje no era una autorización
    """
    from host_engine.cerberus_core.auth_gate import AUTH, AuthStatus

    resultado = AUTH.procesar_respuesta(mensaje)
    if not resultado:
        return None

    if "error" in resultado:
        return f"⚠️ {resultado['error']}"

    decision = resultado["decision"]
    titulo   = resultado["titulo"]
    token    = resultado["token"]

    if decision == AuthStatus.APROBADA:
        # Ejecutar la acción
        _ejecutar_accion_aprobada(resultado)
        return (
            f"✅ *Autorizado* — #{resultado['solicitud_id']}\n"
            f"_{titulo}_\n\n"
            f"Annie procederá con {resultado['proveedor']}."
        )

    elif decision == AuthStatus.RECHAZADA:
        motivo = resultado.get("motivo", "")
        return (
            f"❌ *Rechazado* — #{resultado['solicitud_id']}\n"
            f"_{titulo}_\n"
            + (f"\nMotivo registrado: {motivo}" if motivo else "")
        )

    elif decision == AuthStatus.ESPERA:
        return (
            f"⏳ *Pospuesto 24h* — #{resultado['solicitud_id']}\n"
            f"_{titulo}_\n\n"
            f"Te lo recuerdo mañana a las 9am."
        )

    return None


def _ejecutar_accion_aprobada(resultado: dict):
    """
    Ejecuta la acción aprobada por el humano.
    Actualmente notifica a Annie para que contacte al proveedor.
    """
    from host_engine.cerberus_core.llm_router import hive_broadcast

    tipo = resultado["tipo"]

    if tipo in ("orden_compra", "contacto_proveedor"):
        # Annie recibe la orden de proceder
        productos = resultado["detalle"].get("productos", [])
        msg_proveedor = _construir_mensaje_proveedor(resultado["proveedor"], productos)

        hive_broadcast(
            from_agent="almacenista",
            event_type="send_to_supplier",
            payload={
                "proveedor":       resultado["proveedor"],
                "mensaje":         msg_proveedor,
                "solicitud_id":    resultado["solicitud_id"],
                "monto_estimado":  resultado["monto_est"],
            },
            to_agent="annie",
        )
        logger.info("[Almacenista] Aprobado #%d → Annie enviará a %s",
                    resultado["solicitud_id"], resultado["proveedor"])


def _construir_mensaje_proveedor(proveedor: str, productos: list[dict]) -> str:
    """Construye el mensaje que Annie enviará al proveedor."""
    if not productos:
        return f"Hola {proveedor}, necesitamos hacer un pedido. ¿Podemos coordinarnos?"

    lines = [f"Hola {proveedor}, necesitamos los siguientes productos:"]
    for p in productos:
        lines.append(f"  • {p['nombre']} — {p['cantidad']} {p['unidad']}")
    lines.append("\n¿Disponibilidad y precio? Gracias.")
    return "\n".join(lines)


# ── Reporte ejecutivo para Donna ──────────────────────────────────────────────

def reporte_ejecutivo() -> str:
    """Genera el reporte diario de inventario para Donna / la dueña."""
    analisis = analizar_inventario()

    lines = [
        "📦 *REPORTE DE INVENTARIO — Almacenista*",
        f"_{datetime.now().strftime('%d/%m/%Y %H:%M')}_\n",
        f"🗂️ Productos activos: {analisis['total_productos']}",
        f"💰 Valor del inventario: ${analisis['valor_total_inventario']:,.2f}",
    ]

    if analisis["sin_stock"]:
        lines.append(f"\n🚨 Sin stock: {len(analisis['sin_stock'])} productos")
        for p in analisis["sin_stock"][:5]:
            lines.append(f"  ✗ {p['nombre']}")

    if analisis["stock_critico"]:
        lines.append(f"\n⚠️ Nivel crítico: {len(analisis['stock_critico'])} productos")
        for p in analisis["stock_critico"][:5]:
            lines.append(f"  • {p['nombre']}: {p['stock']} {p['unidad']}")

    if analisis["caducidades_proximas"]:
        lines.append(f"\n📅 Caducidades próximas (<30 días): {len(analisis['caducidades_proximas'])}")
        for p in analisis["caducidades_proximas"]:
            lines.append(f"  ⏰ {p['nombre']}: {p['dias_restantes']} días")

    if analisis["movimientos_hoy"]:
        lines.append(f"\n📋 Movimientos hoy: {len(analisis['movimientos_hoy'])}")

    if not analisis["stock_critico"] and not analisis["sin_stock"]:
        lines.append("\n✅ Todo en orden. Sin alertas.")

    return "\n".join(lines)
