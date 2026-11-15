"""Correo, biometría y bloqueo de movimientos raros."""

from app.db import ahora_iso, transaccion
from app.seguridad import cuenta_de_token
from tests.test_chats import sesion


def _jpeg(color_a, color_b) -> str:
    import base64
    import io

    from PIL import Image

    im = Image.new("RGB", (80, 80), color_a)
    for x in range(20, 60):
        for y in range(15, 65):
            im.putpixel((x, y), color_b)
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    return base64.b64encode(buf.getvalue()).decode()


def test_la_camara_registra_la_cara(client):
    foto = _jpeg((210, 170, 140), (60, 40, 30))
    r = client.post("/api/seguridad/cara", params={"k": "k-test"}, json={"rol": "cliente", "imagen": foto})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["nivel"] == "completa"
    assert cuerpo["registrada"] is True
    assert cuenta_de_token(cuerpo["token"])["nivel"] == "completa"
    otra = client.post("/api/seguridad/cara", params={"k": "k-test"}, json={"rol": "cliente", "imagen": foto})
    assert otra.status_code == 200
    assert otra.json()["reconocida"] is True
    ajena = client.post(
        "/api/seguridad/cara",
        params={"k": "k-test"},
        json={"rol": "cliente", "imagen": _jpeg((20, 80, 200), (240, 240, 20))},
    )
    assert ajena.status_code == 401


def test_codigo_incorrecto_no_abre(client):
    client.post("/api/seguridad/correo", params={"k": "k-test"}, json={"email": "a@test.mx", "rol": "cliente"})
    r = client.post(
        "/api/seguridad/codigo",
        params={"k": "k-test"},
        json={"email": "a@test.mx", "codigo": "000000", "rol": "cliente"},
    )
    assert r.status_code == 401


def test_cinco_fallos_bloquean(client):
    client.post("/api/seguridad/correo", params={"k": "k-test"}, json={"email": "b@test.mx", "rol": "cliente"})
    ultimo = None
    for _ in range(5):
        ultimo = client.post(
            "/api/seguridad/codigo",
            params={"k": "k-test"},
            json={"email": "b@test.mx", "codigo": "000000", "rol": "cliente"},
        )
    assert ultimo.status_code == 423


def test_firma_falsa_no_pasa(client):
    pedido = client.post("/api/seguridad/correo", params={"k": "k-test"}, json={"email": "c@test.mx", "rol": "cliente"})
    ver = client.post(
        "/api/seguridad/codigo",
        params={"k": "k-test"},
        json={"email": "c@test.mx", "codigo": pedido.json()["codigo_local"], "rol": "cliente"},
    )
    token = ver.json()["token"]
    desafio = client.post(
        "/api/seguridad/bio/desafio",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
    ).json()
    r = client.post(
        "/api/seguridad/bio/confirmar",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={
            "desafio_id": desafio["id"],
            "credencial_id": "falsa",
            "publica": "AQID",
            "firma": "AQID",
        },
    )
    assert r.status_code == 401


def test_sin_biometria_el_cobro_se_bloquea(client):
    r = client.post("/api/cobro-centavo", params={"k": "k-test"}, json={"telefono10": "5522222222"})
    assert r.status_code == 401


def test_cobros_seguidos_se_bloquean(client, monkeypatch):
    token = sesion(client)
    cuenta = cuenta_de_token(token)
    with transaccion() as conn:
        for _ in range(3):
            conn.execute(
                "INSERT INTO eventos_seguridad (cuenta_id, tipo, detalle, creado_en) VALUES (?, 'cobro_intent', 'x', ?)",
                (cuenta["id"], ahora_iso()),
            )
    r = client.post(
        "/api/cobro-centavo",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={"telefono10": "5522222222"},
    )
    assert r.status_code == 429
    eventos = client.get("/api/seguridad/eventos", params={"k": "k-test"}, headers={"X-Anillo-Sesion": token})
    assert any(e["tipo"] == "movimiento_inusual" for e in eventos.json()["eventos"])
