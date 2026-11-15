"""
almacen_db.py — Capa de datos del Almacén Imperial.
Todas las operaciones SQLite. Thread-safe via Lock.

DB: Cerberus_Data/cerberus_empire.db (existente)
Esquema extendido:
  parts.processing_cost  — costo de transformación por unidad
  parts.sale_price       — precio de venta por unidad
  inventory_tx.labor_hours — horas trabajadas en la transacción
"""
import os
import sqlite3
import threading
from datetime import datetime, timedelta

_DEFAULT_DB = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cerberus_empire.db")
)
_lock = threading.Lock()


class AlmacenDB:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or _DEFAULT_DB

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def migrate(self):
        """Agrega columnas faltantes sin destruir datos existentes."""
        parts_migrations = [
            "ALTER TABLE parts ADD COLUMN processing_cost REAL DEFAULT 0.0",
            "ALTER TABLE parts ADD COLUMN sale_price REAL DEFAULT 0.0",
        ]
        inventory_tx_create = """
            CREATE TABLE IF NOT EXISTS inventory_tx (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stock_item_id INTEGER,
                tx_type TEXT,
                quantity REAL,
                price_at_tx REAL,
                tx_date TEXT,
                notes TEXT,
                labor_hours REAL DEFAULT 0.0
            )
        """
        inventory_tx_alters = [
            "ALTER TABLE inventory_tx ADD COLUMN labor_hours REAL DEFAULT 0.0",
            "ALTER TABLE inventory_tx ADD COLUMN merma_pct REAL DEFAULT 0.0",
            "ALTER TABLE inventory_tx ADD COLUMN photo_ref TEXT",
        ]
        stock_items_alters = [
            "ALTER TABLE stock_items ADD COLUMN merma_pct REAL DEFAULT 0.0",
        ]
        suppliers_alters = [
            "ALTER TABLE suppliers ADD COLUMN whatsapp TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN email TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN telefono TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN sitio_web TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN catalogo_url TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN notas TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN ciudad TEXT DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN foto TEXT DEFAULT ''",
        ]

        with _lock:
            conn = self._conn()
            try:
                # Migrate parts columns
                for sql in parts_migrations:
                    try:
                        conn.execute(sql)
                    except sqlite3.OperationalError as e:
                        if "duplicate column" not in str(e).lower():
                            raise

                # Ensure inventory_tx exists, then add columns
                conn.execute(inventory_tx_create)
                for sql in inventory_tx_alters:
                    try:
                        conn.execute(sql)
                    except sqlite3.OperationalError as e:
                        if "duplicate column" not in str(e).lower():
                            raise

                # stock_items merma column
                for sql in stock_items_alters:
                    try:
                        conn.execute(sql)
                    except sqlite3.OperationalError as e:
                        if "duplicate column" not in str(e).lower():
                            raise

                # Tabla de recetas de servicio
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS service_recipes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT UNIQUE NOT NULL,
                        items TEXT NOT NULL,
                        precio_sugerido REAL DEFAULT 0.0,
                        activa INTEGER DEFAULT 1,
                        created_at TEXT
                    )
                """)

                # Clientes y fórmulas personales
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS clients (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT NOT NULL,
                        telefono TEXT DEFAULT '',
                        notas TEXT DEFAULT '',
                        created_at TEXT
                    )
                """)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS client_formulas (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        client_id INTEGER NOT NULL,
                        servicio TEXT NOT NULL,
                        formula_json TEXT NOT NULL,
                        ultima_visita TEXT,
                        notas TEXT DEFAULT '',
                        created_at TEXT,
                        UNIQUE(client_id, servicio)
                    )
                """)

                # suppliers contact fields
                for sql in suppliers_alters:
                    try:
                        conn.execute(sql)
                    except sqlite3.OperationalError as e:
                        if "duplicate column" not in str(e).lower():
                            raise

                conn.commit()
            finally:
                conn.close()

    # ── Productos ────────────────────────────────────────────────────────────

    def registrar_producto(self, name: str, sku: str, unit: str,
                            categoria: str, min_stock: float,
                            costo_bruto: float, costo_proceso: float,
                            precio_venta: float) -> int:
        with _lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO parts (name, sku, unit, category, min_stock,
                   processing_cost, sale_price, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (name, sku, unit, categoria, min_stock,
                 costo_proceso, precio_venta,
                 datetime.now().isoformat())
            )
            conn.execute(
                "UPDATE parts SET description=? WHERE id=?",
                (f"costo_bruto:{costo_bruto}", cur.lastrowid)
            )
            conn.commit()
            pid = cur.lastrowid
            conn.close()
        return pid

    def get_producto(self, sku_o_nombre: str) -> dict | None:
        conn = self._conn()
        q = sku_o_nombre.strip().lower()
        row = conn.execute(
            "SELECT * FROM parts WHERE LOWER(sku)=? OR LOWER(name)=?", (q, q)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def listar_productos(self, categoria: str = None) -> list:
        conn = self._conn()
        if categoria:
            rows = conn.execute(
                "SELECT * FROM parts WHERE LOWER(category)=?",
                (categoria.lower(),)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM parts").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def actualizar_precio(self, part_id: int, campo: str, valor: float):
        campos_validos = {"sale_price", "processing_cost", "min_stock"}
        if campo not in campos_validos:
            raise ValueError(f"Campo inválido: {campo}")
        with _lock:
            conn = self._conn()
            conn.execute(f"UPDATE parts SET {campo}=? WHERE id=?", (valor, part_id))
            conn.commit()
            conn.close()

    # ── Proveedores ──────────────────────────────────────────────────────────

    def registrar_proveedor(self, name: str, contacto: str = "", rating: float = 5.0,
                             whatsapp: str = "", email: str = "", telefono: str = "",
                             sitio_web: str = "", catalogo_url: str = "", notas: str = "") -> int:
        with _lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO suppliers
                   (name, contact_info, rating, whatsapp, email, telefono, sitio_web, catalogo_url, notas)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (name, contacto, rating, whatsapp, email, telefono, sitio_web, catalogo_url, notas)
            )
            conn.commit()
            sid = cur.lastrowid
            conn.close()
        return sid

    def actualizar_proveedor(self, proveedor_id: int, **campos) -> None:
        validos = {"contact_info", "rating", "whatsapp", "email", "telefono",
                   "sitio_web", "catalogo_url", "notas"}
        sets = ", ".join(f"{k}=?" for k in campos if k in validos)
        vals = [v for k, v in campos.items() if k in validos]
        if not sets:
            return
        with _lock:
            conn = self._conn()
            conn.execute(f"UPDATE suppliers SET {sets} WHERE id=?", (*vals, proveedor_id))
            conn.commit()
            conn.close()

    def get_proveedor(self, nombre: str) -> dict | None:
        conn = self._conn()
        row = conn.execute(
            "SELECT * FROM suppliers WHERE LOWER(name)=?",
            (nombre.strip().lower(),)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def listar_proveedores(self) -> list:
        conn = self._conn()
        rows = conn.execute("SELECT * FROM suppliers ORDER BY rating DESC").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # ── Movimientos de Stock ─────────────────────────────────────────────────

    def entrada_stock(self, part_id: int, supplier_id: int, cantidad: float,
                      precio_compra: float, lote: str = None,
                      horas_labor: float = 0.0, merma_pct: float = 0.0,
                      photo_ref: str = None, fecha: str = None) -> int:
        ts = fecha or datetime.now().isoformat()
        with _lock:
            conn = self._conn()
            existing = conn.execute(
                "SELECT id, quantity FROM stock_items WHERE part_id=? AND supplier_id=? AND is_depleted=0 AND (batch_code=? OR batch_code IS NULL)",
                (part_id, supplier_id, lote)
            ).fetchone()

            if existing:
                new_qty = existing["quantity"] + cantidad
                conn.execute("UPDATE stock_items SET quantity=?, merma_pct=? WHERE id=?",
                             (new_qty, merma_pct, existing["id"]))
                stock_item_id = existing["id"]
            else:
                cur = conn.execute(
                    """INSERT INTO stock_items
                       (part_id, location_id, quantity, purchase_price, landed_cost,
                        batch_code, supplier_id, entry_date, is_depleted, merma_pct)
                       VALUES (?,1,?,?,0,?,?,?,0,?)""",
                    (part_id, cantidad, precio_compra, lote, supplier_id, ts, merma_pct)
                )
                stock_item_id = cur.lastrowid

            cur2 = conn.execute(
                """INSERT INTO inventory_tx
                   (stock_item_id, tx_type, quantity, price_at_tx, tx_date, notes,
                    labor_hours, merma_pct, photo_ref)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (stock_item_id, "ENTRADA", cantidad, precio_compra, ts,
                 f"lote:{lote or 'N/A'}", horas_labor, merma_pct, photo_ref)
            )
            conn.commit()
            tx_id = cur2.lastrowid
            conn.close()
        return tx_id

    def registrar_merma(self, stock_item_id: int, cantidad_merma: float,
                        motivo: str = "Procesamiento", photo_ref: str = None,
                        fecha: str = None) -> int:
        """Registra pérdida por transformación (leña→carbón, daño, polvo).
        photo_ref: nombre del archivo de foto enviado por el chalán.
        """
        ts = fecha or datetime.now().isoformat()
        with _lock:
            conn = self._conn()
            conn.execute(
                "UPDATE stock_items SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
                (cantidad_merma, stock_item_id, cantidad_merma)
            )
            cur = conn.execute(
                """INSERT INTO inventory_tx
                   (stock_item_id, tx_type, quantity, price_at_tx, tx_date, notes,
                    labor_hours, merma_pct, photo_ref)
                   VALUES (?,?,?,0,?,?,0,0,?)""",
                (stock_item_id, "MERMA", -cantidad_merma, ts,
                 f"Merma: {motivo}", photo_ref)
            )
            conn.commit()
            tx_id = cur.lastrowid
            conn.close()
        return tx_id

    def salida_stock(self, part_id: int, cantidad: float,
                     precio_venta: float, notas: str = "") -> int:
        with _lock:
            conn = self._conn()
            items = conn.execute(
                "SELECT id, quantity FROM stock_items WHERE part_id=? AND is_depleted=0 ORDER BY entry_date ASC",
                (part_id,)
            ).fetchall()

            restante = cantidad
            for item in items:
                if restante <= 0:
                    break
                if item["quantity"] <= restante:
                    restante -= item["quantity"]
                    conn.execute("UPDATE stock_items SET quantity=0, is_depleted=1 WHERE id=?",
                                 (item["id"],))
                else:
                    conn.execute("UPDATE stock_items SET quantity=quantity-? WHERE id=?",
                                 (restante, item["id"]))
                    restante = 0

            cur = conn.execute(
                """INSERT INTO inventory_tx
                   (stock_item_id, tx_type, quantity, price_at_tx, tx_date, notes, labor_hours)
                   VALUES (?,?,?,?,?,?,0)""",
                (items[0]["id"] if items else 0, "SALIDA", cantidad,
                 precio_venta, datetime.now().isoformat(), notas)
            )
            conn.commit()
            tx_id = cur.lastrowid
            conn.close()
        return tx_id

    def get_stock_actual(self, part_id: int) -> float:
        conn = self._conn()
        row = conn.execute(
            "SELECT COALESCE(SUM(quantity),0) as total FROM stock_items WHERE part_id=? AND is_depleted=0",
            (part_id,)
        ).fetchone()
        conn.close()
        return float(row["total"])

    def get_alertas_stock_bajo(self) -> list:
        conn = self._conn()
        rows = conn.execute("""
            SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
                   COALESCE(SUM(s.quantity),0) as stock_actual
            FROM parts p
            LEFT JOIN stock_items s ON s.part_id=p.id AND s.is_depleted=0
            GROUP BY p.id
            HAVING stock_actual < p.min_stock
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # ── Análisis ─────────────────────────────────────────────────────────────

    def _get_costo_bruto(self, part_id: int) -> float:
        """Extrae costo_bruto guardado en description como 'costo_bruto:N.NN'."""
        import re
        conn = self._conn()
        row = conn.execute("SELECT description FROM parts WHERE id=?", (part_id,)).fetchone()
        conn.close()
        if row and row["description"]:
            m = re.search(r"costo_bruto:([\d.]+)", row["description"])
            if m:
                return float(m.group(1))
        return 0.0

    def get_margen_producto(self, part_id: int) -> dict:
        conn = self._conn()
        row = conn.execute(
            "SELECT processing_cost, sale_price, name FROM parts WHERE id=?",
            (part_id,)
        ).fetchone()
        conn.close()
        if not row:
            return {}
        costo_bruto   = self._get_costo_bruto(part_id)
        costo_proceso = float(row["processing_cost"] or 0)
        costo_total   = costo_bruto + costo_proceso
        precio_venta  = float(row["sale_price"] or 0)
        margen_pesos  = precio_venta - costo_total
        margen_pct    = (margen_pesos / costo_total * 100) if costo_total > 0 else 0
        return {
            "name":          row["name"],
            "costo_bruto":   costo_bruto,
            "costo_proceso": costo_proceso,
            "costo_total":   round(costo_total, 2),
            "precio_venta":  precio_venta,
            "margen_pesos":  round(margen_pesos, 2),
            "margen_pct":    round(margen_pct, 2),
        }

    def get_flujo_periodo(self, dias: int = 30) -> dict:
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        entradas = conn.execute(
            """SELECT COALESCE(SUM(quantity),0) as qty,
                      COALESCE(SUM(quantity*price_at_tx),0) as costo,
                      COALESCE(SUM(labor_hours),0) as horas
               FROM inventory_tx WHERE tx_type='ENTRADA' AND tx_date>=?""",
            (desde,)
        ).fetchone()
        salidas = conn.execute(
            """SELECT COALESCE(SUM(quantity),0) as qty,
                      COALESCE(SUM(quantity*price_at_tx),0) as ingresos
               FROM inventory_tx WHERE tx_type='SALIDA' AND tx_date>=?""",
            (desde,)
        ).fetchone()
        conn.close()
        ingresos_brutos = float(salidas["ingresos"])
        ent_qty = float(entradas["qty"])
        ent_costo = float(entradas["costo"])
        avg_cost = ent_costo / ent_qty if ent_qty > 0 else 0
        costo_mercancia = float(salidas["qty"]) * avg_cost
        return {
            "dias":             dias,
            "entradas_qty":     float(entradas["qty"]),
            "costo_compras":    round(float(entradas["costo"]), 2),
            "salidas_qty":      float(salidas["qty"]),
            "ingresos_brutos":  round(ingresos_brutos, 2),
            "costo_mercancia":  round(costo_mercancia, 2),
            "ganancia_bruta":   round(ingresos_brutos - costo_mercancia, 2),
            "horas_labor":      float(entradas["horas"]),
        }

    def get_ranking_productos(self) -> list:
        productos = self.listar_productos()
        ranking = []
        for p in productos:
            m = self.get_margen_producto(p["id"])
            if m:
                m["id"] = p["id"]
                ranking.append(m)
        return sorted(ranking, key=lambda x: x["margen_pct"], reverse=True)

    # ── Recetas de Servicio ───────────────────────────────────────────────────

    def guardar_receta(self, nombre: str, items: list, precio_sugerido: float = 0.0) -> int:
        """items: [{"part_id": N, "cantidad": N, "unidad": "ml"}, ...]"""
        import json as _json
        with _lock:
            conn = self._conn()
            try:
                row = conn.execute("SELECT id FROM service_recipes WHERE LOWER(nombre)=?",
                                   (nombre.lower(),)).fetchone()
                if row:
                    conn.execute("UPDATE service_recipes SET items=?, precio_sugerido=? WHERE id=?",
                                 (_json.dumps(items, ensure_ascii=False), precio_sugerido, row["id"]))
                    rid = row["id"]
                else:
                    cur = conn.execute(
                        "INSERT INTO service_recipes (nombre, items, precio_sugerido, created_at) VALUES (?,?,?,?)",
                        (nombre.strip().title(), _json.dumps(items, ensure_ascii=False),
                         precio_sugerido, datetime.now().isoformat())
                    )
                    rid = cur.lastrowid
                conn.commit()
            finally:
                conn.close()
        return rid

    def get_receta(self, nombre: str) -> dict | None:
        import json as _json
        conn = self._conn()
        row = conn.execute("SELECT * FROM service_recipes WHERE LOWER(nombre)=? AND activa=1",
                           (nombre.strip().lower(),)).fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        d["items"] = _json.loads(d["items"])
        return d

    def listar_recetas(self) -> list:
        import json as _json
        conn = self._conn()
        rows = conn.execute("SELECT * FROM service_recipes WHERE activa=1 ORDER BY nombre").fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["items"] = _json.loads(d["items"])
            result.append(d)
        return result

    def buscar_receta_fuzzy(self, texto: str) -> dict | None:
        """Busca receta por nombre aproximado."""
        texto_lower = texto.lower()
        recetas = self.listar_recetas()
        for r in recetas:
            if r["nombre"].lower() in texto_lower or texto_lower in r["nombre"].lower():
                return r
        return None

    # ── Expediente de estilistas ──────────────────────────────────────────────

    def get_movimientos_estilista(self, user_id: str, dias: int = 30) -> list:
        """Movimientos de salida vinculados a un estilista por nota."""
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            """SELECT tx.id, tx.quantity, tx.price_at_tx, tx.tx_date, tx.notes,
                      tx.photo_ref, p.name as part_name, p.unit
               FROM inventory_tx tx
               JOIN stock_items si ON tx.stock_item_id = si.id
               JOIN parts p ON si.part_id = p.id
               WHERE tx.tx_type='SALIDA'
                 AND tx.notes LIKE ?
                 AND tx.tx_date >= ?
               ORDER BY tx.tx_date DESC""",
            (f"%estilista {user_id}%", desde)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_todos_estilistas(self, dias: int = 30) -> list:
        """IDs únicos de estilistas con movimientos en el período."""
        import re as _re
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            "SELECT DISTINCT notes FROM inventory_tx WHERE tx_type='SALIDA' AND notes LIKE '%estilista %' AND tx_date >= ?",
            (desde,)
        ).fetchall()
        conn.close()
        ids = set()
        for row in rows:
            m = _re.search(r'estilista (\S+)', row["notes"] or "")
            if m:
                ids.add(m.group(1))
        return list(ids)

    # ── Clientes ──────────────────────────────────────────────────────────────

    def registrar_cliente(self, nombre: str, telefono: str = "", notas: str = "") -> int:
        with _lock:
            conn = self._conn()
            cur = conn.execute(
                "INSERT INTO clients (nombre, telefono, notas, created_at) VALUES (?,?,?,?)",
                (nombre.strip().title(), telefono.strip(), notas, datetime.now().isoformat())
            )
            conn.commit()
            cid = cur.lastrowid
            conn.close()
        return cid

    def buscar_cliente_fuzzy(self, texto: str) -> dict | None:
        texto_lower = texto.strip().lower()
        conn = self._conn()
        rows = conn.execute("SELECT * FROM clients ORDER BY nombre").fetchall()
        conn.close()
        for r in rows:
            if texto_lower in r["nombre"].lower() or r["nombre"].lower() in texto_lower:
                return dict(r)
        # Buscar por partes del nombre
        partes = texto_lower.split()
        for r in rows:
            if any(p in r["nombre"].lower() for p in partes if len(p) > 2):
                return dict(r)
        return None

    def listar_clientes(self) -> list:
        conn = self._conn()
        rows = conn.execute("SELECT * FROM clients ORDER BY nombre").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def guardar_formula_cliente(self, client_id: int, servicio: str,
                                formula: list, notas: str = "") -> int:
        import json as _json
        ts = datetime.now().isoformat()
        with _lock:
            conn = self._conn()
            row = conn.execute(
                "SELECT id FROM client_formulas WHERE client_id=? AND LOWER(servicio)=?",
                (client_id, servicio.lower())
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE client_formulas SET formula_json=?, ultima_visita=?, notas=? WHERE id=?",
                    (_json.dumps(formula, ensure_ascii=False), ts, notas, row["id"])
                )
                fid = row["id"]
            else:
                cur = conn.execute(
                    "INSERT INTO client_formulas (client_id, servicio, formula_json, ultima_visita, notas, created_at) VALUES (?,?,?,?,?,?)",
                    (client_id, servicio.strip().title(), _json.dumps(formula, ensure_ascii=False), ts, notas, ts)
                )
                fid = cur.lastrowid
            conn.commit()
            conn.close()
        return fid

    def get_formula_cliente(self, client_id: int, servicio: str) -> dict | None:
        import json as _json
        conn = self._conn()
        row = conn.execute(
            "SELECT * FROM client_formulas WHERE client_id=? AND LOWER(servicio)=?",
            (client_id, servicio.strip().lower())
        ).fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        d["formula"] = _json.loads(d["formula_json"])
        return d

    def get_historial_cliente(self, client_id: int) -> list:
        import json as _json
        conn = self._conn()
        rows = conn.execute(
            "SELECT * FROM client_formulas WHERE client_id=? ORDER BY ultima_visita DESC",
            (client_id,)
        ).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["formula"] = _json.loads(d["formula_json"])
            result.append(d)
        return result

    def get_clientes_inactivos(self, dias: int = 42) -> list:
        """Clientes sin visita en N días. Default 6 semanas."""
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        rows = conn.execute(
            """SELECT c.*, MAX(f.ultima_visita) as ultima
               FROM clients c
               LEFT JOIN client_formulas f ON f.client_id = c.id
               GROUP BY c.id
               HAVING ultima IS NULL OR ultima < ?
               ORDER BY ultima ASC""",
            (desde,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def update_tx_photo(self, tx_id: int, photo_ref: str):
        """Vincula evidencia fotográfica a una transacción."""
        with _lock:
            conn = self._conn()
            conn.execute("UPDATE inventory_tx SET photo_ref=? WHERE id=?", (photo_ref, tx_id))
            conn.commit()
            conn.close()

    def registrar_consumo_historico(self, part_id: int, cantidad: float,
                                     fecha_iso: str, notas: str = "historico") -> bool:
        """
        Inserta registro histórico en inventory_tx SIN afectar stock_items.
        Usado en ingesta de datos pasados para que Isabel pueda predecir patrones.
        Retorna True si se insertó, False si no existe stock_item para el producto.
        """
        with _lock:
            conn = self._conn()
            row = conn.execute(
                "SELECT id FROM stock_items WHERE part_id=? ORDER BY entry_date ASC LIMIT 1",
                (part_id,)
            ).fetchone()
            if not row:
                conn.close()
                return False
            conn.execute(
                """INSERT INTO inventory_tx
                   (stock_item_id, tx_type, quantity, price_at_tx, tx_date, notes, labor_hours)
                   VALUES (?,?,?,0,?,?,0)""",
                (row["id"], "SALIDA", cantidad, fecha_iso, notas)
            )
            conn.commit()
            conn.close()
        return True

    def get_historial_precios(self, part_id: int, limit: int = 10) -> list:
        """
        Últimas N entradas de un producto con su precio de compra y fecha.
        Permite detectar si el proveedor subió o bajó precio.
        """
        conn = self._conn()
        rows = conn.execute(
            """SELECT tx.price_at_tx, tx.tx_date, s.supplier_id
               FROM inventory_tx tx
               JOIN stock_items s ON s.id = tx.stock_item_id
               WHERE s.part_id = ? AND tx.tx_type = 'ENTRADA'
               ORDER BY tx.tx_date DESC LIMIT ?""",
            (part_id, limit)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_variaciones_precio_recientes(self, dias: int = 30) -> list:
        """
        Productos cuyo precio de compra cambió en los últimos N días vs
        la entrada anterior. Retorna lista con variación porcentual.
        """
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        # Para cada producto, tomar las 2 últimas entradas
        parts = conn.execute("SELECT id, name, sku FROM parts").fetchall()
        conn.close()

        variaciones = []
        for p in parts:
            hist = self.get_historial_precios(p["id"], limit=2)
            if len(hist) < 2:
                continue
            precio_nuevo = hist[0]["price_at_tx"]
            precio_ant   = hist[1]["price_at_tx"]
            fecha_nueva  = hist[0]["tx_date"]
            if not precio_ant or precio_ant == 0:
                continue
            if fecha_nueva < cutoff:
                continue  # el cambio no es reciente
            variacion_pct = ((precio_nuevo - precio_ant) / precio_ant) * 100
            if abs(variacion_pct) < 2:
                continue  # ruido menor al 2%
            variaciones.append({
                "id":            p["id"],
                "name":          p["name"],
                "precio_nuevo":  precio_nuevo,
                "precio_ant":    precio_ant,
                "variacion_pct": variacion_pct,
                "fecha":         fecha_nueva[:10],
            })

        variaciones.sort(key=lambda x: abs(x["variacion_pct"]), reverse=True)
        return variaciones
