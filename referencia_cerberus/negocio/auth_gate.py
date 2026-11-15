"""
🔐 HUMAN-IN-THE-LOOP — Sistema de Autorización Imperial
=========================================================
Ninguna transacción financiera o acción irreversible se ejecuta
sin la aprobación explícita del humano (el Comandante / la dueña).

FLUJO:
  1. Almacenista detecta stock crítico
  2. Almacenista crea una "solicitud pendiente" (PendingOrder)
  3. Donna recibe la alerta y la presenta al humano
  4. Annie formatea el resumen y lo envía por WhatsApp
  5. Humano responde: "SÍ", "NO", o "ESPERA"
  6. Si SÍ → Annie procede con el proveedor
  7. Si NO → se archiva con motivo
  8. Si ESPERA → queda en cola para mañana

REGLA DE ORO:
  El sistema NUNCA gasta dinero ni contacta proveedores
  sin el SÍ explícito del humano autorizado.
"""

from __future__ import annotations
import json
import sqlite3
import logging
from datetime import datetime
from pathlib import Path
from enum import Enum

logger = logging.getLogger("AuthGate")

DB_PATH = Path("Cerberus_Data/hive_memory.db")


# ── Estados de una solicitud ──────────────────────────────────────────────────

class AuthStatus(str, Enum):
    PENDIENTE  = "pendiente"   # Esperando respuesta del humano
    APROBADA   = "aprobada"    # Humano dijo SÍ
    RECHAZADA  = "rechazada"   # Humano dijo NO
    ESPERA     = "espera"      # Humano dijo ESPERA (posponer)
    EJECUTADA  = "ejecutada"   # Ya se procesó tras aprobación
    EXPIRADA   = "expirada"    # Pasó demasiado tiempo sin respuesta


# ── Base de datos de solicitudes ──────────────────────────────────────────────

def _get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_auth_tables():
    with _get_conn() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS auth_solicitudes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo          TEXT NOT NULL,      -- 'orden_compra' | 'pago' | 'contacto_proveedor'
            agente        TEXT NOT NULL,      -- quién propone (almacenista, petra, etc.)
            titulo        TEXT NOT NULL,      -- resumen corto
            detalle       TEXT NOT NULL,      -- JSON con todos los datos
            monto_est     REAL DEFAULT 0,     -- monto estimado (si aplica)
            proveedor     TEXT DEFAULT '',    -- proveedor involucrado
            status        TEXT DEFAULT 'pendiente',
            motivo_rechazo TEXT DEFAULT '',
            creada        TEXT DEFAULT (datetime('now','localtime')),
            respondida    TEXT DEFAULT NULL,
            token         TEXT UNIQUE        -- token corto para responder por WA
        )
        """)


_init_auth_tables()


# ── Generador de token corto ──────────────────────────────────────────────────

def _gen_token() -> str:
    import random, string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ── Crear solicitud ───────────────────────────────────────────────────────────

def crear_solicitud(
    tipo: str,
    agente: str,
    titulo: str,
    detalle: dict,
    monto_est: float = 0,
    proveedor: str = "",
) -> dict:
    """
    Crea una solicitud de autorización pendiente.
    
    Returns:
        dict con id, token, y el mensaje formateado para enviar al humano
    """
    token = _gen_token()
    detalle_json = json.dumps(detalle, ensure_ascii=False)

    with _get_conn() as conn:
        cursor = conn.execute(
            """INSERT INTO auth_solicitudes
               (tipo, agente, titulo, detalle, monto_est, proveedor, token)
               VALUES (?,?,?,?,?,?,?)""",
            (tipo, agente, titulo, detalle_json, monto_est, proveedor, token)
        )
        sol_id = cursor.lastrowid

    logger.info("[AuthGate] Solicitud #%d creada: %s [token: %s]", sol_id, titulo, token)

    # Formatear mensaje para WhatsApp
    mensaje_wa = _formatear_solicitud_wa(sol_id, tipo, titulo, detalle, monto_est, proveedor, token)

    return {
        "id": sol_id,
        "token": token,
        "mensaje_wa": mensaje_wa,
        "status": AuthStatus.PENDIENTE,
    }


def _formatear_solicitud_wa(sol_id: int, tipo: str, titulo: str, detalle: dict,
                             monto_est: float, proveedor: str, token: str) -> str:
    """Formatea la solicitud como mensaje de WhatsApp claro y accionable."""
    lineas = [
        f"🔐 *SOLICITUD DE AUTORIZACIÓN #{sol_id}*",
        f"━━━━━━━━━━━━━━━━━━━━━━━",
        f"📋 *{titulo}*",
        "",
    ]

    if tipo == "orden_compra":
        productos = detalle.get("productos", [])
        for p in productos:
            lineas.append(f"  • {p.get('nombre','?')} — {p.get('cantidad','?')} {p.get('unidad','pza')}")
        if proveedor:
            lineas.append(f"\n🏪 *Proveedor:* {proveedor}")
        if monto_est > 0:
            lineas.append(f"💰 *Monto estimado:* ${monto_est:,.2f} MXN")

    elif tipo == "pago":
        lineas.append(f"💰 *Monto:* ${monto_est:,.2f} MXN")
        if proveedor:
            lineas.append(f"👤 *Para:* {proveedor}")
        if detalle.get("concepto"):
            lineas.append(f"📝 *Concepto:* {detalle['concepto']}")

    elif tipo == "contacto_proveedor":
        lineas.append(f"📞 *Proveedor:* {proveedor}")
        if detalle.get("mensaje"):
            lineas.append(f"💬 *Mensaje a enviar:*\n_{detalle['mensaje']}_")

    lineas += [
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━",
        f"Responde con tu código: *{token}*",
        "",
        f"  ✅ *{token} SÍ* — Autorizar",
        f"  ❌ *{token} NO* — Rechazar",
        f"  ⏳ *{token} ESPERA* — Posponer 24h",
    ]

    return "\n".join(lineas)


# ── Procesar respuesta del humano ─────────────────────────────────────────────

def procesar_respuesta_humano(mensaje: str) -> dict | None:
    """
    Analiza un mensaje del humano buscando un token de autorización.
    
    Formatos válidos:
      "ABC123 SÍ"
      "ABC123 NO porque está muy caro"
      "ABC123 ESPERA"
    
    Returns:
        dict con resultado o None si no es una respuesta de autorización
    """
    import re
    msg_upper = mensaje.upper().strip()

    # Buscar token (6 chars alfanuméricos) + decisión
    match = re.search(r'\b([A-Z0-9]{6})\s+(SÍ|SI|NO|ESPERA|AUTORIZO|AUTORIZA|RECHAZO|RECHAZA)\b', msg_upper)
    if not match:
        return None

    token   = match.group(1)
    decision_raw = match.group(2)

    # Normalizar decisión
    if decision_raw in ("SÍ", "SI", "AUTORIZO", "AUTORIZA"):
        decision = AuthStatus.APROBADA
    elif decision_raw in ("NO", "RECHAZO", "RECHAZA"):
        decision = AuthStatus.RECHAZADA
    else:
        decision = AuthStatus.ESPERA

    # Buscar motivo de rechazo (texto después de la decisión)
    motivo = ""
    rest = mensaje[match.end():].strip()
    if rest and decision == AuthStatus.RECHAZADA:
        motivo = rest[:200]

    # Actualizar en DB
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM auth_solicitudes WHERE token=? AND status='pendiente'",
            (token,)
        ).fetchone()

        if not row:
            return {"error": f"Token {token} no encontrado o ya respondido."}

        conn.execute(
            "UPDATE auth_solicitudes SET status=?, motivo_rechazo=?, respondida=datetime('now','localtime') WHERE token=?",
            (decision.value, motivo, token)
        )
        sol = dict(row)

    logger.info("[AuthGate] Solicitud #%d → %s", sol["id"], decision.value)

    # Retornar resultado para que el sistema actúe
    return {
        "solicitud_id": sol["id"],
        "token":        token,
        "decision":     decision,
        "titulo":       sol["titulo"],
        "tipo":         sol["tipo"],
        "detalle":      json.loads(sol["detalle"]),
        "proveedor":    sol["proveedor"],
        "monto_est":    sol["monto_est"],
        "motivo":       motivo,
    }


# ── Consultas ─────────────────────────────────────────────────────────────────

def get_solicitudes_pendientes() -> list[dict]:
    """Retorna todas las solicitudes esperando respuesta."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM auth_solicitudes WHERE status='pendiente' ORDER BY creada DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_historial(limite: int = 20) -> list[dict]:
    """Historial completo de solicitudes."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM auth_solicitudes ORDER BY creada DESC LIMIT ?",
            (limite,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Helpers para crear tipos comunes ──────────────────────────────────────────

def solicitar_orden_compra(productos: list[dict], proveedor: str, monto_est: float = 0) -> dict:
    """
    Shortcut para crear una solicitud de orden de compra.
    
    productos: [{"nombre": "...", "cantidad": N, "unidad": "..."}]
    """
    nombres = ", ".join(p["nombre"] for p in productos[:3])
    titulo  = f"Reorden de: {nombres}"
    if len(productos) > 3:
        titulo += f" +{len(productos)-3} más"

    return crear_solicitud(
        tipo       = "orden_compra",
        agente     = "almacenista",
        titulo     = titulo,
        detalle    = {"productos": productos},
        monto_est  = monto_est,
        proveedor  = proveedor,
    )


def solicitar_contacto_proveedor(proveedor: str, mensaje: str, contexto: dict = None) -> dict:
    """Shortcut para crear solicitud de contacto con proveedor."""
    return crear_solicitud(
        tipo      = "contacto_proveedor",
        agente    = "annie",
        titulo    = f"Contactar a {proveedor}",
        detalle   = {"mensaje": mensaje, **(contexto or {})},
        proveedor = proveedor,
    )


# ── Singleton de estado ───────────────────────────────────────────────────────

class AuthGate:
    """Interfaz principal del sistema de autorización."""

    @staticmethod
    def nueva_orden(productos: list[dict], proveedor: str, monto: float = 0) -> dict:
        return solicitar_orden_compra(productos, proveedor, monto)

    @staticmethod
    def nuevo_contacto(proveedor: str, mensaje: str) -> dict:
        return solicitar_contacto_proveedor(proveedor, mensaje)

    @staticmethod
    def procesar_respuesta(mensaje: str) -> dict | None:
        return procesar_respuesta_humano(mensaje)

    @staticmethod
    def pendientes() -> list[dict]:
        return get_solicitudes_pendientes()

    @staticmethod
    def historial(n: int = 20) -> list[dict]:
        return get_historial(n)


AUTH = AuthGate()
