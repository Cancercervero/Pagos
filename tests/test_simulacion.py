def test_la_mesa_no_llama_a_pey_y_el_banco_confirma(client, monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("pey no entra en la simulación")

    monkeypatch.setattr("app.pey.crear_push", boom)
    monkeypatch.setattr("app.pey.crear_link", boom)
    monkeypatch.setattr("app.pey.crear_qr", boom)
    telefono = "5533333333"

    def decir(texto):
        r = client.post("/api/chat?k=k-test&modo=simulacion", json={"telefono10": telefono, "texto": texto})
        assert r.status_code == 200, r.text
        return r.json()["respuesta"]

    assert "COT-" in decir("quiero comprar una cita para el peluquero")
    assert "Horarios" in decir("va")
    apartado = decir("el de las 5")
    assert "Face ID" in apartado

    from app.db import conectar

    with conectar() as conn:
        cobro = conn.execute("SELECT id, metodo, estado FROM cobros").fetchone()
        cita = conn.execute("SELECT estado FROM citas").fetchone()
    assert cobro["metodo"] == "simulacion"
    assert cobro["estado"] == "pendiente"
    assert cita["estado"] == "apartada"

    banco = client.post("/api/simular-banco?k=k-test", json={"cobro_id": cobro["id"]})
    assert banco.status_code == 200, banco.text
    with conectar() as conn:
        assert conn.execute("SELECT estado FROM cobros").fetchone()["estado"] == "pagado"
        assert conn.execute("SELECT estado FROM citas").fetchone()["estado"] == "confirmada"
        assert conn.execute("SELECT tipo_evento FROM pagos").fetchone()["tipo_evento"] == "simulacion_local"

    otra = client.post("/api/simular-banco?k=k-test", json={"cobro_id": cobro["id"]})
    assert otra.status_code == 409


def test_el_face_id_no_marca_un_cobro_de_pey(client):
    from app.db import transaccion
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5540000000")
    with transaccion() as conn:
        cur = conn.execute(
            """INSERT INTO cobros
               (contacto_id, tipo, metodo, monto_centavos, concepto, estado, creado_en)
               VALUES (?, 'libre', 'push', 100, 'Real', 'pendiente', '2026-11-14T00:00:00+00:00')""",
            (contacto["id"],),
        )
        cobro_id = cur.lastrowid
    r = client.post("/api/simular-banco?k=k-test", json={"cobro_id": cobro_id})
    assert r.status_code == 409
