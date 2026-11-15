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


def test_cliente_no_carga_factura():
    import asyncio

    from app.agente.herramientas import ejecutar

    texto = asyncio.run(ejecutar("cargar_factura", {"sku": "tinte", "cantidad": 1, "costo": 1}, {"id": 1, "rol": "cliente", "telefono10": "5500000099"}))
    assert "dueño" in texto
