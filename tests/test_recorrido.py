def test_jalate_eso_ya_esta_activo():
    import asyncio

    from app.agente.fallback import responder

    texto = asyncio.run(responder("jalate eso", {"id": 1, "rol": "cliente", "telefono10": "5522222222"}))
    assert "activo" in texto.lower()


def test_recorrido_de_la_demo(client, monkeypatch):
    async def push(amount, phone_number, concept, expiration=360, num_ref=None, metadata=None):
        return {"transactionId": "PUSH1", "codiId": "12345678901234567890"}

    monkeypatch.setattr("app.pey.crear_push", push)
    telefono = "5522222222"

    def decir(texto):
        r = client.post("/api/chat?k=k-test", json={"telefono10": telefono, "texto": texto})
        assert r.status_code == 200, r.text
        return r.json()["respuesta"]

    cot = decir("Hola, quiero cotizar un corte y un tinte")
    assert "COT-" in cot
    assert "Total" in cot
    horarios = decir("Va, lo quiero")
    assert "Horarios" in horarios
    apartado = decir("El de las 5")
    assert "Aparté" in apartado
    assert "app bancaria" in apartado

    from app.db import conectar

    with conectar() as conn:
        cita = conn.execute("SELECT estado FROM citas").fetchone()
        cobro = conn.execute("SELECT tipo, metodo, monto_centavos, estado FROM cobros").fetchone()
        cot_db = conn.execute("SELECT total_centavos, estado FROM cotizaciones").fetchone()
    assert cita["estado"] == "apartada"
    assert cobro["tipo"] == "anticipo"
    assert cobro["metodo"] == "push"
    assert cobro["estado"] == "pendiente"
    assert cobro["monto_centavos"] == 1
    assert cot_db["estado"] == "aceptada"
