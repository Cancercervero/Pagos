"""
Verónica — Vendedora y Auditora del Salón.

Observadora y detallista. Rastrea patrones de uso por estilista y por servicio.
Detecta anomalías: ¿por qué esta semana se usó el doble de tinte?
¿Alguna estilista consume más de lo normal? ¿Hay merma sospechosa?
También audita que las salidas registradas cuadren con los servicios del día.
"""
import logging
from datetime import datetime, timedelta
from host_engine.cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("Veronica")

_PERSONALIDAD = (
    "Soy Verónica. Veo todo lo que pasa en el salón con los productos. "
    "Si algo no cuadra, lo encuentro. No acuso sin datos, pero los datos no mienten."
)

_PROMPT_ANALISIS = """Eres Verónica, auditora de un salón de belleza. Eres observadora y analítica.
Analiza estos movimientos de inventario y detecta patrones inusuales.
Busca: consumo excesivo, mermas frecuentes, productos que nunca se usan, inconsistencias.
Responde en español, directo y con datos concretos. Máximo 5 puntos."""


def _db(db_path=None) -> AlmacenDB:
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def auditar_periodo(dias: int = 7, db_path=None) -> str:
    """Verónica analiza los movimientos del período y detecta anomalías."""
    db = _db(db_path)
    flujo = db.get_flujo_periodo(dias=dias)

    desde = (datetime.now() - timedelta(days=dias)).isoformat()
    conn = db._conn()
    movimientos = conn.execute("""
        SELECT tx.tx_type, tx.quantity, tx.tx_date, tx.notes,
               p.name as producto
        FROM inventory_tx tx
        JOIN stock_items si ON si.id = tx.stock_item_id
        JOIN parts p ON p.id = si.part_id
        WHERE tx.tx_date >= ?
        ORDER BY tx.tx_date DESC
        LIMIT 100
    """, (desde,)).fetchall()
    conn.close()

    if not movimientos:
        return "🔍 Verónica: sin movimientos en el período. Nada que auditar."

    resumen_movs = "\n".join([
        f"{m['tx_date'][:10]} | {m['tx_type']} | {m['producto']} | {m['quantity']:.1f} | {m['notes'] or ''}"
        for m in movimientos
    ])

    try:
        from host_engine.cerberus_core.llm_router import ask_llm
        analisis = ask_llm(
            f"Movimientos últimos {dias} días:\n{resumen_movs}",
            system=_PROMPT_ANALISIS,
            max_tokens=400
        )
    except Exception as e:
        analisis = f"[Verónica] No pude analizar: {e}"

    return (
        f"🔍 *Verónica — Auditoría {dias} días:*\n\n"
        f"{analisis}\n\n"
        f"_Entradas: {flujo['entradas_qty']:.0f} u | Salidas: {flujo['salidas_qty']:.0f} u_"
    )


def uso_por_producto(dias: int = 30, db_path=None) -> list[dict]:
    """Ranking de productos más consumidos en el período."""
    db = _db(db_path)
    desde = (datetime.now() - timedelta(days=dias)).isoformat()
    conn = db._conn()
    rows = conn.execute("""
        SELECT p.name, p.unit, COALESCE(SUM(tx.quantity),0) as total_usado
        FROM inventory_tx tx
        JOIN stock_items si ON si.id = tx.stock_item_id
        JOIN parts p ON p.id = si.part_id
        WHERE tx.tx_type = 'SALIDA' AND tx.tx_date >= ?
        GROUP BY p.id
        ORDER BY total_usado DESC
    """, (desde,)).fetchall()
    conn.close()
    return [{"nombre": r["name"], "unidad": r["unit"], "total": float(r["total_usado"])} for r in rows]


def reporte_veronica(dias: int = 7, db_path=None) -> str:
    """Reporte rápido para Donna."""
    uso = uso_por_producto(dias, db_path)
    if not uso:
        return f"🔍 Verónica: sin ventas/uso registrado en {dias} días."
    lines = [f"🔍 *Verónica — Top consumo {dias} días:*\n"]
    for i, p in enumerate(uso[:6], 1):
        lines.append(f"  {i}. {p['nombre']}: {p['total']:.1f} {p['unidad']}")
    return "\n".join(lines)
