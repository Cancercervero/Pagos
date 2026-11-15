"""Cada 30 segundos: recordatorio, expiración y webhooks que no llegaron."""

import asyncio
import logging
from datetime import datetime, timezone

from app import pey, webhooks_pey
from app.db import ahora_iso, conectar, filas, transaccion
from app.departamentos import citas
from app.dinero import fmt_mxn
from app.personas import duenos, por_id
from app.whatsapp import despachar

logger = logging.getLogger("tareas")


async def loop() -> None:
    while True:
        try:
            await ciclo()
        except Exception:
            logger.exception("ciclo de cobranza")
        await asyncio.sleep(30)


async def ciclo() -> None:
    with conectar() as conn:
        pendientes = filas(conn.execute("SELECT * FROM cobros WHERE estado='pendiente'").fetchall())
    ahora = datetime.now(timezone.utc)
    for cobro in pendientes:
        await _recordatorio(cobro, ahora)
        await _vencer_o_conciliar(cobro, ahora)


async def _recordatorio(cobro: dict, ahora: datetime) -> None:
    if cobro["recordatorios_enviados"]:
        return
    exp = _parse(cobro.get("expira_en"))
    creado = _parse(cobro.get("creado_en"))
    if not exp or not creado or ahora >= exp:
        return
    mitad = creado + (exp - creado) / 2
    if ahora < mitad:
        return
    with transaccion() as conn:
        cur = conn.execute(
            "UPDATE cobros SET recordatorios_enviados=1 WHERE id=? AND recordatorios_enviados=0 AND estado='pendiente'",
            (cobro["id"],),
        )
        if cur.rowcount == 0:
            return
        contacto = por_id(cobro["contacto_id"])
        minutos = max(1, int((exp - ahora).total_seconds() // 60))
        texto = f"Tu cobro de {fmt_mxn(cobro['monto_centavos'])} vence en {minutos} min."
        mensajes = []
        if contacto:
            conn.execute(
                "INSERT INTO mensajes (contacto_id, rol, contenido, creado_en) VALUES (?, 'assistant', ?, ?)",
                (contacto["id"], texto, ahora_iso()),
            )
            mensajes.append({"telefono10": contacto["telefono10"], "texto": texto})
    await despachar(mensajes)


async def _vencer_o_conciliar(cobro: dict, ahora: datetime) -> None:
    exp = _parse(cobro.get("expira_en"))
    if exp and ahora < exp:
        return
    if not exp and cobro["metodo"] != "qr":
        return
    pagado = await _buscar_pagado(cobro)
    if pagado:
        mensajes = await webhooks_pey.procesar_transaccion_confirmada(
            pagado["tx"], pagado["tipo"], {"codiQrId": cobro.get("pey_qr_id")}
        )
        await despachar(mensajes)
        return
    await _expirar(cobro)


async def _buscar_pagado(cobro: dict) -> dict | None:
    try:
        if cobro.get("pey_transaction_id"):
            tx = await pey.obtener_transaccion(cobro["pey_transaction_id"])
            if tx.get("status") == "PAID":
                return {"tx": tx, "tipo": "reconciliacion"}
            return None
        if cobro.get("pey_qr_id"):
            data = await pey.transacciones_qr(cobro["pey_qr_id"])
            for item in data.get("items") or []:
                if item.get("status") == "PAID":
                    return {"tx": item, "tipo": "codi.qr.payment_received"}
            return None
        if cobro.get("pey_link_id"):
            link = await pey.obtener_link(cobro["pey_link_id"])
            for item in link.get("transactions") or []:
                if item.get("transactionId"):
                    tx = {
                        "id": item["transactionId"],
                        "status": "PAID",
                        "amount": item.get("amount") or link.get("amount"),
                        "metadata": link.get("metadata") or {},
                    }
                    return {"tx": tx, "tipo": "payment_link.paid"}
    except pey.PeyError as exc:
        logger.error("reconciliación cobro %s requestId=%s", cobro["id"], exc.request_id)
    return None


async def _expirar(cobro: dict) -> None:
    with transaccion() as conn:
        cur = conn.execute(
            "UPDATE cobros SET estado='expirado' WHERE id=? AND estado='pendiente'",
            (cobro["id"],),
        )
        if cur.rowcount == 0:
            return
        if cobro.get("cotizacion_id") and cobro["tipo"] == "anticipo":
            citas.expirar_por_cotizacion(conn, cobro["cotizacion_id"])
        contacto = por_id(cobro["contacto_id"])
        texto_cliente = f"El cobro de {fmt_mxn(cobro['monto_centavos'])} venció sin pago. Si quieres, pídeme que te lo reenvíe."
        mensajes = []
        if contacto:
            conn.execute(
                "INSERT INTO mensajes (contacto_id, rol, contenido, creado_en) VALUES (?, 'assistant', ?, ?)",
                (contacto["id"], texto_cliente, ahora_iso()),
            )
            mensajes.append({"telefono10": contacto["telefono10"], "texto": texto_cliente})
        quien = (contacto or {}).get("nombre") or (contacto or {}).get("telefono10") or "un cliente"
        aviso = f"El cobro de {fmt_mxn(cobro['monto_centavos'])} para {quien} expiró sin pago."
        for dueno in duenos():
            conn.execute(
                "INSERT INTO mensajes (contacto_id, rol, contenido, creado_en) VALUES (?, 'assistant', ?, ?)",
                (dueno["id"], aviso, ahora_iso()),
            )
            mensajes.append({"telefono10": dueno["telefono10"], "texto": aviso})
    await despachar(mensajes)


def _parse(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        dt = datetime.fromisoformat(valor)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
