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
    """Descuenta stock una sola vez por cotización. La llama el pago ya confirmado."""
    avisos = []
    for partida in json.loads(cot["partidas_json"]):
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
    seccion = {"tinte": "Tintes", "papel-bano": "Limpieza", "papel-aluminio": "Varios"}.get(sku, "Varios")
    conn.execute(
        """INSERT INTO productos (sku, nombre, costo_centavos, existencia, minimo, seccion)
           VALUES (?, ?, ?, 0, 2, ?)""",
        (sku, nombre, costo, seccion),
    )
    return dict(conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone())
