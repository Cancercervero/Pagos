"""
Tomás — Tasador de Precios.

Analítico y frío con los números. Calcula costos reales, márgenes por producto
y por servicio. Si un producto tiene margen negativo, Tomás lo sabe antes que nadie.
Sugiere precios de venta basados en costo + margen objetivo.
Alerta cuando el margen de un producto cae bajo el umbral configurado.
"""
import logging
from host_engine.cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("Tomas")

_PERSONALIDAD = (
    "Soy Tomás. Los números no mienten y yo tampoco. "
    "Si estás perdiendo en un servicio, te lo digo sin anestesia. "
    "Si hay margen para ganar más, también."
)

_MARGEN_MINIMO_DEFAULT = 30.0  # % mínimo aceptable por producto

_PROMPT_SUGERENCIA = """Eres Tomás, tasador de precios de un salón de belleza.
Con base en el costo total de los productos, sugiere un precio de venta para el servicio.
Considera: margen mínimo del 35%, competencia de mercado, posicionamiento de salón.
Responde en español, directo, con el precio sugerido y la justificación en 2 líneas."""


def _db(db_path=None) -> AlmacenDB:
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def analizar_margen(part_id: int, db_path=None) -> dict:
    """Tomás calcula el margen real de un producto."""
    db = _db(db_path)
    return db.get_margen_producto(part_id)


def ranking_margenes(db_path=None) -> list[dict]:
    """Todos los productos ordenados por margen. Los malos primero."""
    db = _db(db_path)
    return db.get_ranking_productos()


def productos_margen_bajo(umbral_pct: float = _MARGEN_MINIMO_DEFAULT, db_path=None) -> list[dict]:
    """Productos con margen por debajo del umbral. Tomás los marca en rojo."""
    ranking = ranking_margenes(db_path)
    return [p for p in ranking if p.get("margen_pct", 0) < umbral_pct]


def sugerir_precio_servicio(productos_usados: list[dict], db_path=None, moneda: str = "$") -> str:
    """
    Dado un listado de productos usados en un servicio (con cantidades),
    Tomás calcula el costo total y sugiere precio de venta.

    productos_usados: [{"part_id": N, "cantidad": N}, ...]
    """
    db = _db(db_path)
    costo_total = 0.0
    detalle = []

    for item in productos_usados:
        m = db.get_margen_producto(item["part_id"])
        if not m:
            continue
        costo_u = m.get("costo_total", 0)
        cant = float(item.get("cantidad", 1))
        subtotal = costo_u * cant
        costo_total += subtotal
        detalle.append(f"  {m['name']}: {cant} u × {moneda}{costo_u:.2f} = {moneda}{subtotal:.2f}")

    if not detalle:
        return "⚠️ Tomás: no encontré costos para esos productos."

    precio_sugerido_35 = costo_total / (1 - 0.35)
    precio_sugerido_50 = costo_total / (1 - 0.50)

    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        contexto = f"Costo total del servicio: {moneda}{costo_total:.2f}\nProductos:\n" + "\n".join(detalle)
        sugerencia = ask_llm_lite(contexto, system=_PROMPT_SUGERENCIA)
    except Exception:
        sugerencia = f"Precio mínimo (35% margen): {moneda}{precio_sugerido_35:.0f}"

    return (
        f"💰 *Tomás — Análisis de servicio:*\n\n"
        + "\n".join(detalle) +
        f"\n\n  Costo total: {moneda}{costo_total:.2f}\n"
        f"  Precio mín (35% margen): {moneda}{precio_sugerido_35:.0f}\n"
        f"  Precio óptimo (50% margen): {moneda}{precio_sugerido_50:.0f}\n\n"
        f"_{sugerencia}_"
    )


def historial_precio(part_id: int, db_path=None, moneda: str = "$") -> str:
    """Últimas entradas de un producto con precio — para ver tendencia."""
    db = _db(db_path)
    hist = db.get_historial_precios(part_id, limit=6)
    if not hist:
        return "Sin entradas registradas para este producto."
    prod = db.get_margen_producto(part_id)
    nombre = prod["name"] if prod else f"Producto {part_id}"
    lines = [f"📈 *{nombre} — Historial de precio:*\n"]
    for h in hist:
        lines.append(f"  {h['tx_date'][:10]}  {moneda}{h['price_at_tx']:.2f}")
    return "\n".join(lines)


def detectar_variaciones_precio(db_path=None, moneda: str = "$",
                                 umbral_pct: float = 5.0) -> str:
    """
    Compara último precio de compra vs anterior por producto.
    Si varió ≥ umbral_pct → alerta + sugerencia de ajuste de precio de venta.
    """
    db = _db(db_path)
    variaciones = db.get_variaciones_precio_recientes(dias=30)
    if not variaciones:
        return ""

    lines = ["📊 *Tomás — Variaciones de precio (últimos 30 días):*\n"]
    ajustes = []

    for v in variaciones:
        if abs(v["variacion_pct"]) < umbral_pct:
            continue
        icon = "🔴" if v["variacion_pct"] > 0 else "🟢"
        signo = "+" if v["variacion_pct"] > 0 else ""
        lines.append(
            f"  {icon} *{v['name']}*: {moneda}{v['precio_ant']:.2f} → "
            f"{moneda}{v['precio_nuevo']:.2f} ({signo}{v['variacion_pct']:.1f}%)"
        )
        if v["variacion_pct"] > 0:
            ajustes.append(v["name"])

    if not ajustes:
        return ""

    lines.append(
        f"\n💡 *Acción recomendada:* revisa precios de servicios que usan "
        + ", ".join(ajustes[:3])
        + ". Escribe `/margen [servicio]` para recalcular."
    )
    return "\n".join(lines)


def alerta_variacion_en_recepcion(part_id: int, precio_nuevo: float,
                                   db_path=None, moneda: str = "$") -> str:
    """
    Llamada por el flujo de recepción inmediatamente después de registrar ENTRADA.
    Retorna alerta si el precio cambió vs la entrada anterior.
    Retorna "" si no hay cambio significativo.
    """
    db = _db(db_path)
    hist = db.get_historial_precios(part_id, limit=2)
    if len(hist) < 2:
        return ""
    precio_ant = hist[1]["price_at_tx"]
    if not precio_ant or precio_ant == 0:
        return ""
    variacion_pct = ((precio_nuevo - precio_ant) / precio_ant) * 100
    if abs(variacion_pct) < 3:
        return ""

    prod = db.get_margen_producto(part_id)
    nombre = prod["name"] if prod else f"Producto {part_id}"
    icon = "🔴" if variacion_pct > 0 else "🟢"
    signo = "+" if variacion_pct > 0 else ""
    msg = (
        f"{icon} *{nombre}* cambió de precio: "
        f"{moneda}{precio_ant:.2f} → {moneda}{precio_nuevo:.2f} "
        f"({signo}{variacion_pct:.1f}%)"
    )
    if variacion_pct > 0:
        msg += "\n  ↳ Revisa el precio de los servicios que lo usan."
    return msg


def reporte_tomas(umbral: float = _MARGEN_MINIMO_DEFAULT, db_path=None, moneda: str = "$") -> str:
    """Reporte rápido para Donna: quién está ganando y quién perdiendo."""
    ranking = ranking_margenes(db_path)
    if not ranking:
        return "💰 Tomás: no hay productos con precios configurados aún."

    buenos  = [p for p in ranking if p.get("margen_pct", 0) >= umbral][:3]
    malos   = [p for p in ranking if p.get("margen_pct", 0) < umbral]

    lines = ["💰 *Tomás — Reporte de márgenes:*\n"]
    if buenos:
        lines.append("✅ Mejor margen:")
        for p in buenos:
            lines.append(f"  • {p['name']}: {p['margen_pct']:.1f}% ({moneda}{p['margen_pesos']:.2f}/u)")
    if malos:
        lines.append(f"\n⚠️ Bajo {umbral:.0f}% — revisar precio:")
        for p in malos:
            lines.append(f"  • {p['name']}: {p['margen_pct']:.1f}%")
    return "\n".join(lines)
