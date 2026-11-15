import asyncio

import httpx

from app.telefono import a_telefono10


def test_normaliza_wa_id():
    assert a_telefono10("5215512345678") == "5512345678"
    assert a_telefono10("525512345678") == "5512345678"
    assert a_telefono10("+52 55 1234 5678") == "5512345678"


def test_reintento_503(monkeypatch):
    llamadas = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        llamadas["n"] += 1
        if llamadas["n"] < 3:
            return httpx.Response(503, json={"error": {"message": "no", "type": "SERVICE_UNAVAILABLE", "requestId": "req-1"}})
        return httpx.Response(200, json={"transactionId": "T1", "codiId": "C1"})

    from app import pey

    pey.set_client(httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    async def dormir(_segundos):
        return None

    monkeypatch.setattr(pey.asyncio, "sleep", dormir)
    data = asyncio.run(pey.crear_push(1.0, "5511111111", "Prueba", 360))
    assert data["transactionId"] == "T1"
    assert llamadas["n"] == 3
    pey.set_client(None)


def test_tool_de_dueno_rechaza_cliente():
    from app.agente.herramientas import ejecutar

    texto = asyncio.run(ejecutar("cobrar_saldo", {"folio": "COT-X"}, {"id": 9, "rol": "cliente", "telefono10": "5522222222"}))
    assert "dueño" in texto


def test_devolucion_queda_en_el_libro():
    from app.db import ahora_iso, transaccion
    from app.departamentos.libro import registrar_devolucion, resumen

    with transaccion() as conn:
        conn.execute(
            """INSERT INTO pagos (pey_transaction_id, monto_centavos, tipo_evento, payload_json, recibido_en)
               VALUES ('TXD', 500, 'codi.pn.payment_received', '{}', ?)""",
            (ahora_iso(),),
        )
        pago_id = conn.execute("SELECT id FROM pagos WHERE pey_transaction_id='TXD'").fetchone()["id"]
    mov = registrar_devolucion(pago_id, 2.0, "se canceló el servicio")
    assert mov["tipo"] == "devolucion"
    assert mov["monto_centavos"] == 200
    datos = resumen("mes")
    assert datos["devoluciones_centavos"] == 200


def test_pago_parcial_no_liquida(client, monkeypatch):
    from app.departamentos.cotizaciones import crear_cotizacion
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5522222222", nombre="Cliente")
    cot = crear_cotizacion(contacto["id"], [{"servicio_id": "corte", "cantidad": 1}])
    # _cobro también inserta al mismo teléfono: borrar el intento y usar el contacto ya creado.
    from app.db import ahora_iso, transaccion

    with transaccion() as conn:
        conn.execute(
            """INSERT INTO cobros
               (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, estado, pey_transaction_id, creado_en)
               VALUES (?, ?, 'anticipo', 'push', ?, 'Anticipo', 'pendiente', 'TXP', ?)""",
            (cot["id"], contacto["id"], cot["total_centavos"], ahora_iso()),
        )
    import json

    from tests.firma import firmar

    async def fake(tid):
        return {"id": tid, "status": "PAID", "amount": 1.0, "metadata": {}}

    monkeypatch.setattr("app.pey.obtener_transaccion", fake)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TXP", "amount": 1.0}).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    from app.db import conectar

    with conectar() as conn:
        estado = conn.execute("SELECT estado, pagado_centavos, total_centavos FROM cotizaciones WHERE id=?", (cot["id"],)).fetchone()
    assert estado["pagado_centavos"] == 100
    assert estado["pagado_centavos"] < estado["total_centavos"]
    assert estado["estado"] != "liquidada"


def test_factura_borrador_al_liquidar(client, monkeypatch):
    from app.departamentos.cotizaciones import crear_cotizacion
    from app.dinero import centavos_a_pesos
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5533333333", nombre="Ana")
    cot = crear_cotizacion(contacto["id"], [{"servicio_id": "barba", "cantidad": 1}])
    from app.db import ahora_iso, transaccion

    with transaccion() as conn:
        conn.execute(
            """INSERT INTO cobros
               (cotizacion_id, contacto_id, tipo, metodo, monto_centavos, concepto, estado, pey_transaction_id, creado_en)
               VALUES (?, ?, 'saldo', 'push', ?, 'Saldo', 'pendiente', 'TXF', ?)""",
            (cot["id"], contacto["id"], cot["total_centavos"], ahora_iso()),
        )
    import json

    from tests.firma import firmar

    amount = centavos_a_pesos(cot["total_centavos"])

    async def fake(tid):
        return {"id": tid, "status": "PAID", "amount": amount, "metadata": {}}

    monkeypatch.setattr("app.pey.obtener_transaccion", fake)
    body = json.dumps({"type": "codi.pn.payment_received", "transactionId": "TXF", "amount": amount}).encode()
    assert client.post("/webhooks/pey", content=body, headers=firmar(body)).status_code == 200
    from app.db import conectar

    with conectar() as conn:
        fac = conn.execute("SELECT estado, xml FROM facturas WHERE cotizacion_id=?", (cot["id"],)).fetchone()
        cot_db = conn.execute("SELECT estado FROM cotizaciones WHERE id=?", (cot["id"],)).fetchone()
    assert cot_db["estado"] == "liquidada"
    assert fac["estado"] == "borrador"
    assert 'FormaPago="03"' in fac["xml"]
    assert "XAXX010101000" in fac["xml"]
