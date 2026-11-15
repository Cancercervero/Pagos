"""
manufactura_db.py — Capa de datos de Manufactura Imperial.
Recetas (BOM), órdenes de producción con COGS real FIFO.
Thread-safe via Lock. Mismo patrón que almacen_db.py.
"""
import os
import sqlite3
import threading
from datetime import datetime, timedelta

_DEFAULT_DB = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cerberus_empire.db")
)
_lock = threading.Lock()


class ManufacturaDB:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or _DEFAULT_DB

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def migrate(self):
        """Crea production_orders y production_items si no existen. Idempotente."""
        with _lock:
            conn = self._conn()
            try:
                for sql in [
                    "ALTER TABLE recipes ADD COLUMN output_part_id INTEGER DEFAULT 0",
                    "ALTER TABLE recipes ADD COLUMN yield_pct REAL DEFAULT 1.0",
                ]:
                    try:
                        conn.execute(sql)
                    except sqlite3.OperationalError as e:
                        if "duplicate column" not in str(e).lower():
                            raise
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS production_orders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        recipe_id INTEGER NOT NULL,
                        cantidad_lotes REAL NOT NULL DEFAULT 1,
                        fecha TIMESTAMP NOT NULL,
                        operador TEXT DEFAULT '',
                        costo_total_real REAL DEFAULT 0,
                        output_qty REAL DEFAULT 0,
                        notas TEXT DEFAULT ''
                    );
                    CREATE TABLE IF NOT EXISTS production_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        production_order_id INTEGER NOT NULL,
                        part_id INTEGER NOT NULL,
                        cantidad REAL NOT NULL,
                        costo_unitario REAL NOT NULL DEFAULT 0,
                        costo_total REAL NOT NULL DEFAULT 0
                    );
                """)
                conn.commit()
            finally:
                conn.close()

    # ── Recetas ───────────────────────────────────────────────────────────────────

    def crear_receta(self, name: str, descripcion: str, sale_price: float,
                     ingredientes: list, output_part_id: int,
                     yield_pct: float = 1.0) -> int:
        """
        Crea una receta y sus ingredientes.
        ingredientes: [{"part_id": int, "required_qty": float}]
        yield_pct: fracción del insumo total que se convierte en output (0-1).
        """
        with _lock:
            conn = self._conn()
            try:
                cur = conn.execute(
                    """INSERT INTO recipes (name, description, sale_price, output_part_id, yield_pct)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, descripcion, sale_price, output_part_id, yield_pct)
                )
                rid = cur.lastrowid
                for ing in ingredientes:
                    conn.execute(
                        """INSERT INTO recipe_ingredients (recipe_id, part_id, required_qty)
                           VALUES (?, ?, ?)""",
                        (rid, ing["part_id"], ing["required_qty"])
                    )
                conn.commit()
            finally:
                conn.close()
        return rid

    def get_receta(self, nombre_o_id) -> dict | None:
        conn = self._conn()
        try:
            if isinstance(nombre_o_id, int):
                row = conn.execute("SELECT * FROM recipes WHERE id=?", (nombre_o_id,)).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM recipes WHERE LOWER(name)=?",
                    (str(nombre_o_id).strip().lower(),)
                ).fetchone()
            if not row:
                return None
            receta = dict(row)
            ingredientes = conn.execute(
                "SELECT * FROM recipe_ingredients WHERE recipe_id=?", (receta["id"],)
            ).fetchall()
            receta["ingredientes"] = [dict(i) for i in ingredientes]
            return receta
        finally:
            conn.close()

    def listar_recetas(self) -> list:
        conn = self._conn()
        try:
            rows = conn.execute("SELECT * FROM recipes ORDER BY name").fetchall()
            result = []
            for row in rows:
                r = dict(row)
                ings = conn.execute(
                    "SELECT * FROM recipe_ingredients WHERE recipe_id=?", (r["id"],)
                ).fetchall()
                r["ingredientes"] = [dict(i) for i in ings]
                result.append(r)
            return result
        finally:
            conn.close()

    # ── Análisis ──────────────────────────────────────────────────────────────────

    def calcular_costo_receta(self, recipe_id: int, lotes: float = 1.0) -> dict:
        """
        Estima el costo de producción SIN ejecutar nada.
        Usa precio promedio del stock disponible (AVG purchase_price) por ingrediente.
        Retorna stock_suficiente=False si algún ingrediente no alcanza.
        margen_pct: margen sobre el lote completo = (precio_venta × output_qty - costo_total) / costo_total × 100.
        Retorna margen_pct=None si costo_total==0 (sin datos de precios).
        """
        try:
            from cerberus_core.almacen_db import AlmacenDB
        except ModuleNotFoundError:
            from host_engine.cerberus_core.almacen_db import AlmacenDB

        receta = self.get_receta(recipe_id)
        if not receta:
            raise ValueError(f"Receta {recipe_id} no existe")

        adb = AlmacenDB(db_path=self.db_path)
        conn = self._conn()
        try:
            ingredientes_detalle = []
            costo_total = 0.0
            stock_suficiente = True

            for ing in receta["ingredientes"]:
                pid = ing["part_id"]
                qty_necesaria = ing["required_qty"] * lotes
                stock_actual = adb.get_stock_actual(pid)

                row = conn.execute(
                    """SELECT COALESCE(AVG(purchase_price), 0) as avg_price
                       FROM stock_items WHERE part_id=? AND is_depleted=0""",
                    (pid,)
                ).fetchone()
                precio_est = float(row["avg_price"])
                costo_ing = qty_necesaria * precio_est

                part_row = conn.execute(
                    "SELECT name, unit FROM parts WHERE id=?", (pid,)
                ).fetchone()
                part_name = part_row["name"] if part_row else f"part_{pid}"
                unit = part_row["unit"] if part_row else "u"

                if stock_actual < qty_necesaria:
                    stock_suficiente = False

                ingredientes_detalle.append({
                    "part_id":       pid,
                    "name":          part_name,
                    "unit":          unit,
                    "qty_necesaria": qty_necesaria,
                    "stock_actual":  stock_actual,
                    "precio_est":    round(precio_est, 4),
                    "costo_est":     round(costo_ing, 2),
                })
                costo_total += costo_ing
        finally:
            conn.close()

        # output_qty: yield_pct × total insumo consumido
        total_insumo = sum(i["required_qty"] for i in receta["ingredientes"]) * lotes
        output_qty = total_insumo * receta["yield_pct"]
        precio_venta = float(receta["sale_price"])
        margen_pct = round((precio_venta * output_qty - costo_total) / costo_total * 100, 2) if costo_total > 0 else None

        return {
            "recipe_id":        recipe_id,
            "recipe_name":      receta["name"],
            "lotes":            lotes,
            "ingredientes":     ingredientes_detalle,
            "costo_total_est":  round(costo_total, 2),
            "output_qty_est":   round(output_qty, 2),
            "precio_venta":     precio_venta,
            "margen_pct":       margen_pct,
            "stock_suficiente": stock_suficiente,
        }

    # ── Producción ────────────────────────────────────────────────────────────────

    def producir(self, recipe_id: int, cantidad_lotes: float = 1.0,
                 operador: str = "", notas: str = "") -> dict:
        """
        Ejecuta una orden de producción:
        1. Verifica stock de todos los ingredientes
        2. Descuenta ingredientes via FIFO (almacen_db.salida_stock)
        3. Registra el producto terminado como entrada de stock
        4. Guarda production_order + production_items con COGS real
        """
        try:
            from cerberus_core.almacen_db import AlmacenDB
        except ModuleNotFoundError:
            from host_engine.cerberus_core.almacen_db import AlmacenDB

        receta = self.get_receta(recipe_id)
        if not receta:
            raise ValueError(f"Receta {recipe_id} no existe")

        adb = AlmacenDB(db_path=self.db_path)

        # 1. Verificar stock suficiente para todos los ingredientes
        for ing in receta["ingredientes"]:
            qty_necesaria = ing["required_qty"] * cantidad_lotes
            stock_actual = adb.get_stock_actual(ing["part_id"])
            if stock_actual < qty_necesaria:
                conn = self._conn()
                try:
                    part = conn.execute("SELECT name FROM parts WHERE id=?", (ing["part_id"],)).fetchone()
                finally:
                    conn.close()
                part_name = part["name"] if part else f"part_{ing['part_id']}"
                raise ValueError(
                    f"Stock insuficiente de {part_name}: "
                    f"necesita {qty_necesaria:.1f}, hay {stock_actual:.1f}"
                )

        # 2. Descontar ingredientes FIFO y calcular COGS real
        ts = datetime.now().isoformat()
        ingredientes_consumidos = []
        costo_total_real = 0.0

        for ing in receta["ingredientes"]:
            pid = ing["part_id"]
            qty_consumida = ing["required_qty"] * cantidad_lotes

            # Leer stock_items ANTES del descuento para calcular precio FIFO real
            conn = self._conn()
            try:
                lotes_stock = conn.execute(
                    """SELECT quantity, purchase_price FROM stock_items
                       WHERE part_id=? AND is_depleted=0 ORDER BY entry_date ASC""",
                    (pid,)
                ).fetchall()
            finally:
                conn.close()

            # Calcular precio ponderado FIFO de los primeros lotes que se van a consumir
            restante = qty_consumida
            costo_ing = 0.0
            for lote in lotes_stock:
                if restante <= 0:
                    break
                consumido_lote = min(restante, lote["quantity"])
                costo_ing += consumido_lote * float(lote["purchase_price"])
                restante -= consumido_lote

            costo_unitario_fifo = costo_ing / qty_consumida if qty_consumida > 0 else 0

            # Fetch part name for ingredientes_consumidos
            conn2 = self._conn()
            try:
                part_row = conn2.execute("SELECT name FROM parts WHERE id=?", (pid,)).fetchone()
            finally:
                conn2.close()
            part_name = part_row["name"] if part_row else f"part_{pid}"

            # Descontar del stock (FIFO real)
            adb.salida_stock(pid, qty_consumida, precio_venta=0,
                             notas=f"Producción receta {receta['name']} × {cantidad_lotes} lotes")

            costo_total_real += costo_ing
            ingredientes_consumidos.append({
                "part_id":        pid,
                "name":           part_name,
                "cantidad":       qty_consumida,
                "costo_unitario": round(costo_unitario_fifo, 4),
                "costo_total":    round(costo_ing, 2),
            })

        # 3. Registrar producto terminado en stock
        total_insumo = sum(i["required_qty"] for i in receta["ingredientes"]) * cantidad_lotes
        output_qty = total_insumo * receta["yield_pct"]
        output_part_id = receta["output_part_id"]

        if output_part_id and output_qty > 0:
            conn = self._conn()
            try:
                sup_row = conn.execute("SELECT id FROM suppliers LIMIT 1").fetchone()
            finally:
                conn.close()
            sup_id = sup_row["id"] if sup_row else 1
            costo_unit_output = costo_total_real / output_qty if output_qty > 0 else 0
            lote = f"PROD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            adb.entrada_stock(
                part_id=output_part_id,
                supplier_id=sup_id,
                cantidad=output_qty,
                precio_compra=round(costo_unit_output, 4),
                lote=lote,
            )

        # 4. Guardar production_order + production_items
        with _lock:
            conn = self._conn()
            try:
                cur = conn.execute(
                    """INSERT INTO production_orders
                       (recipe_id, cantidad_lotes, fecha, operador, costo_total_real, output_qty, notas)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (recipe_id, cantidad_lotes, ts, operador,
                     round(costo_total_real, 2), round(output_qty, 2), notas)
                )
                order_id = cur.lastrowid

                for item in ingredientes_consumidos:
                    conn.execute(
                        """INSERT INTO production_items
                           (production_order_id, part_id, cantidad, costo_unitario, costo_total)
                           VALUES (?, ?, ?, ?, ?)""",
                        (order_id, item["part_id"], item["cantidad"],
                         item["costo_unitario"], item["costo_total"])
                    )
                conn.commit()
            finally:
                conn.close()

        return {
            "order_id":                order_id,
            "recipe_name":             receta["name"],
            "lotes":                   cantidad_lotes,
            "costo_real":              round(costo_total_real, 2),
            "output_qty":              round(output_qty, 2),
            "ingredientes_consumidos": ingredientes_consumidos,
        }

    # ── Reportes ──────────────────────────────────────────────────────────────────

    def get_historial_produccion(self, dias: int = 30) -> list:
        """Retorna órdenes de producción de los últimos N días con detalle de items."""
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        try:
            orders = conn.execute(
                """SELECT po.*, r.name as recipe_name
                   FROM production_orders po
                   JOIN recipes r ON r.id = po.recipe_id
                   WHERE po.fecha >= ?
                   ORDER BY po.fecha DESC""",
                (desde,)
            ).fetchall()
            result = []
            for o in orders:
                d = dict(o)
                items = conn.execute(
                    "SELECT * FROM production_items WHERE production_order_id=?", (o["id"],)
                ).fetchall()
                d["items"] = [dict(i) for i in items]
                result.append(d)
        finally:
            conn.close()
        return result

    def get_cogs_periodo(self, dias: int = 30) -> dict:
        """Retorna COGS total y por receta de los últimos N días."""
        desde = (datetime.now() - timedelta(days=dias)).isoformat()
        conn = self._conn()
        try:
            totales = conn.execute(
                """SELECT COALESCE(SUM(cantidad_lotes), 0) as lotes,
                          COALESCE(SUM(costo_total_real), 0) as costo
                   FROM production_orders WHERE fecha >= ?""",
                (desde,)
            ).fetchone()
            por_receta = conn.execute(
                """SELECT r.name, SUM(po.cantidad_lotes) as lotes,
                          SUM(po.costo_total_real) as costo
                   FROM production_orders po
                   JOIN recipes r ON r.id = po.recipe_id
                   WHERE po.fecha >= ?
                   GROUP BY r.id ORDER BY costo DESC""",
                (desde,)
            ).fetchall()
        finally:
            conn.close()
        return {
            "dias":          dias,
            "lotes_totales": float(totales["lotes"]),
            "costo_total":   round(float(totales["costo"]), 2),
            "por_receta":    [{"name": r["name"], "lotes": float(r["lotes"]),
                               "costo": round(float(r["costo"]), 2)} for r in por_receta],
        }
