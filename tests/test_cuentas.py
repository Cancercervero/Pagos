def test_app_y_manifest(client):
    pagina = client.get("/app")
    assert pagina.status_code == 200
    assert "Anillo" in pagina.text
    manifiesto = client.get("/manifest.webmanifest")
    assert manifiesto.status_code == 200
    assert "standalone" in manifiesto.text
    icono = client.get("/marca/icon-192.png")
    assert icono.status_code == 200
    assert icono.headers["content-type"].startswith("image/png")


def test_servicio_y_mercancia_no_se_mezclan():
    import pytest

    from app.departamentos.cotizaciones import crear_cotizacion
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5577777777")
    with pytest.raises(ValueError):
        crear_cotizacion(contacto["id"], [{"servicio_id": "corte"}, {"servicio_id": "leche"}])


def test_una_resena_se_guarda(client):
    r = client.post("/api/resena?k=k-test", json={"telefono10": "5522222222", "texto": "Quedó bien el corte", "estrellas": 3})
    assert r.status_code == 200
    tablero = client.get("/api/tablero?k=k-test&telefono=5522222222")
    assert tablero.status_code == 200
    assert any(x["texto"] == "Quedó bien el corte" for x in tablero.json()["resenas"])


def test_la_leche_no_lleva_iva_y_el_jabon_si():
    from app.departamentos.cotizaciones import crear_cotizacion, es_bienes
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5577777778")
    leche = crear_cotizacion(contacto["id"], [{"servicio_id": "leche"}])
    jabon = crear_cotizacion(contacto["id"], [{"servicio_id": "jabon"}])
    assert es_bienes(leche)
    assert leche["iva_centavos"] == 0
    assert leche["total_centavos"] == 150
    assert jabon["iva_centavos"] == 32
    assert jabon["total_centavos"] == 232


def test_al_cobrar_mercancia_aparta_el_margen(client, monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("pey")

    monkeypatch.setattr("app.pey.crear_push", boom)
    monkeypatch.setattr("app.pey.crear_link", boom)
    telefono = "5577777779"

    def decir(texto):
        r = client.post("/api/chat?k=k-test&modo=simulacion", json={"telefono10": telefono, "texto": texto})
        assert r.status_code == 200, r.text
        return r.json()["respuesta"]

    cot = decir("quiero un jabón")
    assert "Margen" in cot
    assert "IVA $0.32" in cot
    cobro = decir("va")
    assert "Face ID" in cobro

    from app.db import conectar

    with conectar() as conn:
        row = conn.execute("SELECT id, metodo FROM cobros ORDER BY id DESC LIMIT 1").fetchone()
        assert row["metodo"] == "simulacion"
        citas = conn.execute("SELECT COUNT(*) AS n FROM citas").fetchone()["n"]
    assert citas == 0
    banco = client.post("/api/simular-banco?k=k-test", json={"cobro_id": row["id"]})
    assert banco.status_code == 200, banco.text
    aviso = " ".join(m["texto"] for m in banco.json()["mensajes"])
    assert "Apartado para el SAT" in aviso
    assert "Margen" in aviso
    assert "Estimación informativa" in aviso
