import sqlite3
import os
import json
import logging
import threading
from datetime import datetime
from typing import List, Dict, Optional

logger = logging.getLogger("EmpireLedger")

# Pool por thread: una conexión reutilizable por thread (thread-safe por diseño de SQLite)
_local = threading.local()

class EmpireLedger:
    """
    EL LIBRO MAYOR IMPERIAL (ERP Nativo V5.1)
    Soberanía total de datos y valuación PEPS (FIFO) industrial.
    """
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "Cerberus_Data")
            self.db_path = os.path.join(base_path, "cerberus_empire.db")
        else:
            self.db_path = db_path

        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Devuelve la conexión del thread actual, creándola si no existe."""
        conn = getattr(_local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            _local.conn = conn
        return conn

    def close(self):
        """Cierra la conexión del thread actual y la elimina del pool."""
        conn = getattr(_local, "conn", None)
        if conn is not None:
            conn.close()
            _local.conn = None

    def _init_db(self):
        """Inicializa el esquema industrial inspirado en InvenTree."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Catálogo de Partes
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS part_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS parts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    sku TEXT UNIQUE,
                    category_id INTEGER,
                    description TEXT,
                    unit TEXT DEFAULT 'pcs',
                    FOREIGN KEY (category_id) REFERENCES part_categories(id)
                )
            ''')

            # 2. Ubicaciones Físicas
            cursor.execute('CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT)')

            # 3. Proveedores
            cursor.execute('CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, contact TEXT)')

            # 4. Stock de Items (Lotes FIFO)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS stock_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    part_id INTEGER,
                    location_id INTEGER,
                    quantity REAL NOT NULL,
                    purchase_price REAL,
                    supplier_id INTEGER,
                    entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_depleted INTEGER DEFAULT 0,
                    FOREIGN KEY (part_id) REFERENCES parts(id),
                    FOREIGN KEY (location_id) REFERENCES locations(id),
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
                )
            ''')

            # 5. Historial Forense (Audit)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS inventory_tx (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stock_item_id INTEGER,
                    tx_type TEXT CHECK(tx_type IN ('IN', 'OUT', 'ADJ')),
                    quantity REAL,
                    tx_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
                )
            ''')
            conn.commit()
            print(f"[🏰 LEDGER] Bóveda Imperial estabilizada en: {self.db_path}")

    def registrar_entrada(self, part_name: str, qty: float, price: float, 
                          category_name: str = "General", supplier_name: str = "Desconocido", 
                          location_name: str = "Almacén Central"):
        """Registra entrada de stock con auditoría."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('INSERT OR IGNORE INTO part_categories (name) VALUES (?)', (category_name,))
            cursor.execute('SELECT id FROM part_categories WHERE name = ?', (category_name,))
            cat_id = cursor.fetchone()[0]

            cursor.execute('INSERT OR IGNORE INTO parts (name, category_id) VALUES (?, ?)', (part_name, cat_id))
            cursor.execute('SELECT id FROM parts WHERE name = ?', (part_name,))
            part_id = cursor.fetchone()[0]

            cursor.execute('INSERT OR IGNORE INTO locations (name) VALUES (?)', (location_name,))
            cursor.execute('SELECT id FROM locations WHERE name = ?', (location_name,))
            loc_id = cursor.fetchone()[0]

            cursor.execute('INSERT OR IGNORE INTO suppliers (name) VALUES (?)', (supplier_name,))
            cursor.execute('SELECT id FROM suppliers WHERE name = ?', (supplier_name,))
            supplier_id = cursor.fetchone()[0]

            cursor.execute('''
                INSERT INTO stock_items (part_id, location_id, quantity, purchase_price, supplier_id)
                VALUES (?, ?, ?, ?, ?)
            ''', (part_id, loc_id, qty, price, supplier_id))
            
            stock_id = cursor.lastrowid
            
            cursor.execute('''
                INSERT INTO inventory_tx (stock_item_id, tx_type, quantity, notes)
                VALUES (?, 'IN', ?, ?)
            ''', (stock_id, qty, f"Entrada industrial via Donna"))

            self.auditar_precio_compra(part_id, price)
            conn.commit()
            print(f"[📥 IN] Entrada: {qty} de {part_name}")

    def registrar_salida_fifo(self, part_name: str, qty_to_remove: float) -> Dict:
        """Consumo PEPS profesional."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT si.id, si.quantity, si.purchase_price
                FROM stock_items si
                JOIN parts p ON si.part_id = p.id
                WHERE p.name = ? AND si.is_depleted = 0
                ORDER BY si.entry_date ASC
            ''', (part_name,))
            
            lots = cursor.fetchall()
            removed = 0
            total_cost = 0
            
            for lot_id, lot_qty, price in lots:
                if qty_to_remove <= 0: break
                can_take = min(lot_qty, qty_to_remove)
                new_qty = lot_qty - can_take
                is_depleted = 1 if new_qty <= 0 else 0
                
                cursor.execute('UPDATE stock_items SET quantity = ?, is_depleted = ? WHERE id = ?', (new_qty, is_depleted, lot_id))
                cursor.execute('INSERT INTO inventory_tx (stock_item_id, tx_type, quantity, notes) VALUES (?, "OUT", ?, ?)', 
                               (lot_id, -can_take, "Salida FIFO"))
                
                qty_to_remove -= can_take
                removed += can_take
                total_cost += (can_take * price)

            conn.commit()
            return {"part": part_name, "removed": removed, "total_cost": total_cost}

    def obtener_inventario_actual(self) -> List[Dict]:
        """Estado consolidado para el Dashboard."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.name, pc.name as category, SUM(si.quantity) as total_qty, AVG(si.purchase_price) as avg_price, p.unit
                FROM parts p
                LEFT JOIN part_categories pc ON p.category_id = pc.id
                JOIN stock_items si ON p.id = si.part_id
                WHERE si.is_depleted = 0
                GROUP BY p.id
            ''')
            return [dict(row) for row in cursor.fetchall()]

    def auditar_precio_compra(self, part_id: int, new_price: float):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT purchase_price FROM stock_items WHERE part_id = ? AND is_depleted = 1 ORDER BY entry_date DESC LIMIT 1', (part_id,))
            prev = cursor.fetchone()
            if prev and new_price > prev[0]:
                print(f"[⚠️ ALERTA] Inflación detectada: +${new_price - prev[0]:.2f}")

    def importar_catalogo_json(self, json_path: str):
        if not os.path.exists(json_path): return
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for s in data.get("servicios", []):
                cursor.execute('INSERT OR REPLACE INTO parts (name, sku, description, unit) VALUES (?, ?, ?, ?)',
                               (s["nombre"], s["id"], s["descripcion"], s["unidad"]))
            conn.commit()

    def get_resumen_diario(self) -> str:
        """Devuelve snapshot del inventario actual en texto plano para reportes.

        Nota: a pesar del nombre 'diario', este método retorna un punto-en-el-tiempo
        del inventario actual consolidado, no los movimientos del día.
        """
        try:
            inventario = self.obtener_inventario_actual()
            if not inventario:
                return "📒 Ledger: sin movimientos registrados."

            total_items = len(inventario)
            valor_total = 0.0
            for row in inventario:
                qty = max(row.get("total_qty") or 0.0, 0.0)
                price = row.get("avg_price")
                valor_total += qty * (price if price is not None else 0.0)

            top = sorted(
                inventario,
                key=lambda r: r.get("total_qty", 0),
                reverse=True
            )[:5]

            lines = ["📒 *Libro Mayor — Resumen Diario:*\n"]
            lines.append(f"  • Productos en catálogo: {total_items}")
            lines.append(f"  • Valor estimado inventario: ${valor_total:,.2f}\n")
            lines.append("  🏆 Top 5 por existencia:")
            for row in top:
                price = row.get("avg_price")
                price_str = f"${price:.2f}" if price is not None else "precio N/D"
                lines.append(
                    f"    - {row.get('name', 'N/A')}: "
                    f"{row.get('total_qty', 0):.1f} {row.get('unit', 'u')} "
                    f"@ {price_str}"
                )
            return "\n".join(lines)
        except Exception as e:
            return f"📒 Ledger no disponible: {e}"

if __name__ == "__main__":
    ledger = EmpireLedger()
    ledger.registrar_entrada("Azúcar 1kg", 50, 15.0, category_name="Insumos")
    print(ledger.obtener_inventario_actual())
