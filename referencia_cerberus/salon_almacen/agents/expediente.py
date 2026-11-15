"""
expediente.py — Perfil y evolución de cada estilista.

Cada movimiento de Enzo guarda "estilista {user_id}" en la nota.
Expediente lee esas notas y construye el historial del chalán:
  - cuántos servicios hace, cuánto consume, cómo evoluciona mes a mes.
Admin puede ver a cualquiera. Estilista solo se ve a sí mismo.
"""
import logging
import re
import sqlite3
from datetime import datetime, timedelta

logger = logging.getLogger("Expediente")


def _db(db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def perfil_estilista(user_id: str, db_path=None, dias: int = 30) -> dict:
    """Stats del estilista en los últimos N días."""
    db = _db(db_path)
    movs = db.get_movimientos_estilista(user_id, dias)

    if not movs:
        return {
            "user_id": user_id, "dias": dias,
            "servicios_realizados": 0, "tipos_servicio": [],
            "movimientos": 0, "costo_total": 0.0, "top_productos": [],
        }

    servicios = set()
    costo_total = 0.0
    producto_qty: dict[str, float] = {}

    for m in movs:
        svc = re.search(r'Servicio:\s*([^—\n]+)', m.get("notes", ""))
        if svc:
            servicios.add(svc.group(1).strip())
        costo_u = float(m.get("price_at_tx") or 0)
        qty = float(m.get("quantity") or 0)
        costo_total += costo_u * qty
        nombre_p = m.get("part_name", "?")
        producto_qty[nombre_p] = producto_qty.get(nombre_p, 0) + qty

    top = sorted(producto_qty.items(), key=lambda x: -x[1])[:5]

    return {
        "user_id": user_id,
        "dias": dias,
        "servicios_realizados": len(servicios),
        "tipos_servicio": sorted(servicios),
        "movimientos": len(movs),
        "costo_total": round(costo_total, 2),
        "top_productos": [{"nombre": n, "cantidad": round(q, 1)} for n, q in top],
    }


def evolucion_mensual(user_id: str, meses: int = 3, db_path=None) -> list[dict]:
    """Comparación mes a mes: servicios y costo consumido."""
    db_obj = _db(db_path)
    resultados = []

    for i in range(meses):
        desde_dt = datetime.now() - timedelta(days=(i + 1) * 30)
        hasta_dt = datetime.now() - timedelta(days=i * 30)
        desde = desde_dt.isoformat()
        hasta = hasta_dt.isoformat()

        conn = sqlite3.connect(db_obj.db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """SELECT tx.quantity, tx.price_at_tx, tx.notes
               FROM inventory_tx tx
               JOIN stock_items si ON tx.stock_item_id = si.id
               WHERE tx.tx_type='SALIDA'
                 AND tx.notes LIKE ?
                 AND tx.tx_date >= ? AND tx.tx_date < ?""",
            (f"%estilista {user_id}%", desde, hasta)
        ).fetchall()
        conn.close()

        costo = sum(float(r["price_at_tx"] or 0) * float(r["quantity"] or 0) for r in rows)
        servicios: set[str] = set()
        for r in rows:
            svc = re.search(r'Servicio:\s*([^—\n]+)', r["notes"] or "")
            if svc:
                servicios.add(svc.group(1).strip())

        resultados.append({
            "mes": desde_dt.strftime("%b %Y"),
            "servicios": len(servicios),
            "movimientos": len(rows),
            "costo_consumido": round(costo, 2),
        })

    return list(reversed(resultados))  # más antiguo primero


def top_estilistas(db_path=None, dias: int = 30) -> list[dict]:
    """Ranking: quién hace más servicios en el período."""
    db = _db(db_path)
    ids = db.get_todos_estilistas(dias)
    perfiles = [perfil_estilista(uid, db_path, dias) for uid in ids]
    return sorted(perfiles, key=lambda x: -x["servicios_realizados"])


def reporte_estilista(user_id: str, db_path=None, moneda: str = "$") -> str:
    """Reporte formateado para Telegram."""
    perfil = perfil_estilista(user_id, db_path, dias=30)
    evol = evolucion_mensual(user_id, meses=3, db_path=db_path)

    if perfil["servicios_realizados"] == 0 and perfil["movimientos"] == 0:
        return "📋 Sin servicios registrados en los últimos 30 días."

    lines = [f"💇 *Expediente — Estilista {user_id}*\n"]
    lines.append(f"  Servicios (30d): *{perfil['servicios_realizados']}*")
    lines.append(f"  Movimientos de stock: {perfil['movimientos']}")
    lines.append(f"  Costo consumido: {moneda}{perfil['costo_total']:.2f}")

    if perfil["tipos_servicio"]:
        lines.append(f"  Servicios: _{', '.join(perfil['tipos_servicio'])}_")

    if perfil["top_productos"]:
        lines.append("\n📦 *Más usa:*")
        for p in perfil["top_productos"][:3]:
            lines.append(f"  • {p['nombre']}: {p['cantidad']:.1f} u")

    tiene_datos = any(e["movimientos"] > 0 for e in evol)
    if tiene_datos and len(evol) > 1:
        lines.append("\n📈 *Evolución:*")
        for e in evol:
            barra = "▓" * min(e["servicios"], 10)
            lines.append(f"  {e['mes']}: {barra} {e['servicios']} servicios · {moneda}{e['costo_consumido']:.2f}")

    return "\n".join(lines)


def reporte_top(db_path=None, moneda: str = "$") -> str:
    """Ranking de estilistas para el admin."""
    ranking = top_estilistas(db_path, dias=30)
    if not ranking:
        return "📋 Sin movimientos de estilistas registrados este mes."

    lines = ["🏆 *Top estilistas (30d):*\n"]
    for i, p in enumerate(ranking[:8], 1):
        lines.append(
            f"  {i}. ID {p['user_id']}: "
            f"{p['servicios_realizados']} servicios · "
            f"{moneda}{p['costo_total']:.2f} consumido"
        )
    return "\n".join(lines)
