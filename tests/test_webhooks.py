import json
from datetime import datetime, timedelta, timezone

import pytest

from tests.firma import firmar


def _cobro(transaction_id="TX1", monto=100, estado="pendiente", qr_id=None, cotizacion_id=None, tipo="libre"):
    from app.db import ahora_iso, transaccion

    with transaccion() as conn:
        conn.execute(
            "INSERT INTO contactos (telefono10, nombre, rol, acepto_privacidad, creado_en) VALUES ('5522222222','Cliente','cliente',1,?)",
            (ahora_iso(),),
        )
        cid = conn.execute("SELECT id FROM contactos WHERE telefono10='5522222222'").fetchone()["id"]
        conn.execute(
            """INSERT INTO cobros
               (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, estado, pey_transaction_id, pey_qr_id, creado_en)
               VALUES (?, ?, ?, 'push', ?, 'Prueba', ?, ?, ?, ?)""",
            (cotizacion_id, cid, tipo, monto, estado, transaction_id, qr_id, ahora_iso()),
        )
        return conn.execute("SELECT id FROM cobros ORDER BY id DESC LIMIT 1").fetchone()["id"]


def _pagado(monkeypatch, amount=1.0):
    async def fake(tid):
        return {"id": tid, "status": "PAID", "amount": amount, "metadata": {}}

    monkeypatch.setattr("app.pey.obtener_transaccion", fake)


def _contar(tabla, tipo=None):
    from app.db import conectar

    with conectar() as conn:
        if tipo:
            return conn.execute(f"SELECT COUNT(*) AS c FROM {tabla} WHERE tipo=?", (tipo,)).fetchone()["c"]
        return conn.execute(f"SELECT COUNT(*) AS c FROM {tabla}").fetchone()["c"]


def test_firma_valida_marca_pagado(client, monkeypatch):
    _cobro()
    _pagado(monkeypatch)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TX1", "amount": 1.0}).encode()
    r = client.post("/webhooks/pey", content=body, headers=firmar(body))
    assert r.status_code == 200
    from app.db import conectar

    with conectar() as conn:
        estado = conn.execute("SELECT estado FROM cobros WHERE pey_transaction_id='TX1'").fetchone()["estado"]
    assert estado == "pagado"
    assert _contar("movimientos", "ingreso") == 1


def test_firma_invalida_401(client, monkeypatch):
    _cobro()
    _pagado(monkeypatch)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TX1", "amount": 1.0}).encode()
    headers = firmar(body)
    headers["webhook-signature"] = "v1,aaaaaaaa"
    r = client.post("/webhooks/pey", content=body, headers=headers)
    assert r.status_code == 401
    assert _contar("movimientos") == 0
    assert _contar("pagos") == 0


def test_webhook_duplicado_no_repite(client, monkeypatch):
    _cobro()
    _pagado(monkeypatch)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TX1", "amount": 1.0}).encode()
    headers = firmar(body)
    assert client.post("/webhooks/pey", content=body, headers=headers).status_code == 200
    assert client.post("/webhooks/pey", content=body, headers=headers).status_code == 200
    assert _contar("movimientos", "ingreso") == 1
    assert _contar("pagos") == 1


def test_mismo_transaction_distinto_webhook(client, monkeypatch):
    _cobro()
    _pagado(monkeypatch)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TX1", "amount": 1.0}).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    assert _contar("movimientos", "ingreso") == 1
    assert _contar("pagos") == 1


def test_pago_tardio(client, monkeypatch):
    _cobro(estado="expirado")
    _pagado(monkeypatch)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TX1", "amount": 1.0}).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    from app.db import conectar

    with conectar() as conn:
        row = conn.execute("SELECT estado, pago_tardio FROM cobros WHERE pey_transaction_id='TX1'").fetchone()
    assert row["estado"] == "pagado"
    assert row["pago_tardio"] == 1


def test_segundo_pago_qr_es_excedente(client, monkeypatch):
    _cobro(transaction_id="TX1", qr_id="QR1", estado="pagado")
    from app.db import ahora_iso, transaccion

    with transaccion() as conn:
        conn.execute(
            """INSERT INTO pagos (pey_transaction_id, cobro_id, monto_centavos, tipo_evento, payload_json, recibido_en)
               VALUES ('TX1', 1, 100, 'codi.qr.payment_received', '{}', ?)""",
            (ahora_iso(),),
        )
    _pagado(monkeypatch, 1.0)
    body = json.dumps(
        {"type": "codi.qr.payment_received", "transactionId": "TX2", "amount": 1.0, "codiQrId": "QR1"}
    ).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    from app.db import conectar

    with conectar() as conn:
        textos = " ".join(r["contenido"] for r in conn.execute("SELECT contenido FROM mensajes").fetchall())
    assert _contar("pagos") == 2
    assert "saldo a favor" in textos


def test_pago_sin_conciliar(client, monkeypatch):
    _pagado(monkeypatch, 3.0)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "HUerfano", "amount": 3.0}).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    from app.db import conectar

    with conectar() as conn:
        pago = conn.execute("SELECT cobro_id FROM pagos WHERE pey_transaction_id='HUerfano'").fetchone()
        textos = " ".join(r["contenido"] for r in conn.execute("SELECT contenido FROM mensajes").fetchall())
    assert pago["cobro_id"] is None
    assert "sin cobro" in textos


def test_expiracion_sin_pago(monkeypatch):
    _cobro()
    pasado = (datetime.now(timezone.utc) - timedelta(minutes=30)).replace(microsecond=0).isoformat()
    from app.db import transaccion

    with transaccion() as conn:
        conn.execute("UPDATE cobros SET creado_en=?, expira_en=? WHERE pey_transaction_id='TX1'", (pasado, pasado))

    async def pending(tid):
        return {"id": tid, "status": "PENDING", "amount": 1.0}

    monkeypatch.setattr("app.pey.obtener_transaccion", pending)
    import asyncio

    from app.tareas import ciclo

    asyncio.run(ciclo())
    from app.db import conectar

    with conectar() as conn:
        estado = conn.execute("SELECT estado FROM cobros WHERE pey_transaction_id='TX1'").fetchone()["estado"]
    assert estado == "expirado"


def test_reconciliacion_si_ya_estaba_pagado(monkeypatch):
    _cobro()
    pasado = (datetime.now(timezone.utc) - timedelta(minutes=30)).replace(microsecond=0).isoformat()
    from app.db import transaccion

    with transaccion() as conn:
        conn.execute("UPDATE cobros SET creado_en=?, expira_en=? WHERE pey_transaction_id='TX1'", (pasado, pasado))
    _pagado(monkeypatch, 1.0)
    import asyncio

    from app.tareas import ciclo

    asyncio.run(ciclo())
    from app.db import conectar

    with conectar() as conn:
        estado = conn.execute("SELECT estado FROM cobros WHERE pey_transaction_id='TX1'").fetchone()["estado"]
    assert estado == "pagado"
    assert _contar("movimientos", "ingreso") == 1


def test_archivos_no_salen_de_la_carpeta(client):
    assert client.get("/archivos/../.env").status_code == 404
    assert client.get("/archivos/no-existe.pdf").status_code == 404
