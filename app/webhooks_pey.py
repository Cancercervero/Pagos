"""Webhook de pey: firma sobre el cuerpo crudo, y un pago solo entra una vez."""

import base64
import hashlib
import hmac
import json
import logging
import time

from app import pey
from app.config import env, webhook_inseguro
from app.db import ahora_iso, conectar, fila, transaccion
from app.departamentos import citas, facturas
from app.departamentos.almacen import salida_por_cotizacion
from app.departamentos.apartado import apartar_en_tx
from app.dinero import fmt_mxn, pesos_a_centavos
from app.personas import duenos, por_id

logger = logging.getLogger("webhooks_pey")

TIPOS = {
    "codi.pn.payment_received",
    "codi.qr.payment_received",
    "payment_link.paid",
    "payment_link.updated",
}


def verificar_firma(secret: str, headers, body: bytes, tolerancia_s: int = 300) -> bool:
    if webhook_inseguro():
        logger.warning("PEY_WEBHOOK_INSECURE=1: la firma NO se está verificando. Solo en local.")
        return True
    msg_id = _h(headers, "webhook-id")
    ts = _h(headers, "webhook-timestamp")
    firmas = _h(headers, "webhook-signature")
    if not (msg_id and ts and firmas and secret):
        return False
    try:
        if abs(time.time() - int(ts)) > tolerancia_s:
            return False
        llave = base64.b64decode(secret.removeprefix("whsec_"))
        esperado = base64.b64encode(hmac.new(llave, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    except Exception:
        logger.exception("no pude calcular la firma")
        return False
    for f in firmas.split(" "):
        version, _, valor = f.partition(",")
        if version == "v1" and hmac.compare_digest(valor, esperado):
            return True
    return _verificar_sdk(secret, headers, body)


def _verificar_sdk(secret: str, headers, body: bytes) -> bool:
    try:
        from standardwebhooks import Webhook
    except Exception:
        return False
    try:
        Webhook(secret).verify(body, dict(headers))
        return True
    except Exception:
        return False


def _h(headers, nombre: str) -> str | None:
    if headers is None:
        return None
    valor = headers.get(nombre)
    if valor:
        return valor
    return headers.get(nombre.lower())


async def procesar_webhook(body: bytes, headers) -> tuple[int, list[dict]]:
    secret = env("PEY_WEBHOOK_SECRET")
    if not verificar_firma(secret, headers, body):
        logger.warning("firma de pey rechazada")
        return 401, []
    try:
        data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return 400, []
    wid = _h(headers, "webhook-id") or ""
    if not wid:
        return 400, []
    with conectar() as conn:
        if conn.execute("SELECT 1 FROM webhook_eventos WHERE webhook_id=?", (wid,)).fetchone():
            return 200, []
    tipo = data.get("type") or ""
    if tipo not in TIPOS and "payment" not in tipo:
        _marcar_evento(wid)
        return 200, []
    tid = data.get("transactionId")
    if not tid:
        _marcar_evento(wid)
        return 200, []
    try:
        tx = await pey.obtener_transaccion(tid)
    except pey.PeyError as exc:
        logger.error("no confirmé %s requestId=%s", tid, exc.request_id)
        return 500, []
    if tx.get("status") != "PAID":
        return 200, []
    monto_tx = pesos_a_centavos(tx.get("amount") or 0)
    if "amount" in data and abs(pesos_a_centavos(data.get("amount") or 0) - monto_tx) > 1:
        logger.error("monto del webhook no coincide con GET /transaction/%s", tid)
        _marcar_evento(wid)
        return 200, []
    with transaccion() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO webhook_eventos (webhook_id, recibido_en) VALUES (?, ?)",
            (wid, ahora_iso()),
        )
        if cur.rowcount == 0:
            return 200, []
        cobro = buscar_cobro(conn, data, tx)
        resultado = aplicar_pago_en_tx(conn, transaction_id=tid, monto_centavos=monto_tx, tipo_evento=tipo, payload=data, cobro=cobro)
    return 200, resultado["mensajes"]


async def procesar_transaccion_confirmada(tx: dict, tipo_evento: str, extra: dict | None = None) -> list[dict]:
    """La misma aplicación idempotente, para cuando el webhook no llegó."""
    if tx.get("status") != "PAID":
        return []
    tid = tx.get("id") or tx.get("transactionId")
    if not tid:
        return []
    data = {
        "transactionId": tid,
        "amount": tx.get("amount"),
        "type": tipo_evento,
        "metadata": tx.get("metadata") or {},
        "codiQrId": (extra or {}).get("codiQrId"),
    }
    with transaccion() as conn:
        cobro = buscar_cobro(conn, data, tx)
        resultado = aplicar_pago_en_tx(
            conn,
            transaction_id=tid,
            monto_centavos=pesos_a_centavos(tx.get("amount") or 0),
            tipo_evento=tipo_evento,
            payload=data,
            cobro=cobro,
        )
    return resultado["mensajes"]


def buscar_cobro(conn, data: dict, tx: dict):
    tid = data.get("transactionId") or tx.get("id")
    row = conn.execute("SELECT * FROM cobros WHERE pey_transaction_id=?", (tid,)).fetchone()
    if row:
        return row
    qrid = data.get("codiQrId")
    if not qrid and tx.get("payableType") == "API_CODI_QR":
        qrid = tx.get("payableId")
    if qrid:
        row = conn.execute("SELECT * FROM cobros WHERE pey_qr_id=?", (qrid,)).fetchone()
        if row:
            return row
    cid = _cobro_id_meta(data.get("metadata")) or _cobro_id_meta(tx.get("metadata"))
    if cid:
        row = conn.execute("SELECT * FROM cobros WHERE id=?", (cid,)).fetchone()
        if row:
            return row
    return None


def aplicar_pago_en_tx(conn, *, transaction_id: str, monto_centavos: int, tipo_evento: str, payload: dict, cobro) -> dict:
    cobro_id = cobro["id"] if cobro is not None else None
    cur = conn.execute(
        """INSERT OR IGNORE INTO pagos
           (pey_transaction_id, cobro_id, monto_centavos, tipo_evento, payload_json, recibido_en)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (transaction_id, cobro_id, monto_centavos, tipo_evento, json.dumps(payload, ensure_ascii=False), ahora_iso()),
    )
    if cur.rowcount == 0:
        return {"nuevo": False, "mensajes": []}
    pago_id = cur.lastrowid
    mensajes: list[dict] = []
    if cobro is None:
        _ingreso(conn, monto_centavos, f"Pago sin conciliar {transaction_id}", pago_id, "sin_conciliar")
        _avisar_duenos(conn, mensajes, f"⚠️ Llegó un pago de {fmt_mxn(monto_centavos)} sin cobro asociado ({transaction_id}).")
        return {"nuevo": True, "mensajes": mensajes, "pago_id": pago_id}

    era_expirado = cobro["estado"] == "expirado"
    ya_pagado = cobro["estado"] == "pagado"
    esperado = int(cobro["monto_centavos"])
    parcial = esperado > 0 and monto_centavos + 1 < esperado
    if not ya_pagado:
        conn.execute(
            "UPDATE cobros SET estado='pagado', pagado_en=?, pago_tardio=? WHERE id=?",
            (ahora_iso(), 1 if era_expirado else 0, cobro["id"]),
        )
    _ingreso(conn, monto_centavos, cobro["concepto"], pago_id, cobro["tipo"])

    excedente = 0
    cita = None
    folio = ""
    liquidada = False
    surtir: list[str] = []
    if cobro["cotizacion_id"]:
        cot = conn.execute("SELECT * FROM cotizaciones WHERE id=?", (cobro["cotizacion_id"],)).fetchone()
        folio = cot["folio"]
        nuevo = cot["pagado_centavos"] + monto_centavos
        estado = cot["estado"]
        if not parcial and not ya_pagado and cobro["tipo"] == "anticipo":
            estado = "anticipo_pagado"
        if nuevo >= cot["total_centavos"]:
            excedente = nuevo - cot["total_centavos"]
            estado = "liquidada"
        elif ya_pagado or (esperado > 0 and monto_centavos > esperado + 1):
            excedente = max(0, nuevo - cot["total_centavos"])
        conn.execute(
            "UPDATE cotizaciones SET pagado_centavos=?, estado=? WHERE id=?",
            (nuevo, estado, cot["id"]),
        )
        if estado == "liquidada":
            liquidada = True
            facturas.generar_para_cotizacion(conn, dict(conn.execute("SELECT * FROM cotizaciones WHERE id=?", (cot["id"],)).fetchone()))
        if cobro["tipo"] == "anticipo" and not parcial and not ya_pagado and not era_expirado:
            cita = citas.confirmar_por_cotizacion(conn, cot["id"])
        elif era_expirado:
            cita = fila(conn.execute("SELECT * FROM citas WHERE cotizacion_id=? ORDER BY id DESC LIMIT 1", (cot["id"],)).fetchone())
        if not parcial and not ya_pagado:
            surtir = salida_por_cotizacion(conn, dict(cot))
        else:
            surtir = []
        nota_sat = apartar_en_tx(conn, pago_id, monto_centavos, dict(cot))
        from app.db import anotar_consumo

        anotar_consumo(conn, cobro["contacto_id"], dict(cot))
    else:
        nota_sat = apartar_en_tx(conn, pago_id, monto_centavos, None)

    contacto = por_id(cobro["contacto_id"])
    nombre = (contacto or {}).get("nombre") or (contacto or {}).get("telefono10") or "Alguien"
    cuando = cita["inicio"] if cita else ""
    if contacto:
        texto = f"✅ Recibimos tu pago de {fmt_mxn(monto_centavos)}."
        if cita and cita["estado"] == "confirmada":
            texto += f" Tu cita del {cuando} ya está en tu agenda."
            texto += " La autorización fue en tu banca; si pidió Face ID o huella, fue ahí."
        elif era_expirado:
            texto += " Llegó después de que el cobro expiró; el negocio te confirma el horario."
        elif parcial:
            texto += " Quedó como abono. El saldo sigue pendiente."
        if liquidada:
            texto += " Te preparo la factura en borrador (timbrado simulado, requiere PAC y CSD)."
        _mensaje(conn, contacto["id"], texto)
        mensajes.append({"telefono10": contacto["telefono10"], "texto": texto, "documento": _doc_factura(conn, cobro) if liquidada else None})
    aviso = f"💰 {nombre} pagó {fmt_mxn(monto_centavos)}"
    if folio:
        aviso += f" ({cobro['tipo']} {folio})"
    if era_expirado:
        aviso += ". Llegó tarde."
        if cita and cita["estado"] == "expirada":
            aviso += " La cita ya se había liberado: tú decides si la recuperas."
    if parcial:
        aviso += ". Fue un abono, no cubre el cobro completo."
    if excedente > 0 or ya_pagado:
        aviso += f" Hay excedente; quedó como saldo a favor ({fmt_mxn(excedente or monto_centavos)})."
    if surtir:
        aviso += " " + " ".join(surtir)
    if nota_sat:
        aviso += " " + nota_sat
    _avisar_duenos(conn, mensajes, aviso)
    return {"nuevo": True, "mensajes": mensajes, "pago_id": pago_id}


def _doc_factura(conn, cobro) -> dict | None:
    if not cobro["cotizacion_id"]:
        return None
    fac = conn.execute("SELECT * FROM facturas WHERE cotizacion_id=?", (cobro["cotizacion_id"],)).fetchone()
    if not fac:
        return None
    from app.departamentos.facturas import url_pdf

    url = url_pdf(dict(fac))
    if not url:
        return None
    return {"url": url, "filename": fac["pdf_path"]}


def _ingreso(conn, monto, concepto, pago_id, categoria) -> None:
    conn.execute(
        """INSERT INTO movimientos (tipo, monto_centavos, concepto, categoria, pago_id, con_factura, fecha)
           VALUES ('ingreso', ?, ?, ?, ?, 0, ?)""",
        (monto, concepto, categoria, pago_id, ahora_iso()),
    )


def _avisar_duenos(conn, mensajes: list, texto: str) -> None:
    for dueno in duenos():
        _mensaje(conn, dueno["id"], texto)
        mensajes.append({"telefono10": dueno["telefono10"], "texto": texto})


def _mensaje(conn, contacto_id: int, texto: str) -> None:
    conn.execute(
        "INSERT INTO mensajes (contacto_id, rol, contenido, creado_en) VALUES (?, 'assistant', ?, ?)",
        (contacto_id, texto, ahora_iso()),
    )


def _marcar_evento(wid: str) -> None:
    with transaccion() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO webhook_eventos (webhook_id, recibido_en) VALUES (?, ?)",
            (wid, ahora_iso()),
        )


def _cobro_id_meta(meta) -> int | None:
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            return None
    if not isinstance(meta, dict):
        return None
    cid = meta.get("cobro_id")
    ext = meta.get("externalMetadata")
    if cid is None and isinstance(ext, dict):
        cid = ext.get("cobro_id")
    if cid is None or cid == "":
        return None
    try:
        return int(cid)
    except (TypeError, ValueError):
        return None
