"""Cobros CoDi. Este módulo crea el cargo; solo el webhook lo marca pagado."""

import logging
from datetime import datetime, timedelta, timezone

from app import pey
from app.config import negocio, publico
from app.db import ahora_iso, conectar, fila, transaccion
from app.dinero import centavos_a_pesos, fmt_mxn
from app import personas

logger = logging.getLogger("cobranza")


async def crear_cobro(
    tipo: str,
    metodo: str,
    monto_centavos: int,
    contacto_id: int,
    cotizacion_id: int | None = None,
    concepto: str = "Cobro",
    expiration: int | None = None,
    simular: bool = False,
) -> dict:
    if monto_centavos < 0:
        raise ValueError("El monto no puede ser negativo.")
    # Tope de desarrollo: ninguna transacción sale por más de $0.01.
    if monto_centavos > 1:
        monto_centavos = 1
    if metodo == "push" and monto_centavos <= 0:
        raise ValueError("El push necesita un monto mayor a cero.")
    contacto = personas.por_id(contacto_id)
    if not contacto:
        raise ValueError("No encontré a esa persona.")
    neg = negocio()
    exp = int(expiration if expiration is not None else neg.get("expiracion_cobro_s", 360))
    if metodo == "push":
        exp = max(360, exp)
    if metodo == "qr" and exp != 0:
        exp = max(360, exp)
    creado = datetime.now(timezone.utc).replace(microsecond=0)
    expira = (creado + timedelta(seconds=exp)).isoformat() if exp else None
    if simular:
        with transaccion() as conn:
            cur = conn.execute(
                """INSERT INTO cobros
                   (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, estado, expira_en, creado_en)
                   VALUES (?, ?, ?, 'simulacion', ?, ?, 'pendiente', ?, ?)""",
                (cotizacion_id, contacto_id, tipo, monto_centavos, concepto, expira, ahora_iso()),
            )
            return fila(conn.execute("SELECT * FROM cobros WHERE id=?", (cur.lastrowid,)).fetchone())
    with transaccion() as conn:
        cur = conn.execute(
            """INSERT INTO cobros
               (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, estado, expira_en, creado_en)
               VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)""",
            (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, expira, ahora_iso()),
        )
        cobro_id = cur.lastrowid
    num_ref = str(cobro_id)[-7:]
    metadata = {"cobro_id": str(cobro_id)}
    pesos = centavos_a_pesos(monto_centavos)
    try:
        if metodo == "push":
            resp = await pey.crear_push(pesos, contacto["telefono10"], concepto, exp, num_ref, metadata)
            campos = {
                "pey_transaction_id": resp.get("transactionId"),
                "pey_codi_id": resp.get("codiId"),
            }
        elif metodo == "qr":
            resp = await pey.crear_qr(pesos, concepto, exp, num_ref, metadata)
            campos = {"pey_qr_id": resp.get("id"), "qr_string": resp.get("qrString")}
        elif metodo == "link":
            base = publico() or "https://localhost"
            resp = await pey.crear_link(pesos, f"{base}/gracias", f"{base}/", f"cobro-{cobro_id}", metadata)
            campos = {"pey_link_id": resp.get("id"), "link_url": resp.get("url")}
        else:
            raise ValueError("Método de cobro desconocido.")
    except pey.PeyError as exc:
        with transaccion() as conn:
            conn.execute("UPDATE cobros SET estado='fallido' WHERE id=?", (cobro_id,))
        logger.error("cobro %s falló requestId=%s", cobro_id, exc.request_id)
        raise
    sets = ", ".join(f"{k}=?" for k in campos)
    with transaccion() as conn:
        conn.execute(f"UPDATE cobros SET {sets} WHERE id=?", (*campos.values(), cobro_id))
        return fila(conn.execute("SELECT * FROM cobros WHERE id=?", (cobro_id,)).fetchone())


def cancelar(cobro_id: int) -> None:
    with transaccion() as conn:
        conn.execute(
            "UPDATE cobros SET estado='cancelado' WHERE id=? AND estado='pendiente'",
            (cobro_id,),
        )


def cobro_por_id(cobro_id: int) -> dict | None:
    with conectar() as conn:
        return fila(conn.execute("SELECT * FROM cobros WHERE id=?", (cobro_id,)).fetchone())


def texto_cobro_cliente(cobro: dict) -> str:
    minutos = _minutos(cobro)
    monto = fmt_mxn(cobro["monto_centavos"])
    if cobro["metodo"] == "simulacion":
        return f"Tu banco muestra un cobro de {monto}. En esta mesa lo confirmas con Face ID, al lado."
    if cobro["metodo"] == "push":
        return f"Te llegó un cobro de {monto} a tu app bancaria. Tienes {minutos} minutos para autorizarlo."
    if cobro["metodo"] == "link" and cobro.get("link_url"):
        return f"Te dejo el link de pago por {monto}: {cobro['link_url']}"
    if cobro["metodo"] == "qr":
        base = publico()
        extra = f" {base}/qr/{cobro['id']}.png" if base else ""
        return f"Cobro QR por {monto}.{extra}"
    return f"Cobro de {monto} listo."


def _minutos(cobro: dict) -> int:
    if not cobro.get("expira_en") or not cobro.get("creado_en"):
        return 6
    try:
        exp = datetime.fromisoformat(cobro["expira_en"])
        creado = datetime.fromisoformat(cobro["creado_en"])
        return max(1, int((exp - creado).total_seconds() // 60))
    except ValueError:
        return 6
