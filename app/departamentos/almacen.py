"""Almacén. La existencia baja solo cuando un pago ya confirmado usa ese producto."""

import json

from app.db import ahora_iso, conectar, filas, transaccion
from app.dinero import fmt_mxn, pesos_a_centavos


def cargar_entrada(sku: str, nombre: str, cantidad: int, costo_pesos: float, nota: str = "") -> str:
    if cantidad < 1:
        raise ValueError("La cantidad tiene que ser al menos 1.")
    costo = pesos_a_centavos(costo_pesos)
    sku = sku.strip().lower()
    with transaccion() as conn:
        producto = _asegurar(conn, sku, nombre, costo)
        cur = conn.execute(
            """INSERT INTO facturas_compra (imagen_path, estado, nota, creado_en)
               VALUES (NULL, 'capturada', ?, ?)""",
            (nota or f"{nombre} x{cantidad}", ahora_iso()),
        )
        conn.execute("UPDATE productos SET nombre=? WHERE id=?", (nombre, producto["id"]))
        _abrir_lote(conn, producto["id"], cur.lastrowid, cantidad, costo, nota)
        queda = conn.execute("SELECT existencia FROM productos WHERE id=?", (producto["id"],)).fetchone()["existencia"]
    return (
        f"Entré {cantidad} de {nombre} en un lote nuevo a {fmt_mxn(costo)} por pieza. "
        f"Quedan {queda}. El lote anterior no cambia de precio."
    )


def guardar_foto(nota: str, imagen_path: str | None = None) -> str:
    """La foto queda como evidencia. Las cantidades no se inventan: el dueño las confirma."""
    with transaccion() as conn:
        conn.execute(
            """INSERT INTO facturas_compra (imagen_path, estado, nota, creado_en)
               VALUES (?, 'pendiente', ?, ?)""",
            (imagen_path, nota, ahora_iso()),
        )
    return (
        "Guardé la foto de la factura. Para no inventar piezas ni precios, confírmame: "
        "producto, cantidad y costo. Ejemplo: factura tinte 6 piezas a 80."
    )


def existencias() -> str:
    with conectar() as conn:
        rows = filas(conn.execute("SELECT * FROM productos ORDER BY nombre").fetchall())
        if not rows:
            return "El almacén está vacío. Carga una factura: factura tinte 6 piezas a 80."
        lineas = ["Almacén:"]
        for r in rows:
            marca = " · hay que surtir" if r["existencia"] <= r["minimo"] else ""
            lineas.append(f"• {r['nombre']}: {r['existencia']}{marca}")
            for lote in _lotes_de(conn, r["id"]):
                lineas.append(f"  lote {fmt_mxn(lote['costo_centavos'])} × {lote['cantidad']}")
    return "\n".join(lineas)


def por_surtir() -> str:
    with conectar() as conn:
        rows = filas(conn.execute("SELECT * FROM productos WHERE existencia<=minimo ORDER BY existencia").fetchall())
    if not rows:
        return "Nada por surtir."
    lineas = ["Por surtir:"]
    for r in rows:
        lineas.append(f"• {r['nombre']}: quedan {r['existencia']} (mínimo {r['minimo']})")
    return "\n".join(lineas)


def salida_por_cotizacion(conn, cot: dict) -> list[str]:
    """El pago de un producto de tienda baja el stock. Un servicio no: eso lo hace la receta."""
    avisos = []
    for partida in json.loads(cot["partidas_json"]):
        if (partida.get("giro") or "servicios") != "bienes":
            continue
        sku = str(partida.get("servicio_id") or "").lower()
        producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if not producto:
            continue
        ya = conn.execute(
            """SELECT id FROM movimientos_almacen
               WHERE producto_id=? AND cotizacion_id=? AND tipo='salida'""",
            (producto["id"], cot["id"]),
        ).fetchone()
        if ya:
            continue
        cantidad = int(partida.get("cantidad") or 1)
        _consumir_lotes(conn, producto["id"], cantidad, cot["id"], cot["folio"])
        nueva = int(
            conn.execute("SELECT existencia FROM productos WHERE id=?", (producto["id"],)).fetchone()["existencia"]
        )
        if nueva <= int(producto["minimo"]):
            avisos.append(f"Hay que surtir {producto['nombre']}: quedan {nueva}.")
    return avisos


def atender_servicio(contacto_id: int, servicio_id: str) -> dict:
    """Descuenta la receta una sola vez. El segundo aviso no vuelve a bajar el anaquel."""
    servicio_id = (servicio_id or "").strip().lower()
    with transaccion() as conn:
        ya = conn.execute(
            "SELECT id FROM atendidos WHERE contacto_id=? AND servicio_id=?",
            (contacto_id, servicio_id),
        ).fetchone()
        if ya:
            return {"ya": True, "texto": "Ese servicio ya se había atendido. El almacén no se volvió a mover."}
        lineas = conn.execute(
            """SELECT p.id, p.nombre, p.minimo, r.cantidad
               FROM recetas r JOIN productos p ON p.id=r.producto_id
               WHERE r.servicio_id=?""",
            (servicio_id,),
        ).fetchall()
        if not lineas:
            raise ValueError("Ese servicio no tiene receta.")
        marca = conn.execute("SELECT COALESCE(MAX(id), 0) AS m FROM movimientos_almacen").fetchone()["m"]
        faltantes = []
        for linea in lineas:
            hay = int(conn.execute("SELECT existencia FROM productos WHERE id=?", (linea["id"],)).fetchone()["existencia"])
            if hay < int(linea["cantidad"]):
                faltantes.append(linea["nombre"])
            _consumir_lotes(conn, int(linea["id"]), int(linea["cantidad"]), None, f"receta {servicio_id}")
        costo = 0
        for row in conn.execute(
            """SELECT cantidad, costo_centavos FROM movimientos_almacen
               WHERE id>? AND tipo='salida' AND costo_centavos IS NOT NULL""",
            (marca,),
        ):
            costo += int(row["cantidad"]) * int(row["costo_centavos"])
        conn.execute(
            """INSERT INTO atendidos (contacto_id, servicio_id, costo_centavos, creado_en)
               VALUES (?, ?, ?, ?)""",
            (contacto_id, servicio_id, costo, ahora_iso()),
        )
        proponer_orden(conn)
    texto = f"Listo. La receta de {servicio_id} bajó del anaquel."
    if faltantes:
        texto += " No había suficiente " + ", ".join(faltantes) + "."
    return {"ya": False, "texto": texto, "costo_centavos": costo}


def proponer_orden(conn) -> None:
    """Si algo que surte el proveedor está bajo el mínimo, deja una orden por aprobar."""
    prov = conn.execute("SELECT id FROM contactos WHERE rol='proveedor' ORDER BY id LIMIT 1").fetchone()
    if not prov:
        return
    bajos = conn.execute(
        """SELECT p.id, p.existencia, p.minimo
           FROM surte s JOIN productos p ON p.id=s.producto_id
           WHERE s.contacto_id=? AND p.existencia<=p.minimo""",
        (prov["id"],),
    ).fetchall()
    if not bajos:
        return
    orden = conn.execute(
        "SELECT id FROM ordenes_compra WHERE contacto_id=? AND estado='propuesta'",
        (prov["id"],),
    ).fetchone()
    if orden:
        orden_id = orden["id"]
        conn.execute("DELETE FROM orden_lineas WHERE orden_id=?", (orden_id,))
    else:
        cur = conn.execute(
            "INSERT INTO ordenes_compra (contacto_id, estado, creado_en) VALUES (?, 'propuesta', ?)",
            (prov["id"], ahora_iso()),
        )
        orden_id = cur.lastrowid
    for bajo in bajos:
        cant = max(int(bajo["minimo"]) - int(bajo["existencia"]), 1)
        conn.execute(
            "INSERT INTO orden_lineas (orden_id, producto_id, cantidad) VALUES (?, ?, ?)",
            (orden_id, bajo["id"], cant),
        )


def aprobar_orden(orden_id: int) -> str:
    with transaccion() as conn:
        orden = conn.execute("SELECT * FROM ordenes_compra WHERE id=?", (orden_id,)).fetchone()
        if not orden:
            raise ValueError("No está esa orden.")
        if orden["estado"] != "propuesta":
            raise ValueError("Esa orden ya se mandó.")
        lineas = conn.execute(
            """SELECT p.nombre, l.cantidad FROM orden_lineas l
               JOIN productos p ON p.id=l.producto_id WHERE l.orden_id=? ORDER BY p.nombre""",
            (orden_id,),
        ).fetchall()
        if not lineas:
            raise ValueError("La orden no trae materiales.")
        texto = "Pedido: " + ", ".join(f"{r['nombre']} x{int(r['cantidad'])}" for r in lineas) + "."
        conn.execute("UPDATE ordenes_compra SET estado='enviada' WHERE id=?", (orden_id,))
        conn.execute(
            "INSERT INTO mensajes (contacto_id, rol, contenido, hilo, creado_en) VALUES (?, 'dueno', ?, 'estetica', ?)",
            (orden["contacto_id"], texto, ahora_iso()),
        )
    return texto


def costo_de_salida(conn, cotizacion_id: int) -> int:
    """Suma el costo real de los lotes que salieron con esa venta."""
    total = 0
    for row in conn.execute(
        """SELECT cantidad, costo_centavos FROM movimientos_almacen
           WHERE cotizacion_id=? AND tipo='salida' AND costo_centavos IS NOT NULL""",
        (cotizacion_id,),
    ):
        total += int(row["cantidad"]) * int(row["costo_centavos"])
    return total


def _abrir_lote(conn, producto_id: int, factura_id: int | None, cantidad: int, costo: int, nota: str) -> None:
    conn.execute(
        """INSERT INTO lotes (producto_id, factura_id, cantidad, costo_centavos, creado_en)
           VALUES (?, ?, ?, ?, ?)""",
        (producto_id, factura_id, cantidad, costo, ahora_iso()),
    )
    conn.execute(
        "UPDATE productos SET existencia=existencia+? WHERE id=?",
        (cantidad, producto_id),
    )
    conn.execute(
        """INSERT INTO movimientos_almacen
           (producto_id, tipo, cantidad, costo_centavos, factura_id, nota, creado_en)
           VALUES (?, 'entrada', ?, ?, ?, ?, ?)""",
        (producto_id, cantidad, costo, factura_id, nota, ahora_iso()),
    )


def _consumir_lotes(conn, producto_id: int, cantidad: int, cotizacion_id: int, folio: str) -> None:
    """Sale primero el lote más viejo, a su propio costo. El precio nuevo no lo toca."""
    quedan = cantidad
    lotes = conn.execute(
        "SELECT * FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id",
        (producto_id,),
    ).fetchall()
    for lote in lotes:
        if quedan <= 0:
            break
        toma = min(int(lote["cantidad"]), quedan)
        conn.execute("UPDATE lotes SET cantidad=cantidad-? WHERE id=?", (toma, lote["id"]))
        conn.execute(
            """INSERT INTO movimientos_almacen
               (producto_id, tipo, cantidad, costo_centavos, cotizacion_id, nota, creado_en)
               VALUES (?, 'salida', ?, ?, ?, ?, ?)""",
            (producto_id, toma, int(lote["costo_centavos"]), cotizacion_id, folio, ahora_iso()),
        )
        quedan -= toma
    if quedan:
        conn.execute(
            """INSERT INTO movimientos_almacen
               (producto_id, tipo, cantidad, cotizacion_id, nota, creado_en)
               VALUES (?, 'salida', ?, ?, ?, ?)""",
            (producto_id, quedan, cotizacion_id, folio, ahora_iso()),
        )
    conn.execute(
        "UPDATE productos SET existencia=MAX(existencia-?, 0) WHERE id=?",
        (cantidad, producto_id),
    )


def _lotes_de(conn, producto_id: int) -> list:
    return filas(
        conn.execute(
            "SELECT cantidad, costo_centavos FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id",
            (producto_id,),
        ).fetchall()
    )


def vender_en_caja(lineas: list[dict]) -> dict:
    """Venta de mostrador en efectivo. El precio sale del anaquel. CoDi no se marca aquí."""
    if not lineas:
        raise ValueError("El carrito está vacío.")
    with transaccion() as conn:
        total = 0
        armadas = []
        for linea in lineas:
            sku = str(linea.get("sku") or "").strip().lower()
            cantidad = int(linea.get("cantidad") or 0)
            if cantidad < 1:
                raise ValueError("La cantidad tiene que ser al menos 1.")
            producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
            if not producto:
                raise ValueError("No está ese producto.")
            if int(producto["existencia"]) < cantidad:
                raise ValueError(f"No hay suficiente {producto['nombre']}.")
            precio = int(producto["precio_centavos"])
            if precio < 1:
                raise ValueError(f"{producto['nombre']} no tiene precio de venta.")
            total += precio * cantidad
            armadas.append((producto, cantidad, precio))
        cur = conn.execute(
            "INSERT INTO ventas (total_centavos, metodo, concepto, creado_en) VALUES (?, 'efectivo', ?, ?)",
            (total, "Venta en caja", ahora_iso()),
        )
        venta_id = cur.lastrowid
        for producto, cantidad, precio in armadas:
            conn.execute(
                """INSERT INTO venta_lineas (venta_id, producto_id, cantidad, precio_centavos)
                   VALUES (?, ?, ?, ?)""",
                (venta_id, producto["id"], cantidad, precio),
            )
            _consumir_lotes(conn, int(producto["id"]), cantidad, None, f"caja {venta_id}")
        lineas_ticket = [
            f"{producto['nombre']} × {cantidad} · {fmt_mxn(precio)}"
            for producto, cantidad, precio in armadas
        ]
        ticket = "Ticket de caja\n" + "\n".join(lineas_ticket) + f"\nTotal {fmt_mxn(total)}\nEfectivo."
    return {"ok": True, "total": fmt_mxn(total), "ticket": ticket}


def cotizar_caja(lineas: list[dict]) -> int:
    """El total del ticket, con el precio del anaquel. No descuenta piezas ni cobra."""
    if not lineas:
        raise ValueError("El ticket está vacío.")
    with conectar() as conn:
        total = 0
        for linea in lineas:
            sku = str(linea.get("sku") or "").strip().lower()
            cantidad = int(linea.get("cantidad") or 0)
            if cantidad < 1:
                raise ValueError("La cantidad tiene que ser al menos 1.")
            producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
            if not producto:
                raise ValueError("No está ese producto.")
            if int(producto["existencia"]) < cantidad:
                raise ValueError(f"No hay suficiente {producto['nombre']}.")
            precio = int(producto["precio_centavos"])
            if precio < 1:
                raise ValueError(f"{producto['nombre']} no tiene precio de venta.")
            total += precio * cantidad
    if total < 1:
        raise ValueError("El ticket no tiene precio de venta.")
    return total


def poner_precio(sku: str, precio_pesos: float) -> str:
    """El precio de venta. No toca el costo del lote."""
    centavos = pesos_a_centavos(precio_pesos)
    if centavos < 1:
        raise ValueError("El precio de venta tiene que ser mayor a cero.")
    sku = sku.strip().lower()
    with transaccion() as conn:
        producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if not producto:
            raise ValueError("Ese material no está en el almacén.")
        conn.execute("UPDATE productos SET precio_centavos=? WHERE id=?", (centavos, producto["id"]))
    return f"{producto['nombre']} se vende a {fmt_mxn(centavos)}."


MOTIVOS_MERMA = {
    "caducidad": "Caducó. Sale del lote de enfrente. No es venta.",
    "dano": "Se rompió. Sale del lote de enfrente. No es venta.",
    "perdida": "Se perdió. Sale del lote de enfrente. No es venta.",
}


def registrar_merma(sku: str, motivo: str) -> str:
    """Una pieza que no se vendió. Sale del lote más viejo, que es el que está al frente."""
    nota = MOTIVOS_MERMA.get((motivo or "").strip().lower())
    if not nota:
        raise ValueError("La merma es caducidad, daño o pérdida.")
    sku = sku.strip().lower()
    with transaccion() as conn:
        producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if not producto:
            raise ValueError("Ese material no está en el almacén.")
        if int(producto["existencia"]) < 1:
            raise ValueError("Ya está en cero.")
        lote = conn.execute(
            "SELECT * FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id LIMIT 1",
            (producto["id"],),
        ).fetchone()
        costo = int(lote["costo_centavos"]) if lote else None
        if lote:
            conn.execute("UPDATE lotes SET cantidad=cantidad-1 WHERE id=?", (lote["id"],))
        conn.execute("UPDATE productos SET existencia=existencia-1 WHERE id=?", (producto["id"],))
        conn.execute(
            """INSERT INTO movimientos_almacen
               (producto_id, tipo, cantidad, costo_centavos, nota, creado_en)
               VALUES (?, 'merma', 1, ?, ?, ?)""",
            (producto["id"], costo, nota, ahora_iso()),
        )
        proponer_orden(conn)
        queda = conn.execute(
            "SELECT existencia FROM productos WHERE id=?", (producto["id"],)
        ).fetchone()["existencia"]
    return f"Anoté la merma. Quedan {queda}. No es venta."


def ajustar(sku: str, delta: int) -> str:
    """Suma o baja una pieza. No inventa un precio: el lote conserva el suyo."""
    if delta not in (1, -1):
        raise ValueError("El ajuste es de una pieza.")
    sku = sku.strip().lower()
    with transaccion() as conn:
        producto = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if not producto:
            raise ValueError("Ese material no está en el almacén.")
        if delta < 0 and int(producto["existencia"]) < 1:
            raise ValueError("Ya está en cero.")
        if delta < 0:
            _contar_baja(conn, int(producto["id"]))
        else:
            _contar_sube(conn, int(producto["id"]))
        queda = conn.execute("SELECT existencia FROM productos WHERE id=?", (producto["id"],)).fetchone()["existencia"]
    return f"Quedan {queda}."


def _contar_baja(conn, producto_id: int) -> None:
    lote = conn.execute(
        "SELECT * FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id LIMIT 1",
        (producto_id,),
    ).fetchone()
    costo = int(lote["costo_centavos"]) if lote else None
    if lote:
        conn.execute("UPDATE lotes SET cantidad=cantidad-1 WHERE id=?", (lote["id"],))
    conn.execute("UPDATE productos SET existencia=existencia-1 WHERE id=?", (producto_id,))
    conn.execute(
        """INSERT INTO movimientos_almacen
           (producto_id, tipo, cantidad, costo_centavos, nota, creado_en)
           VALUES (?, 'ajuste', 1, ?, ?, ?)""",
        (producto_id, costo, "Conteo. Baja una pieza del lote más viejo.", ahora_iso()),
    )


def _contar_sube(conn, producto_id: int) -> None:
    lote = conn.execute(
        "SELECT * FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id DESC LIMIT 1",
        (producto_id,),
    ).fetchone()
    if lote:
        conn.execute("UPDATE lotes SET cantidad=cantidad+1 WHERE id=?", (lote["id"],))
        costo = int(lote["costo_centavos"])
        nota = "Conteo. Sube una pieza al lote más nuevo, al mismo precio."
    else:
        costo = None
        nota = "Conteo. Sube una pieza sin precio, hasta que llegue la factura."
    conn.execute("UPDATE productos SET existencia=existencia+1 WHERE id=?", (producto_id,))
    conn.execute(
        """INSERT INTO movimientos_almacen
           (producto_id, tipo, cantidad, costo_centavos, nota, creado_en)
           VALUES (?, 'ajuste', 1, ?, ?, ?)""",
        (producto_id, costo, nota, ahora_iso()),
    )


def _asegurar(conn, sku: str, nombre: str, costo: int) -> dict:
    row = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
    if row:
        return dict(row)
    from app.departamentos.cargas import grupo_de

    seccion = grupo_de(nombre)
    if seccion == "Varios":
        seccion = {"tinte": "Tintes", "papel-bano": "Limpieza", "papel-aluminio": "Varios"}.get(sku, "Varios")
    conn.execute(
        """INSERT INTO productos (sku, nombre, costo_centavos, existencia, minimo, seccion)
           VALUES (?, ?, ?, 0, 2, ?)""",
        (sku, nombre, costo, seccion),
    )
    return dict(conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone())
