"""Chats, código de un centavo y carga de listas."""

import base64

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.db import ahora_iso, conectar, transaccion
from app.personas import obtener_o_crear


def sesion(client, rol="cliente"):
    email = "persona@test.mx" if rol == "cliente" else "negocio@test.mx"
    pedido = client.post("/api/seguridad/correo", params={"k": "k-test"}, json={"email": email, "rol": rol})
    assert pedido.status_code == 200, pedido.text
    ver = client.post(
        "/api/seguridad/codigo",
        params={"k": "k-test"},
        json={"email": email, "codigo": pedido.json()["codigo_local"], "rol": rol},
    )
    token = ver.json()["token"]
    desafio = client.post(
        "/api/seguridad/bio/desafio",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
    ).json()
    llave = ec.generate_private_key(ec.SECP256R1())
    firma = llave.sign(bytes.fromhex(desafio["desafio"]), ec.ECDSA(hashes.SHA256()))
    publica = llave.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    lista = client.post(
        "/api/seguridad/bio/confirmar",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={
            "desafio_id": desafio["id"],
            "credencial_id": email,
            "publica": base64.b64encode(publica).decode(),
            "firma": base64.b64encode(firma).decode(),
        },
    )
    assert lista.status_code == 200, lista.text
    return lista.json()["token"]


def test_la_ficha_muestra_el_pedido_y_no_la_activacion(client):
    obtener_o_crear("5511111111")
    clienta = obtener_o_crear("5588888888", nombre="Miriam")
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO mensajes (contacto_id, rol, contenido, hilo, creado_en) VALUES (?, 'user', 'jalate eso', 'estetica', ?)",
            (clienta["id"], ahora_iso()),
        )
        conn.execute(
            "INSERT INTO mensajes (contacto_id, rol, contenido, hilo, creado_en) VALUES (?, 'user', 'quiero un corte', 'estetica', ?)",
            (clienta["id"], ahora_iso()),
        )
        conn.execute(
            """INSERT INTO cotizaciones
               (folio, contacto_id, partidas_json, subtotal_centavos, iva_centavos, total_centavos, estado, creado_en)
               VALUES ('COT-TEST-1', ?, ?, 200, 32, 232, 'enviada', ?)""",
            (clienta["id"], '[{"descripcion": "Corte de cabello"}]', ahora_iso()),
        )
    r = client.get("/api/tablero", params={"k": "k-test", "telefono": "5511111111"})
    assert r.status_code == 200
    fila = next(c for c in r.json()["chats"] if c["telefono"] == "5588888888")
    assert fila["nombre"] == "Miriam"
    assert "jalate" not in fila["pidio"].lower()
    assert "corte" in fila["pidio"].lower()
    assert "Te escribió" in fila["alerta"]
    assert "presupuesto" in fila["alerta"]
    assert fila["presupuestos"][0]["folio"] == "COT-TEST-1"
    assert fila["presupuestos"][0]["total"] == "$0.01"
    assert fila["presupuestos"][0]["saldo"] == "$0.01"
    assert "Primera vez" not in fila["seguimiento"]
    assert all(s["nombre"] not in ("Leche", "Frijol", "Jabón") for s in fila["sugerencias"])
    assert all(s["nombre"] != "Corte de cabello" for s in fila["sugerencias"])


def test_el_cliente_ve_su_estetica(client):
    r = client.get("/api/tablero", params={"k": "k-test", "telefono": "5522222222"})
    assert r.status_code == 200
    assert [c["nombre"] for c in r.json()["chats"]] == ["Estética"]


def test_escanear_solo_un_centavo(client):
    token = sesion(client)
    contacto = obtener_o_crear("5522222222")
    with transaccion() as conn:
        conn.execute(
            """INSERT INTO cobros
               (contacto_id, tipo, metodo, monto_centavos, concepto, estado, qr_string, creado_en)
               VALUES (?, 'libre', 'qr', 100, 'de mas', 'pendiente', 'codigo-grande', ?)""",
            (contacto["id"], ahora_iso()),
        )
        conn.execute(
            """INSERT INTO cobros
               (contacto_id, tipo, metodo, monto_centavos, concepto, estado, qr_string, creado_en)
               VALUES (?, 'libre', 'qr', 1, 'centavo', 'pendiente', 'codigo-centavo', ?)""",
            (contacto["id"], ahora_iso()),
        )
    grande = client.post(
        "/api/escanear",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={"texto": "codigo-grande"},
    )
    assert grande.status_code == 409
    chico = client.post(
        "/api/escanear",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={"texto": "codigo-centavo"},
    )
    assert chico.status_code == 200
    assert chico.json()["monto"] == "$0.01"


def test_csv_guarda_precios_en_centavos(client):
    token = sesion(client, "dueno")
    contenido = "sku,nombre,precio,costo,existencia\njabon,Jabón,2.50,0.80,4\n"
    r = client.post(
        "/api/cargar",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        data={"telefono10": "5511111111"},
        files={"archivo": ("lista.csv", contenido.encode(), "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert "1 productos" in r.json()["nota"]
    with conectar() as conn:
        row = conn.execute(
            "SELECT precio_centavos, costo_centavos, existencia FROM productos WHERE sku='jabon'"
        ).fetchone()
    assert row["precio_centavos"] == 250
    assert row["costo_centavos"] == 80
    assert row["existencia"] == 4


def test_el_cliente_no_carga_listas(client):
    token = sesion(client)
    r = client.post(
        "/api/cargar",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        data={"telefono10": "5522222222"},
        files={"archivo": ("lista.csv", b"sku,nombre,precio\na,b,1\n", "text/csv")},
    )
    assert r.status_code == 403


def test_la_app_tiene_atras_y_chats(client):
    html = client.get("/app").text
    assert "Atrás" in html
    assert "Escanear" in html
    assert "Clientas" in html
    assert "Contestarle" in html


def test_codigo_de_un_centavo_no_cambia_el_monto(client, monkeypatch):
    token = sesion(client)
    async def falso(amount, concept, expiration=600, num_ref=None, metadata=None):
        assert amount == 0.01
        return {"id": "IDC1", "qrString": '{"IDC":"IDC1"}'}

    monkeypatch.setattr("app.pey.crear_qr", falso)
    r = client.post(
        "/api/cobro-centavo",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={"telefono10": "5522222222"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["monto"] == "$0.01"
    otra = client.post(
        "/api/cobro-centavo",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        json={"telefono10": "5522222222"},
    )
    assert otra.json()["cobro_id"] == r.json()["cobro_id"]
