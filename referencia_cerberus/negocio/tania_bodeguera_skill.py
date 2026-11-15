"""
📦 TANIA — La Bodeguera Imperial
==================================
Agente especialista en recepción y registro de inventario.

FLUJO DE TANIA:
  1. Recibe foto de producto por WhatsApp/Telegram
  2. Analiza la imagen: lee etiqueta, identifica marca, cantidad, caducidad
  3. Pregunta: ¿Es ENTRADA o SALIDA?
  4. Registra en la base de inventario
  5. Notifica al Almacenista para que recalcule niveles

CAPACIDADES:
  - Identificar productos desde foto (por texto en etiqueta)
  - Registro de entradas (compras, recepciones)
  - Registro de salidas (uso en servicio, merma)
  - Detectar caducidades en etiqueta
  - Consultar si un producto ya existe en catálogo

IMPORTANTE:
  Tania NO autoriza órdenes de compra.
  Tania SOLO registra lo que entra y sale físicamente.
  Las órdenes las propone el Almacenista → Donna → Annie → Humano.
"""

from __future__ import annotations
import json
import os
import sqlite3
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Tania")

DB_PATH = Path("Cerberus_Data/hive_memory.db")


# ── Base de inventario ────────────────────────────────────────────────────────

def _get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_inventory_tables():
    """Crea las tablas de inventario si no existen."""
    with _get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS inventario_productos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre      TEXT NOT NULL,
            marca       TEXT DEFAULT '',
            categoria   TEXT DEFAULT 'General',
            unidad      TEXT DEFAULT 'pza',
            stock       REAL DEFAULT 0,
            stock_min   REAL DEFAULT 3,
            costo_unit  REAL DEFAULT 0,
            proveedor   TEXT DEFAULT '',
            caducidad   TEXT DEFAULT '',
            codigo      TEXT DEFAULT '',
            activo      INTEGER DEFAULT 1,
            creado      TEXT DEFAULT (datetime('now','localtime')),
            actualizado TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS inventario_movimientos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            tipo        TEXT NOT NULL,  -- 'entrada' | 'salida' | 'ajuste'
            cantidad    REAL NOT NULL,
            notas       TEXT DEFAULT '',
            autorizado_por TEXT DEFAULT 'tania',
            fecha       TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (producto_id) REFERENCES inventario_productos(id)
        );

        CREATE TABLE IF NOT EXISTS inventario_alertas (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER,
            tipo_alerta TEXT,   -- 'stock_bajo' | 'caducidad' | 'sin_stock'
            mensaje     TEXT,
            atendida    INTEGER DEFAULT 0,
            fecha       TEXT DEFAULT (datetime('now','localtime'))
        );
        """)


_init_inventory_tables()


# ── Identificación de producto desde texto/foto ───────────────────────────────

def identificar_producto_desde_texto(texto: str) -> dict:
    """
    Dado un texto (OCR de foto o descripción manual),
    busca el producto en el catálogo o prepara un registro nuevo.
    """
    texto_lower = texto.lower()
    with _get_conn() as conn:
        # Buscar por nombre o código
        rows = conn.execute(
            "SELECT * FROM inventario_productos WHERE activo=1"
        ).fetchall()

    mejor = None
    mejor_score = 0
    for row in rows:
        score = 0
        palabras = row["nombre"].lower().split() + row["marca"].lower().split()
        for p in palabras:
            if len(p) > 2 and p in texto_lower:
                score += 1
        if row["codigo"] and row["codigo"] in texto:
            score += 10
        if score > mejor_score:
            mejor_score = score
            mejor = dict(row)

    if mejor and mejor_score >= 1:
        return {"encontrado": True, "producto": mejor, "confianza": mejor_score}
    return {"encontrado": False, "texto_original": texto}


def registrar_entrada(producto_id: int, cantidad: float, notas: str = "", costo: float = 0) -> str:
    """Registra una entrada de producto al almacén."""
    with _get_conn() as conn:
        # Actualizar stock
        conn.execute(
            "UPDATE inventario_productos SET stock = stock + ?, costo_unit = CASE WHEN ? > 0 THEN ? ELSE costo_unit END, actualizado = datetime('now','localtime') WHERE id = ?",
            (cantidad, costo, costo, producto_id)
        )
        # Registrar movimiento
        conn.execute(
            "INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, notas, autorizado_por) VALUES (?,?,?,?,?)",
            (producto_id, "entrada", cantidad, notas, "tania")
        )
        # Obtener nombre
        row = conn.execute("SELECT nombre, stock FROM inventario_productos WHERE id=?", (producto_id,)).fetchone()
        nombre = row["nombre"] if row else f"Producto #{producto_id}"
        nuevo_stock = row["stock"] if row else 0

    logger.info("[Tania] Entrada: +%.1f %s → stock: %.1f", cantidad, nombre, nuevo_stock)
    return f"✅ Entrada registrada: +{cantidad} de {nombre}. Stock actual: {nuevo_stock}"


def registrar_salida(producto_id: int, cantidad: float, notas: str = "", servicio: str = "") -> str:
    """Registra una salida de producto del almacén."""
    with _get_conn() as conn:
        row = conn.execute("SELECT nombre, stock, stock_min FROM inventario_productos WHERE id=?", (producto_id,)).fetchone()
        if not row:
            return f"❌ Producto #{producto_id} no encontrado."

        nombre = row["nombre"]
        stock_actual = row["stock"]

        if cantidad > stock_actual:
            return f"⚠️ No hay suficiente {nombre}. Stock: {stock_actual}, solicitado: {cantidad}"

        nuevo_stock = stock_actual - cantidad
        conn.execute(
            "UPDATE inventario_productos SET stock = ?, actualizado = datetime('now','localtime') WHERE id=?",
            (nuevo_stock, producto_id)
        )
        conn.execute(
            "INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, notas) VALUES (?,?,?,?)",
            (producto_id, "salida", cantidad, notas or f"Servicio: {servicio}")
        )

        # Generar alerta si stock bajo
        if nuevo_stock <= row["stock_min"]:
            _generar_alerta(conn, producto_id, "stock_bajo",
                f"⚠️ {nombre}: stock bajo ({nuevo_stock} unidades). Mínimo configurado: {row['stock_min']}")

    return f"📤 Salida registrada: -{cantidad} de {nombre}. Stock actual: {nuevo_stock}"


def agregar_producto_nuevo(nombre: str, marca: str = "", categoria: str = "General",
                           unidad: str = "pza", stock_inicial: float = 0,
                           stock_min: float = 3, costo_unit: float = 0,
                           proveedor: str = "", caducidad: str = "") -> dict:
    """Agrega un producto nuevo al catálogo."""
    with _get_conn() as conn:
        cursor = conn.execute(
            """INSERT INTO inventario_productos
               (nombre, marca, categoria, unidad, stock, stock_min, costo_unit, proveedor, caducidad)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (nombre, marca, categoria, unidad, stock_inicial, stock_min, costo_unit, proveedor, caducidad)
        )
        pid = cursor.lastrowid
        if stock_inicial > 0:
            conn.execute(
                "INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, notas) VALUES (?,?,?,?)",
                (pid, "entrada", stock_inicial, "Stock inicial")
            )

    logger.info("[Tania] Nuevo producto: %s (id=%d)", nombre, pid)
    return {"ok": True, "id": pid, "nombre": nombre, "stock": stock_inicial}


def _generar_alerta(conn, producto_id: int, tipo: str, mensaje: str):
    """Genera una alerta de inventario (interna)."""
    conn.execute(
        "INSERT INTO inventario_alertas (producto_id, tipo_alerta, mensaje) VALUES (?,?,?)",
        (producto_id, tipo, mensaje)
    )


# ── Consultas ─────────────────────────────────────────────────────────────────

def get_stock_critico() -> list[dict]:
    """Retorna productos con stock por debajo del mínimo."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM inventario_productos WHERE activo=1 AND stock <= stock_min ORDER BY stock ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_inventario_completo() -> list[dict]:
    """Retorna todo el inventario activo."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM inventario_productos WHERE activo=1 ORDER BY categoria, nombre"
        ).fetchall()
    return [dict(r) for r in rows]


def get_movimientos_recientes(limite: int = 20) -> list[dict]:
    """Últimos movimientos de inventario."""
    with _get_conn() as conn:
        rows = conn.execute(
            """SELECT m.*, p.nombre as producto_nombre
               FROM inventario_movimientos m
               JOIN inventario_productos p ON m.producto_id = p.id
               ORDER BY m.fecha DESC LIMIT ?""",
            (limite,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Procesador principal de mensajes para Tania ───────────────────────────────

def procesar_mensaje_tania(texto: str, tiene_foto: bool = False, user_id: str = "bodega") -> str:
    """
    Punto de entrada principal para Tania.
    Procesa mensajes de texto (y señal de foto) para gestión de inventario.
    
    Args:
        texto:      Mensaje o descripción del producto
        tiene_foto: True si el mensaje trajo una imagen (OCR ya aplicado)
        user_id:    Quién manda el mensaje
    
    Returns:
        Respuesta de Tania lista para enviar
    """
    from host_engine.cerberus_core.llm_router import ask_llm

    texto_lower = texto.lower()

    # ── Comandos directos ────────────────────────────────────────────────
    if any(w in texto_lower for w in ["stock crítico", "stock critico", "qué falta", "que falta", "alertas"]):
        criticos = get_stock_critico()
        if not criticos:
            return "📦 Todo en orden, Tania dice que no hay productos en nivel crítico."
        lines = [f"  • {p['nombre']} ({p['marca']}): {p['stock']} {p['unidad']} (mín: {p['stock_min']})" for p in criticos]
        return "⚠️ *Tania — Stock Crítico:*\n" + "\n".join(lines)

    if any(w in texto_lower for w in ["inventario", "todo el stock", "qué hay", "que hay"]):
        inv = get_inventario_completo()
        if not inv:
            return "📦 Tania: El catálogo está vacío. Empieza mandando una foto de un producto."
        lines = [f"  {p['categoria']:12} | {p['nombre']:25} | {p['stock']} {p['unidad']}" for p in inv]
        return "📦 *Inventario Completo:*\n```\n" + "\n".join(lines) + "\n```"

    if any(w in texto_lower for w in ["últimos movimientos", "ultimos movimientos", "historial"]):
        movs = get_movimientos_recientes(10)
        if not movs:
            return "📋 Tania: Sin movimientos registrados aún."
        lines = [f"  {m['fecha'][:16]} | {m['tipo']:7} | {m['cantidad']:6} | {m['producto_nombre']}" for m in movs]
        return "📋 *Últimos movimientos:*\n```\n" + "\n".join(lines) + "\n```"

    # ── Identificar producto desde foto/texto ────────────────────────────
    if tiene_foto or any(w in texto_lower for w in ["foto", "escanea", "registra", "entró", "entro", "recibí", "recibi"]):
        resultado = identificar_producto_desde_texto(texto)

        if resultado["encontrado"]:
            p = resultado["producto"]
            return (
                f"📦 *Tania identifica:* {p['nombre']} ({p['marca']})\n"
                f"Stock actual: {p['stock']} {p['unidad']}\n\n"
                f"¿Es *ENTRADA* o *SALIDA*? ¿Cuántas unidades?"
            )
        else:
            # Producto nuevo
            return (
                f"🆕 *Tania:* No reconozco este producto en el catálogo.\n"
                f"¿Cómo se llama? ¿Marca? ¿Unidad (pza/ml/kg)? ¿Stock mínimo que deben tener?\n"
                f"_(Responde y lo agrego al sistema)_"
            )

    # ── LLM de Tania para conversación natural ───────────────────────────
    tania_system = (
        "Eres Tania, la bodeguera del salón de belleza. "
        "Tu único trabajo es el inventario: entradas, salidas, stock, caducidades. "
        "Hablas de forma directa y práctica. Si alguien te manda una foto de un producto, "
        "le preguntas si es entrada o salida y cuántas unidades. "
        "Siempre reportas al Almacenista cuando detectas stock bajo. "
        "Nunca autorizas compras — eso lo decide la dueña."
    )

    return ask_llm(texto, system=tania_system, agent_id="tania", user_id=user_id)
