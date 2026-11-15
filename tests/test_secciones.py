def test_gasto_personal_no_entra_al_libro():
    from app.departamentos.libro import resumen
    from app.departamentos.memoria import como_gasto, poner_meta, registrar
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5544444444", nombre="Ana")
    alta = registrar(contacto["id"], 80, "café")
    assert "no entra al libro" in alta
    assert resumen("mes")["gastos_centavos"] == 0
    meta = poner_meta(contacto["id"], "vacaciones", 500)
    assert "8 semanas" in meta
    guia = como_gasto(contacto["id"])
    assert "antojos" in guia
    assert "No es asesoría de inversión" in guia


def test_almacen_baja_una_sola_vez():
    from app.db import transaccion
    from app.departamentos import almacen
    from app.departamentos.cotizaciones import crear_cotizacion
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear("5555555555", nombre="Beto")
    assert "Quedan 2" in almacen.cargar_entrada("tinte", "Tinte", 2, 80)
    cot = crear_cotizacion(contacto["id"], [{"servicio_id": "tinte", "cantidad": 1}])
    with transaccion() as conn:
        row = dict(conn.execute("SELECT * FROM cotizaciones WHERE id=?", (cot["id"],)).fetchone())
        almacen.salida_por_cotizacion(conn, row)
        almacen.salida_por_cotizacion(conn, row)
        pid = conn.execute("SELECT id FROM productos WHERE sku='tinte'").fetchone()["id"]
        conn.execute(
            "INSERT INTO recetas (servicio_id, producto_id, cantidad) VALUES ('tinte', ?, 1)",
            (pid,),
        )
    assert "Tinte: 2" in almacen.existencias()
    uno = almacen.atender_servicio(contacto["id"], "tinte")
    dos = almacen.atender_servicio(contacto["id"], "tinte")
    assert uno["ya"] is False
    assert dos["ya"] is True
    assert "Tinte: 1" in almacen.existencias()
    assert "quedan 1" in almacen.por_surtir()


def test_dos_precios_son_dos_lotes():
    from app.db import conectar
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 1, 3)
    almacen.cargar_entrada("tinte", "Tinte", 1, 3.2)
    with conectar() as conn:
        costos = [
            r["costo_centavos"]
            for r in conn.execute(
                """SELECT l.costo_centavos FROM lotes l
                   JOIN productos p ON p.id=l.producto_id
                   WHERE p.sku='tinte' AND l.cantidad>0 ORDER BY l.id"""
            )
        ]
    assert costos == [300, 320]


def test_el_conteo_no_mezcla_precios():
    from app.db import conectar, transaccion
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 1, 3)
    almacen.cargar_entrada("tinte", "Tinte", 1, 3.2)
    almacen.ajustar("tinte", -1)
    with conectar() as conn:
        costos = [
            r["costo_centavos"]
            for r in conn.execute(
                """SELECT l.costo_centavos FROM lotes l
                   JOIN productos p ON p.id=l.producto_id
                   WHERE p.sku='tinte' AND l.cantidad>0 ORDER BY l.id"""
            )
        ]
    assert costos == [320]
    with transaccion() as conn:
        conn.execute(
            """INSERT INTO productos (sku, nombre, precio_centavos, costo_centavos, existencia, minimo)
               VALUES ('papel-bano', 'Papel de baño', 0, 0, 0, 4)"""
        )
    almacen.ajustar("papel-bano", 1)
    with conectar() as conn:
        papel = conn.execute("SELECT existencia FROM productos WHERE sku='papel-bano'").fetchone()
        lotes = conn.execute(
            """SELECT COUNT(*) AS c FROM lotes l
               JOIN productos p ON p.id=l.producto_id WHERE p.sku='papel-bano'"""
        ).fetchone()["c"]
    assert papel["existencia"] == 1
    assert lotes == 0


def test_una_frase_una_seccion():
    import asyncio

    from app.agente.fallback import responder
    from app.personas import obtener_o_crear

    cliente = obtener_o_crear("5566666666", nombre="Luz")
    cita = asyncio.run(responder("quiero comprar una cita para el peluquero", cliente))
    assert "Corte" in cita or "corte" in cita
    assert "COT-" in cita
    gasto = asyncio.run(responder("gasté 80 en café", cliente))
    assert "no entra al libro" in gasto
    meta = asyncio.run(responder("quiero ahorrar 500 para unas vacaciones", cliente))
    assert "vacaciones" in meta
    assert "8 semanas" in meta

    dueno = obtener_o_crear("5511111111", nombre="Dueño")
    alta = asyncio.run(responder("factura shampoo 4 piezas a 35", dueno))
    assert "Quedan 4" in alta
    assert "dueño" in dueno["rol"] or dueno["rol"] == "dueno"


def test_caja_guarda_en_sqlite(client):
    from app.db import conectar
    from app.personas import obtener_o_crear

    obtener_o_crear("5511111111", nombre="Dueña")
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 3, 80)
    with conectar() as conn:
        conn.execute("UPDATE productos SET precio_centavos=2500 WHERE sku='tinte'")
    tablero = client.get("/api/tablero", params={"k": "k-test", "telefono": "5511111111"})
    assert tablero.status_code == 200
    assert any(p["sku"] == "tinte" for p in tablero.json()["modulos"]["caja"])
    venta = client.post(
        "/api/venta",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "lineas": [{"sku": "tinte", "cantidad": 1}]},
    )
    assert venta.status_code == 200
    with conectar() as conn:
        queda = conn.execute("SELECT existencia FROM productos WHERE sku='tinte'").fetchone()["existencia"]
    assert queda == 2


def test_merma_sale_del_frente_y_no_es_venta(client):
    from app.db import conectar
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 1, 3)
    almacen.cargar_entrada("tinte", "Tinte", 1, 3.2)
    merma = client.post(
        "/api/almacen/merma",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "sku": "tinte", "motivo": "caducidad"},
    )
    assert merma.status_code == 200
    assert "No es venta" in merma.json()["nota"]
    with conectar() as conn:
        costos = [
            r["costo_centavos"]
            for r in conn.execute(
                """SELECT l.costo_centavos FROM lotes l
                   JOIN productos p ON p.id=l.producto_id
                   WHERE p.sku='tinte' AND l.cantidad>0 ORDER BY l.id"""
            )
        ]
        tipo = conn.execute(
            "SELECT tipo, nota FROM movimientos_almacen WHERE tipo='merma'"
        ).fetchone()
        ventas = conn.execute("SELECT COUNT(*) AS c FROM ventas").fetchone()["c"]
    assert costos == [320]
    assert tipo["tipo"] == "merma"
    assert "Caducó" in tipo["nota"]
    assert ventas == 0
    ajeno = client.post(
        "/api/almacen/merma",
        params={"k": "k-test"},
        json={"telefono10": "5522222222", "sku": "tinte", "motivo": "dano"},
    )
    assert ajeno.status_code == 403
    raro = client.post(
        "/api/almacen/merma",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "sku": "tinte", "motivo": "robo"},
    )
    assert raro.status_code == 400


def test_quien_no_es_dueno_no_ve_el_costo_del_lote(client):
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 2, 80)
    dueno = client.get("/api/tablero", params={"k": "k-test", "telefono": "5511111111"})
    cliente = client.get("/api/tablero", params={"k": "k-test", "telefono": "5522222222"})
    lote_dueno = next(p for p in dueno.json()["almacen"] if p["sku"] == "tinte")["lotes"][0]
    lote_cliente = next(p for p in cliente.json()["almacen"] if p["sku"] == "tinte")["lotes"][0]
    assert "costo" in lote_dueno
    assert "costo" not in lote_cliente
    assert lote_cliente["cantidad"] == 2
    dueño_prod = next(p for p in dueno.json()["almacen"] if p["sku"] == "tinte")
    ajeno_prod = next(p for p in cliente.json()["almacen"] if p["sku"] == "tinte")
    assert "precio" not in ajeno_prod
    assert dueño_prod["precio"] == ""


def test_ticket_de_caja_queda_en_la_ficha(client):
    from app.db import conectar
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 2, 80)
    sin_precio = client.post(
        "/api/venta",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "lineas": [{"sku": "tinte", "cantidad": 1}]},
    )
    assert sin_precio.status_code == 400
    assert "precio de venta" in sin_precio.json()["detail"]
    with conectar() as conn:
        conn.execute("UPDATE productos SET precio_centavos=2500 WHERE sku='tinte'")
    venta = client.post(
        "/api/venta",
        params={"k": "k-test"},
        json={
            "telefono10": "5511111111",
            "cliente10": "5522222222",
            "lineas": [{"sku": "tinte", "cantidad": 1}],
        },
    )
    assert venta.status_code == 200
    cuerpo = venta.json()
    assert "Ticket de caja" in cuerpo["ticket"]
    assert "Tinte" in cuerpo["ticket"]
    assert "no salió" in cuerpo["aviso"]
    with conectar() as conn:
        nota = conn.execute(
            """SELECT m.contenido FROM mensajes m
               JOIN contactos c ON c.id=m.contacto_id
               WHERE c.telefono10='5522222222' ORDER BY m.id DESC LIMIT 1"""
        ).fetchone()
    assert nota and "Ticket de caja" in nota["contenido"]


def test_precio_de_venta_no_toca_el_costo(client):
    from app.db import conectar
    from app.departamentos import almacen

    almacen.cargar_entrada("tinte", "Tinte", 1, 80)
    precio = client.post(
        "/api/almacen/precio",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "sku": "tinte", "precio_pesos": 25},
    )
    assert precio.status_code == 200
    with conectar() as conn:
        row = conn.execute(
            "SELECT precio_centavos, costo_centavos FROM productos WHERE sku='tinte'"
        ).fetchone()
        lote = conn.execute(
            """SELECT l.costo_centavos FROM lotes l
               JOIN productos p ON p.id=l.producto_id WHERE p.sku='tinte'"""
        ).fetchone()
    assert row["precio_centavos"] == 2500
    assert lote["costo_centavos"] == 8000


def test_el_qr_de_la_caja_no_baja_el_anaquel(client, monkeypatch):
    from app.db import conectar
    from app.departamentos import almacen

    async def falso(amount, concept, expiration=600, num_ref=None, metadata=None):
        assert amount == 0.01
        return {"id": "IDC-CAJA", "qrString": '{"IDC":"IDC-CAJA"}'}

    monkeypatch.setattr("app.pey.crear_qr", falso)
    almacen.cargar_entrada("tinte", "Tinte", 2, 80)
    with conectar() as conn:
        conn.execute("UPDATE productos SET precio_centavos=2500 WHERE sku='tinte'")
    r = client.post(
        "/api/caja/cobro",
        params={"k": "k-test"},
        json={"telefono10": "5511111111", "lineas": [{"sku": "tinte", "cantidad": 1}]},
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["ticket"] == "$25.00"
    assert cuerpo["monto"] == "$0.01"
    assert cuerpo["qr"].endswith(".png")
    with conectar() as conn:
        queda = conn.execute("SELECT existencia FROM productos WHERE sku='tinte'").fetchone()["existencia"]
        ventas = conn.execute("SELECT COUNT(*) AS c FROM ventas").fetchone()["c"]
        estado = conn.execute("SELECT estado FROM cobros WHERE id=?", (cuerpo["cobro_id"],)).fetchone()["estado"]
    assert queda == 2
    assert ventas == 0
    assert estado == "pendiente"


def test_la_factura_entra_con_su_folio():
    from app.departamentos.cargas import leer_cfdi
    from app.db import conectar

    xml = """<?xml version="1.0"?>
    <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Serie="A" Folio="15">
      <cfdi:Conceptos>
        <cfdi:Concepto Cantidad="2" ValorUnitario="10.00" Descripcion="Shampoo" NoIdentificacion="shampoo"/>
      </cfdi:Conceptos>
    </cfdi:Comprobante>
    """.encode()
    texto = leer_cfdi(xml)
    assert "Folio A-15" in texto
    with conectar() as conn:
        queda = conn.execute("SELECT existencia FROM productos WHERE sku='shampoo'").fetchone()["existencia"]
        nota = conn.execute("SELECT nota FROM facturas_compra ORDER BY id DESC LIMIT 1").fetchone()["nota"]
    assert queda == 2
    assert nota == "Folio A-15"


def test_el_correo_sin_buzon_no_inventa_facturas(client, monkeypatch):
    monkeypatch.setattr("app.correo_facturas.env", lambda nombre, default="": "")
    r = client.post(
        "/api/almacen/correo",
        params={"k": "k-test"},
        json={"telefono10": "5511111111"},
    )
    assert r.status_code == 200
    assert "no está conectado" in r.json()["nota"]


def test_cliente_no_carga_factura():
    import asyncio

    from app.agente.herramientas import ejecutar

    texto = asyncio.run(ejecutar("cargar_factura", {"sku": "tinte", "cantidad": 1, "costo": 1}, {"id": 1, "rol": "cliente", "telefono10": "5500000099"}))
    assert "dueño" in texto


def test_el_excel_de_la_tienda_acomoda_sin_inventar_precio():
    from app.db import conectar
    from app.departamentos.cargas import aplicar_tabla

    nota = aplicar_tabla(
        [
            ["producto", "precio de compra", "piezas"],
            ["Shampoo", "12.50", "3"],
        ]
    )
    assert "1 productos" in nota
    with conectar() as conn:
        row = conn.execute("SELECT * FROM productos WHERE sku='shampoo'").fetchone()
        lote = conn.execute(
            "SELECT cantidad, costo_centavos FROM lotes WHERE producto_id=?",
            (row["id"],),
        ).fetchone()
    assert row["seccion"] == "Limpieza"
    assert row["precio_centavos"] == 0
    assert row["existencia"] == 3
    assert lote["cantidad"] == 3
    assert lote["costo_centavos"] == 1250


def test_la_lista_solo_carga_numeros_que_vienen_escritos():
    from app.db import conectar
    from app.departamentos.cargas import _meter_vistos
    from app.personas import obtener_o_crear
    from app.tablero import foto

    obtener_o_crear("5511111111", nombre="Miriam")

    nota = _meter_vistos(
        '{"articulos":['
        '{"nombre":"Esmalte rojo","cantidad":"2","costo":"15","grupo":"Manicura"},'
        '{"nombre":"Sin numero","grupo":"Varios"}'
        "]}"
    )
    assert "Entré 1 artículo" in nota
    assert "sin número" in nota
    with conectar() as conn:
        row = conn.execute(
            "SELECT seccion, costo_centavos, existencia, precio_centavos FROM productos WHERE sku='esmalte-rojo'"
        ).fetchone()
        otro = conn.execute("SELECT id FROM productos WHERE nombre='Sin numero'").fetchone()
    assert dict(row) == {
        "seccion": "Manicura",
        "costo_centavos": 1500,
        "existencia": 2,
        "precio_centavos": 0,
    }
    assert otro is None
    dueno = foto("5511111111")
    assert dueno["valor_inventario"] == "$30.00"


def test_la_foto_sin_lector_no_inventa_piezas(client, monkeypatch):
    from app.config import env as env_real
    from tests.test_chats import sesion

    def sin_lector(clave, default=""):
        if clave == "LLM_API_KEY":
            return ""
        return env_real(clave, default)

    monkeypatch.setattr("app.config.env", sin_lector)
    token = sesion(client, "dueno")
    png = b"\x89PNG\r\n\x1a\nfoto"
    r = client.post(
        "/api/cargar",
        params={"k": "k-test"},
        headers={"X-Anillo-Sesion": token},
        data={"telefono10": "5511111111"},
        files={"archivo": ("lista.png", png, "image/png")},
    )
    assert r.status_code == 200, r.text
    assert "no inventé" in r.json()["nota"]
    html = client.get("/app").text
    assert "Excel de la tienda" in html
    assert "Tomar foto" in html
    assert "Elegir el XML" not in html
