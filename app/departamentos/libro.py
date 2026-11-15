"""Libro: ingresos los escribe el webhook; gastos y devoluciones los registra el dueño."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import negocio
from app.db import ahora_iso, conectar, filas, transaccion
from app.dinero import fmt_mxn, pesos_a_centavos


def registrar_gasto(monto_pesos: float, concepto: str, categoria: str | None = None, con_factura: bool = False) -> dict:
    centavos = pesos_a_centavos(monto_pesos)
    if centavos <= 0:
        raise ValueError("El gasto tiene que ser mayor a cero.")
    with transaccion() as conn:
        cur = conn.execute(
            """INSERT INTO movimientos (tipo, monto_centavos, concepto, categoria, con_factura, fecha)
               VALUES ('gasto', ?, ?, ?, ?, ?)""",
            (centavos, concepto.strip(), categoria, 1 if con_factura else 0, ahora_iso()),
        )
        row = conn.execute("SELECT * FROM movimientos WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


def registrar_devolucion(pago_id: int, monto_pesos: float, motivo: str) -> dict:
    centavos = pesos_a_centavos(monto_pesos)
    if centavos <= 0:
        raise ValueError("La devolución tiene que ser mayor a cero.")
    with transaccion() as conn:
        pago = conn.execute("SELECT * FROM pagos WHERE id=?", (pago_id,)).fetchone()
        if not pago:
            raise ValueError("No encontré ese pago.")
        if centavos > pago["monto_centavos"]:
            raise ValueError("La devolución no puede ser mayor que el pago.")
        cur = conn.execute(
            """INSERT INTO movimientos (tipo, monto_centavos, concepto, categoria, pago_id, con_factura, fecha)
               VALUES ('devolucion', ?, ?, 'devolucion', ?, 0, ?)""",
            (centavos, motivo.strip(), pago_id, ahora_iso()),
        )
        row = conn.execute("SELECT * FROM movimientos WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


def resumen(periodo: str = "mes") -> dict:
    desde = _desde(periodo)
    with conectar() as conn:
        movs = filas(conn.execute("SELECT * FROM movimientos WHERE fecha>=?", (desde,)).fetchall())
        por_cobrar = conn.execute(
            """SELECT COALESCE(SUM(total_centavos - pagado_centavos), 0) AS c
               FROM cotizaciones
               WHERE estado IN ('enviada', 'aceptada', 'anticipo_pagado')
                 AND total_centavos > pagado_centavos"""
        ).fetchone()["c"]
    cobrado = sum(m["monto_centavos"] for m in movs if m["tipo"] == "ingreso")
    gastos = sum(m["monto_centavos"] for m in movs if m["tipo"] == "gasto")
    devoluciones = sum(m["monto_centavos"] for m in movs if m["tipo"] == "devolucion")
    apartado = sum(m["monto_centavos"] for m in movs if m["tipo"] in {"apartado_iva", "apartado_isr"})
    return {
        "periodo": periodo,
        "desde": desde,
        "cobrado_centavos": cobrado,
        "gastos_centavos": gastos,
        "devoluciones_centavos": devoluciones,
        "apartado_centavos": apartado,
        "disponible_centavos": cobrado - gastos - devoluciones - apartado,
        "utilidad_centavos": cobrado - gastos - devoluciones,
        "por_cobrar_centavos": int(por_cobrar),
        "movimientos": movs,
    }


def texto_resumen(datos: dict) -> str:
    nombre = {"hoy": "Hoy", "semana": "Esta semana", "mes": "Este mes"}.get(datos["periodo"], datos["periodo"])
    return "\n".join(
        [
            f"{nombre}:",
            f"Cobrado: {fmt_mxn(datos['cobrado_centavos'])}",
            f"Por cobrar: {fmt_mxn(datos['por_cobrar_centavos'])}",
            f"Gastos: {fmt_mxn(datos['gastos_centavos'])}",
            f"Apartado SAT (estimación): {fmt_mxn(datos.get('apartado_centavos', 0))}",
            f"Puedes usar: {fmt_mxn(datos.get('disponible_centavos', datos['utilidad_centavos']))}",
            f"Devoluciones: {fmt_mxn(datos['devoluciones_centavos'])}",
            f"Utilidad: {fmt_mxn(datos['utilidad_centavos'])}",
        ]
    )


def cuentas_por_cobrar() -> str:
    with conectar() as conn:
        rows = conn.execute(
            """SELECT q.folio, q.total_centavos, q.pagado_centavos, c.nombre, c.telefono10
               FROM cotizaciones q JOIN contactos c ON c.id=q.contacto_id
               WHERE q.estado IN ('enviada', 'aceptada', 'anticipo_pagado')
                 AND q.total_centavos > q.pagado_centavos
               ORDER BY q.id"""
        ).fetchall()
    if not rows:
        return "Nadie tiene saldo pendiente."
    lineas = ["Por cobrar:"]
    for r in rows:
        quien = r["nombre"] or r["telefono10"]
        lineas.append(f"• {quien} — {r['folio']} — {fmt_mxn(r['total_centavos'] - r['pagado_centavos'])}")
    return "\n".join(lineas)


def _desde(periodo: str) -> str:
    tz = ZoneInfo(negocio().get("zona_horaria", "America/Mexico_City"))
    ahora = datetime.now(tz)
    if periodo == "hoy":
        inicio = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "semana":
        inicio = (ahora - timedelta(days=ahora.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        inicio = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return inicio.astimezone(ZoneInfo("UTC")).replace(microsecond=0).isoformat()
