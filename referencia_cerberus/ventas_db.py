"""
ventas_db.py — Capa de datos de Ventas Imperial.
Clientes, ventas, facturas CFDI, pagos. Thread-safe via Lock.
DB: Cerberus_Data/cerberus_empire.db (existente)
"""
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone

_DEFAULT_DB = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cerberus_empire.db")
)
_lock = threading.Lock()


class VentasDB:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or _DEFAULT_DB

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def migrate(self):
        """Crea tablas de ventas si no existen. Idempotente."""
        with _lock:
            conn = self._conn()
            # Alter existing invoices table if total column missing
            try:
                conn.execute("ALTER TABLE invoices ADD COLUMN total REAL DEFAULT 0")
                conn.commit()
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e).lower() and "no such table" not in str(e).lower():
                    raise
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    rfc TEXT UNIQUE NOT NULL,
                    tipo TEXT NOT NULL,
                    razon_social TEXT,
                    regimen_fiscal TEXT,
                    cp TEXT,
                    uso_cfdi TEXT DEFAULT 'G03',
                    telefono TEXT,
                    email TEXT,
                    notas TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS sales_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id INTEGER NOT NULL,
                    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    estado TEXT DEFAULT 'draft',
                    subtotal REAL DEFAULT 0,
                    iva REAL DEFAULT 0,
                    total REAL DEFAULT 0,
                    notas TEXT
                );
                CREATE TABLE IF NOT EXISTS sale_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_order_id INTEGER NOT NULL,
                    part_id INTEGER NOT NULL,
                    cantidad REAL NOT NULL,
                    precio_unitario REAL NOT NULL,
                    descuento_pct REAL DEFAULT 0,
                    subtotal_linea REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS invoices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_order_id INTEGER NOT NULL,
                    client_id INTEGER NOT NULL,
                    folio TEXT UNIQUE NOT NULL,
                    serie TEXT DEFAULT 'A',
                    uuid TEXT,
                    xml_path TEXT,
                    pdf_path TEXT,
                    estado TEXT DEFAULT 'borrador',
                    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fecha_timbrado TIMESTAMP,
                    total REAL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoice_id INTEGER NOT NULL,
                    client_id INTEGER NOT NULL,
                    monto REAL NOT NULL,
                    metodo TEXT DEFAULT 'efectivo',
                    referencia TEXT,
                    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notas TEXT
                );
            """)
            conn.commit()
            conn.close()

    # ── Clientes ──────────────────────────────────────────────────────────────

    def registrar_cliente(self, nombre: str, rfc: str, tipo: str,
                          regimen_fiscal: str, cp: str, uso_cfdi: str = "G03",
                          razon_social: str = None, telefono: str = None,
                          email: str = None) -> int:
        with _lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO clients
                   (nombre, rfc, tipo, razon_social, regimen_fiscal, cp,
                    uso_cfdi, telefono, email)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (nombre, rfc.upper().strip(), tipo, razon_social or nombre,
                 regimen_fiscal, cp, uso_cfdi, telefono, email)
            )
            conn.commit()
            cid = cur.lastrowid
            conn.close()
        return cid

    def get_cliente(self, rfc_o_nombre: str) -> dict | None:
        conn = self._conn()
        q = rfc_o_nombre.strip().lower()
        row = conn.execute(
            "SELECT * FROM clients WHERE LOWER(rfc)=? OR LOWER(nombre)=?", (q, q)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def listar_clientes(self) -> list:
        conn = self._conn()
        rows = conn.execute("SELECT * FROM clients ORDER BY nombre").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def actualizar_notas_cliente(self, client_id: int, notas: str):
        with _lock:
            conn = self._conn()
            conn.execute("UPDATE clients SET notas=? WHERE id=?", (notas, client_id))
            conn.commit()
            conn.close()

    # ── Ventas ────────────────────────────────────────────────────────────────

    def crear_venta(self, client_id: int, items: list, notas: str = "") -> int:
        """Crea una venta en estado draft. NO descuenta stock todavía."""
        subtotal = 0.0
        for item in items:
            linea = item["cantidad"] * item["precio_unitario"] * (1 - item.get("descuento_pct", 0) / 100)
            subtotal += linea
        iva = round(subtotal * 0.16, 2)
        total = round(subtotal + iva, 2)
        subtotal = round(subtotal, 2)

        with _lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO sales_orders (client_id, fecha, estado, subtotal, iva, total, notas)
                   VALUES (?,?,?,?,?,?,?)""",
                (client_id, datetime.now().isoformat(), "draft", subtotal, iva, total, notas)
            )
            oid = cur.lastrowid
            for item in items:
                linea = round(
                    item["cantidad"] * item["precio_unitario"] *
                    (1 - item.get("descuento_pct", 0) / 100), 2
                )
                conn.execute(
                    """INSERT INTO sale_items
                       (sale_order_id, part_id, cantidad, precio_unitario, descuento_pct, subtotal_linea)
                       VALUES (?,?,?,?,?,?)""",
                    (oid, item["part_id"], item["cantidad"],
                     item["precio_unitario"], item.get("descuento_pct", 0), linea)
                )
            conn.commit()
            conn.close()
        return oid

    def confirmar_venta(self, order_id: int) -> dict:
        """Confirma la venta y descuenta el stock via almacen_db."""
        try:
            from cerberus_core.almacen_db import AlmacenDB
        except ModuleNotFoundError:
            from host_engine.cerberus_core.almacen_db import AlmacenDB
        adb = AlmacenDB(db_path=self.db_path)

        conn = self._conn()
        order = conn.execute("SELECT * FROM sales_orders WHERE id=?", (order_id,)).fetchone()
        items = conn.execute("SELECT * FROM sale_items WHERE sale_order_id=?", (order_id,)).fetchall()
        conn.close()

        if not order or order["estado"] != "draft":
            raise ValueError(f"Venta {order_id} no existe o no está en draft")

        for item in items:
            adb.salida_stock(item["part_id"], item["cantidad"], item["precio_unitario"])

        with _lock:
            conn = self._conn()
            conn.execute("UPDATE sales_orders SET estado='confirmed' WHERE id=?", (order_id,))
            conn.commit()
            conn.close()

        conn = self._conn()
        row = conn.execute("SELECT * FROM sales_orders WHERE id=?", (order_id,)).fetchone()
        conn.close()
        return dict(row)

    def cancelar_venta(self, order_id: int):
        with _lock:
            conn = self._conn()
            conn.execute(
                "UPDATE sales_orders SET estado='cancelled' WHERE id=? AND estado='draft'",
                (order_id,)
            )
            conn.commit()
            conn.close()

    def get_ventas_periodo(self, dias: int = 30) -> dict:
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        row = conn.execute(
            """SELECT COUNT(*) as cnt,
                      COALESCE(SUM(total), 0) as total_ventas,
                      COALESCE(SUM(subtotal), 0) as subtotal_ventas
               FROM sales_orders
               WHERE estado IN ('confirmed','invoiced') AND fecha>=?""",
            (desde,)
        ).fetchone()
        por_cliente = conn.execute(
            """SELECT c.nombre, COUNT(*) as compras, COALESCE(SUM(s.total),0) as total
               FROM sales_orders s JOIN clients c ON c.id=s.client_id
               WHERE s.estado IN ('confirmed','invoiced') AND s.fecha>=?
               GROUP BY c.id ORDER BY total DESC""",
            (desde,)
        ).fetchall()
        conn.close()
        return {
            "dias": dias,
            "count": row["cnt"],
            "total_ventas": round(float(row["total_ventas"]), 2),
            "subtotal_ventas": round(float(row["subtotal_ventas"]), 2),
            "por_cliente": [dict(r) for r in por_cliente],
        }

    # ── Facturas ──────────────────────────────────────────────────────────────

    def _next_folio(self, conn, serie: str = "A") -> str:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM invoices WHERE serie=?", (serie,)
        ).fetchone()
        num = (row["cnt"] or 0) + 1
        return f"FAC-{serie}-{num:04d}"

    def crear_invoice(self, sale_order_id: int) -> int:
        conn = self._conn()
        order = conn.execute(
            "SELECT * FROM sales_orders WHERE id=?", (sale_order_id,)
        ).fetchone()
        conn.close()
        if not order:
            raise ValueError(f"sale_order {sale_order_id} no existe")

        with _lock:
            conn = self._conn()
            folio = self._next_folio(conn, serie="A")
            cur = conn.execute(
                """INSERT INTO invoices
                   (sale_order_id, client_id, folio, serie, estado, fecha_emision, total)
                   VALUES (?,?,?,?,?,?,?)""",
                (sale_order_id, order["client_id"], folio, "A", "borrador",
                 datetime.now().isoformat(), order["total"])
            )
            inv_id = cur.lastrowid
            conn.execute(
                "UPDATE sales_orders SET estado='invoiced' WHERE id=?",
                (sale_order_id,)
            )
            conn.commit()
            conn.close()
        return inv_id

    def get_invoice(self, invoice_id: int) -> dict | None:
        conn = self._conn()
        row = conn.execute(
            """SELECT i.*, s.subtotal as so_subtotal, s.iva as so_iva,
                      s.total as so_total, s.client_id as _cid
               FROM invoices i
               JOIN sales_orders s ON s.id=i.sale_order_id
               WHERE i.id=?""",
            (invoice_id,)
        ).fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        d["total"] = d.get("total", 0)
        return d

    def listar_invoices(self, estado: str = None) -> list:
        conn = self._conn()
        if estado:
            rows = conn.execute(
                "SELECT * FROM invoices WHERE estado=? ORDER BY fecha_emision DESC",
                (estado,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM invoices ORDER BY fecha_emision DESC"
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def marcar_timbrada(self, invoice_id: int, uuid: str,
                        xml_path: str, pdf_path: str):
        with _lock:
            conn = self._conn()
            conn.execute(
                """UPDATE invoices SET uuid=?, xml_path=?, pdf_path=?,
                   estado='timbrada', fecha_timbrado=? WHERE id=?""",
                (uuid, xml_path, pdf_path, datetime.now().isoformat(), invoice_id)
            )
            conn.commit()
            conn.close()

    def get_resumen_invoices_mes(self) -> dict:
        desde = (datetime.now() - timedelta(days=30)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            """SELECT i.estado, COUNT(*) as cnt,
                      COALESCE(SUM(s.total),0) as total
               FROM invoices i JOIN sales_orders s ON s.id=i.sale_order_id
               WHERE i.fecha_emision>=?
               GROUP BY i.estado""",
            (desde,)
        ).fetchall()
        conn.close()
        return {r["estado"]: {"count": r["cnt"], "total": r["total"]} for r in rows}

    # ── Pagos ─────────────────────────────────────────────────────────────────

    def registrar_pago(self, invoice_id: int, monto: float,
                       metodo: str = "efectivo", referencia: str = "") -> int:
        inv = self.get_invoice(invoice_id)
        if not inv:
            raise ValueError(f"invoice {invoice_id} no existe")
        with _lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO payments (invoice_id, client_id, monto, metodo, referencia)
                   VALUES (?,?,?,?,?)""",
                (invoice_id, inv["client_id"], monto, metodo, referencia)
            )
            pid = cur.lastrowid
            conn.commit()
            conn.close()
        return pid

    def get_pagos_cliente(self, client_id: int) -> list:
        conn = self._conn()
        rows = conn.execute(
            "SELECT * FROM payments WHERE client_id=? ORDER BY fecha DESC",
            (client_id,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_saldo_pendiente(self, invoice_id: int) -> float:
        inv = self.get_invoice(invoice_id)
        if not inv:
            return 0.0
        conn = self._conn()
        row = conn.execute(
            "SELECT COALESCE(SUM(monto),0) as pagado FROM payments WHERE invoice_id=?",
            (invoice_id,)
        ).fetchone()
        conn.close()
        return round(float(inv["total"]) - float(row["pagado"]), 2)

    def get_cuentas_por_cobrar(self) -> list:
        conn = self._conn()
        invoices = conn.execute(
            """SELECT i.id as invoice_id, i.folio, c.nombre as cliente,
                      s.total, i.fecha_emision
               FROM invoices i
               JOIN sales_orders s ON s.id=i.sale_order_id
               JOIN clients c ON c.id=i.client_id
               WHERE i.estado IN ('borrador','timbrada')
               ORDER BY i.fecha_emision""",
        ).fetchall()
        conn.close()
        result = []
        for inv in invoices:
            saldo = self.get_saldo_pendiente(inv["invoice_id"])
            if saldo > 0.01:
                d = dict(inv)
                d["saldo"] = saldo
                result.append(d)
        return result

    # ── Analytics ─────────────────────────────────────────────────────────────

    def get_historial_cliente(self, client_id: int, dias: int = 365) -> dict:
        desde = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
        conn = self._conn()
        orders = conn.execute(
            """SELECT s.id, s.fecha, s.total, s.estado
               FROM sales_orders s
               WHERE s.client_id=? AND s.estado IN ('confirmed','invoiced')
               AND s.fecha>=? ORDER BY s.fecha DESC""",
            (client_id, desde)
        ).fetchall()
        prod_rows = conn.execute(
            """SELECT p.name, SUM(si.cantidad) as total_qty
               FROM sale_items si
               JOIN sales_orders s ON s.id=si.sale_order_id
               JOIN parts p ON p.id=si.part_id
               WHERE s.client_id=? AND s.estado IN ('confirmed','invoiced')
               GROUP BY p.id ORDER BY total_qty DESC""",
            (client_id,)
        ).fetchall()
        conn.close()
        total_comprado = sum(float(o["total"]) for o in orders)
        ultima = orders[0]["fecha"] if orders else None
        if len(orders) >= 2:
            fechas = [datetime.fromisoformat(o["fecha"]) for o in orders]
            deltas = [(fechas[i] - fechas[i+1]).days for i in range(len(fechas)-1)]
            frecuencia = sum(deltas) / len(deltas)
        else:
            frecuencia = None
        return {
            "compras": [dict(o) for o in orders],
            "total_comprado": round(total_comprado, 2),
            "ultima_compra": ultima,
            "frecuencia_dias": round(frecuencia, 1) if frecuencia else None,
            "productos_preferidos": [r["name"] for r in prod_rows],
        }

    def get_ranking_clientes(self, dias: int = 30) -> list:
        desde = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            """SELECT c.id, c.nombre, c.rfc,
                      COUNT(s.id) as compras,
                      COALESCE(SUM(s.total), 0) as total
               FROM clients c
               LEFT JOIN sales_orders s ON s.client_id=c.id
                 AND s.estado IN ('confirmed','invoiced') AND s.fecha>=?
               GROUP BY c.id ORDER BY total DESC""",
            (desde,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_clientes_inactivos(self, dias: int = 30) -> list:
        corte = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            """SELECT c.id, c.nombre, c.rfc, MAX(s.fecha) as ultima_compra
               FROM clients c
               LEFT JOIN sales_orders s ON s.client_id=c.id
                 AND s.estado IN ('confirmed','invoiced')
               GROUP BY c.id
               HAVING ultima_compra IS NULL OR ultima_compra <= ?
               ORDER BY ultima_compra ASC""",
            (corte,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_patron_compras(self, client_id: int) -> dict:
        conn = self._conn()
        rows = conn.execute(
            """SELECT strftime('%m', fecha) as mes, COUNT(*) as compras,
                      COALESCE(SUM(total), 0) as total
               FROM sales_orders
               WHERE client_id=? AND estado IN ('confirmed','invoiced')
               GROUP BY mes ORDER BY mes""",
            (client_id,)
        ).fetchall()
        conn.close()
        return {"por_mes": [dict(r) for r in rows]}
