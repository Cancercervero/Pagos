"""SQLite: esquema completo, transacciones atómicas y montos en centavos."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from app.config import owner_phones, ruta_base

SCHEMA = """
CREATE TABLE IF NOT EXISTS contactos (
  id INTEGER PRIMARY KEY,
  telefono10 TEXT UNIQUE NOT NULL,
  wa_id TEXT,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente',
  acepto_privacidad INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id INTEGER PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  partidas_json TEXT NOT NULL,
  subtotal_centavos INTEGER NOT NULL,
  iva_centavos INTEGER NOT NULL,
  total_centavos INTEGER NOT NULL,
  pagado_centavos INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL,
  pdf_path TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER REFERENCES cotizaciones(id),
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  inicio TEXT NOT NULL,
  estado TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cobros (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER REFERENCES cotizaciones(id),
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  tipo TEXT NOT NULL,
  metodo TEXT NOT NULL,
  monto_centavos INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  estado TEXT NOT NULL,
  pey_transaction_id TEXT,
  pey_codi_id TEXT,
  pey_qr_id TEXT,
  pey_link_id TEXT,
  qr_string TEXT,
  link_url TEXT,
  expira_en TEXT,
  pagado_en TEXT,
  pago_tardio INTEGER NOT NULL DEFAULT 0,
  recordatorios_enviados INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY,
  pey_transaction_id TEXT UNIQUE NOT NULL,
  cobro_id INTEGER REFERENCES cobros(id),
  monto_centavos INTEGER NOT NULL,
  tipo_evento TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  recibido_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_eventos (
  webhook_id TEXT PRIMARY KEY,
  recibido_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  monto_centavos INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT,
  pago_id INTEGER REFERENCES pagos(id),
  con_factura INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER UNIQUE NOT NULL REFERENCES cotizaciones(id),
  serie TEXT NOT NULL,
  folio TEXT NOT NULL,
  xml TEXT NOT NULL,
  pdf_path TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador',
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mensajes (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  rol TEXT NOT NULL,
  contenido TEXT NOT NULL,
  hilo TEXT NOT NULL DEFAULT 'estetica',
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wa_dedupe (
  message_id TEXT PRIMARY KEY,
  recibido_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  precio_centavos INTEGER NOT NULL DEFAULT 0,
  costo_centavos INTEGER NOT NULL DEFAULT 0,
  existencia INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS facturas_compra (
  id INTEGER PRIMARY KEY,
  imagen_path TEXT,
  estado TEXT NOT NULL,
  nota TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos_almacen (
  id INTEGER PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  costo_centavos INTEGER,
  factura_id INTEGER REFERENCES facturas_compra(id),
  cotizacion_id INTEGER,
  nota TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  factura_id INTEGER REFERENCES facturas_compra(id),
  cantidad INTEGER NOT NULL,
  costo_centavos INTEGER NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS surte (
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  PRIMARY KEY (contacto_id, producto_id)
);

CREATE TABLE IF NOT EXISTS gastos_personales (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  monto_centavos INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metas_ahorro (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  nombre TEXT NOT NULL,
  meta_centavos INTEGER NOT NULL,
  apartado_centavos INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  nota TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cargas (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER,
  tipo TEXT NOT NULL,
  path TEXT NOT NULL,
  nota TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consumos (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  cotizacion_id INTEGER,
  descripcion TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favoritos (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  descripcion TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  UNIQUE (contacto_id, descripcion)
);

CREATE TABLE IF NOT EXISTS resenas (
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  texto TEXT NOT NULL,
  estrellas INTEGER NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cuentas (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  google_sub TEXT,
  rol TEXT NOT NULL,
  telefono10 TEXT NOT NULL,
  bloqueada_hasta TEXT,
  creada_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS codigos_correo (
  id INTEGER PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  codigo_hash TEXT NOT NULL,
  expira_en TEXT NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credenciales_bio (
  id INTEGER PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  credencial_id TEXT NOT NULL UNIQUE,
  publica TEXT NOT NULL,
  creada_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS desafios (
  id TEXT PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  desafio TEXT NOT NULL,
  expira_en TEXT NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  nivel TEXT NOT NULL,
  creada_en TEXT NOT NULL,
  expira_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos_seguridad (
  id INTEGER PRIMARY KEY,
  cuenta_id INTEGER,
  tipo TEXT NOT NULL,
  detalle TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caras (
  id INTEGER PRIMARY KEY,
  cuenta_id INTEGER NOT NULL UNIQUE REFERENCES cuentas(id),
  foto BLOB NOT NULL,
  firma TEXT NOT NULL,
  creada_en TEXT NOT NULL
);
"""


def ahora_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def conectar() -> sqlite3.Connection:
    ruta = ruta_base()
    ruta.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(ruta, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def transaccion():
    conn = conectar()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with conectar() as conn:
        conn.executescript(SCHEMA)
        columnas = {r["name"] for r in conn.execute("PRAGMA table_info(mensajes)")}
        if "hilo" not in columnas:
            conn.execute("ALTER TABLE mensajes ADD COLUMN hilo TEXT NOT NULL DEFAULT 'estetica'")
        conn.execute("UPDATE mensajes SET hilo='estetica' WHERE hilo!='estetica'")
        personas = {r["name"] for r in conn.execute("PRAGMA table_info(contactos)")}
        if "formula" not in personas:
            conn.execute("ALTER TABLE contactos ADD COLUMN formula TEXT")
        columnas_producto = {r["name"] for r in conn.execute("PRAGMA table_info(productos)")}
        if "seccion" not in columnas_producto:
            conn.execute("ALTER TABLE productos ADD COLUMN seccion TEXT NOT NULL DEFAULT 'Insumos'")
        _llenar_consumos(conn)
        _llenar_lotes(conn)
        _insumos_proveedor(conn)
        _secciones_almacen(conn)
        conn.commit()
    seed_dueno()


def marcar_favorito(conn, contacto_id: int, descripcion: str) -> bool | None:
    """Estrella un servicio que esa clienta ya pagó. Si no está en sus consumos, no se guarda."""
    texto = (descripcion or "").strip()[:120]
    if not texto:
        return None
    real = conn.execute(
        "SELECT id FROM consumos WHERE contacto_id=? AND descripcion=? LIMIT 1",
        (contacto_id, texto),
    ).fetchone()
    if not real:
        return None
    ya = conn.execute(
        "SELECT id FROM favoritos WHERE contacto_id=? AND descripcion=?",
        (contacto_id, texto),
    ).fetchone()
    if ya:
        conn.execute("DELETE FROM favoritos WHERE id=?", (ya["id"],))
        return False
    conn.execute(
        "INSERT INTO favoritos (contacto_id, descripcion, creado_en) VALUES (?, ?, ?)",
        (contacto_id, texto, ahora_iso()),
    )
    return True


def anotar_consumo(conn, contacto_id: int, cot: dict) -> None:
    """Guarda lo que esa clienta acaba de pagar. La misma cotización no se anota dos veces."""
    import json

    if not cot.get("id"):
        return
    if conn.execute("SELECT id FROM consumos WHERE cotizacion_id=?", (cot["id"],)).fetchone():
        return
    try:
        partidas = json.loads(cot.get("partidas_json") or "[]")
    except json.JSONDecodeError:
        partidas = []
    cuando = cot.get("creado_en") or ahora_iso()
    for p in partidas:
        texto = (p.get("descripcion") or "").strip()
        if texto:
            conn.execute(
                """INSERT INTO consumos (contacto_id, cotizacion_id, descripcion, creado_en)
                   VALUES (?, ?, ?, ?)""",
                (contacto_id, cot["id"], texto, cuando),
            )


def _llenar_lotes(conn) -> None:
    """El stock que ya estaba, sin factura nueva, queda en un solo lote a su costo guardado."""
    for p in conn.execute("SELECT * FROM productos").fetchall():
        ya = conn.execute("SELECT id FROM lotes WHERE producto_id=?", (p["id"],)).fetchone()
        if ya or int(p["existencia"] or 0) <= 0 or int(p["costo_centavos"] or 0) <= 0:
            continue
        conn.execute(
            """INSERT INTO lotes (producto_id, factura_id, cantidad, costo_centavos, creado_en)
               VALUES (?, NULL, ?, ?, ?)""",
            (p["id"], int(p["existencia"]), int(p["costo_centavos"]), ahora_iso()),
        )


def _insumos_proveedor(conn) -> None:
    """El proveedor surte estos materiales. El precio no se inventa: entra con la factura."""
    prov = conn.execute(
        "SELECT id FROM contactos WHERE rol='proveedor' ORDER BY id LIMIT 1"
    ).fetchone()
    if not prov:
        return
    for sku, nombre, minimo in (
        ("tinte", "Tinte", 2),
        ("papel-bano", "Papel de baño", 4),
        ("papel-aluminio", "Papel aluminio", 2),
    ):
        row = conn.execute("SELECT id FROM productos WHERE sku=?", (sku,)).fetchone()
        seccion = {"tinte": "Tintes", "papel-bano": "Limpieza", "papel-aluminio": "Varios"}.get(sku, "Varios")
        if row:
            pid = row["id"]
            conn.execute(
                "UPDATE productos SET nombre=? WHERE id=? AND lower(nombre)=?",
                (nombre, pid, sku),
            )
            conn.execute("UPDATE productos SET seccion=? WHERE id=?", (seccion, pid))
        else:
            cur = conn.execute(
                """INSERT INTO productos (sku, nombre, precio_centavos, costo_centavos, existencia, minimo, seccion)
                   VALUES (?, ?, 0, 0, 0, ?, ?)""",
                (sku, nombre, minimo, seccion),
            )
            pid = cur.lastrowid
        conn.execute(
            "INSERT OR IGNORE INTO surte (contacto_id, producto_id) VALUES (?, ?)",
            (prov["id"], pid),
        )


def _secciones_almacen(conn) -> None:
    for sku, seccion in (
        ("tinte", "Tintes"),
        ("papel-bano", "Limpieza"),
        ("papel-aluminio", "Varios"),
    ):
        conn.execute("UPDATE productos SET seccion=? WHERE sku=?", (seccion, sku))
    conn.execute("UPDATE productos SET seccion='Varios' WHERE seccion='Insumos'")


def _llenar_consumos(conn) -> None:
    rows = conn.execute(
        """SELECT * FROM cotizaciones
           WHERE estado IN ('liquidada', 'anticipo_pagado') ORDER BY id"""
    ).fetchall()
    for cot in rows:
        anotar_consumo(conn, cot["contacto_id"], dict(cot))


def seed_dueno() -> None:
    telefonos = sorted(owner_phones())
    if not telefonos:
        return
    with transaccion() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM contactos").fetchone()["c"]
        if total:
            return
        for tel in telefonos:
            conn.execute(
                """INSERT INTO contactos (telefono10, wa_id, nombre, rol, acepto_privacidad, creado_en)
                   VALUES (?, ?, ?, 'dueno', 1, ?)""",
                (tel, "52" + tel, "Dueño", ahora_iso()),
            )


def fila(row):
    return dict(row) if row is not None else None


def filas(rows) -> list[dict]:
    return [dict(r) for r in rows]
