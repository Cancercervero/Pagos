"""
valentina.py — Archivo de Clientas del Salón.

Valentina guarda la historia de cada clienta:
  qué servicios pide, su fórmula personal, cuándo fue la última vez.

Angélica le pregunta ANTES de aplicar una receta:
  "¿tienes fórmula de la señora Martínez para keratina?"
Si Valentina la tiene → Angélica usa esa fórmula (no la genérica).
Si no → receta genérica → Angélica pregunta si se guarda.

Valentina no toca el almacén. Solo conoce a las clientas.
"""
import logging

logger = logging.getLogger("Valentina")

_PERSONALIDAD = (
    "Soy Valentina. Recuerdo a cada clienta del salón. "
    "Sé qué lleva cada quien, cuándo fue la última vez y qué le quedó bien. "
    "Angélica me consulta antes de aplicar cualquier fórmula."
)


def _db(db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


# ── Buscar y registrar clientas ───────────────────────────────────────────────

def buscar_cliente(nombre: str, db_path=None) -> dict | None:
    """Búsqueda fuzzy por nombre o teléfono."""
    db = _db(db_path)
    return db.buscar_cliente_fuzzy(nombre)


def registrar_cliente(nombre: str, telefono: str = "", notas: str = "",
                      db_path=None) -> dict:
    """Crea nueva clienta. Retorna la clienta recién creada."""
    db = _db(db_path)
    cid = db.registrar_cliente(nombre, telefono, notas)
    logger.info(f"[Valentina] Nueva clienta registrada: {nombre} (id={cid})")
    return {"id": cid, "nombre": nombre, "telefono": telefono}


def get_o_crear(nombre: str, telefono: str = "", db_path=None) -> dict:
    """Busca clienta; si no existe la crea."""
    cliente = buscar_cliente(nombre, db_path)
    if cliente:
        return cliente
    return registrar_cliente(nombre, telefono, db_path=db_path)


# ── Fórmulas personales ───────────────────────────────────────────────────────

def get_formula(client_id: int, servicio: str, db_path=None) -> dict | None:
    """
    Retorna la fórmula personal de la clienta para ese servicio.
    None si no existe.
    formula: [{"part_id": X, "nombre": Y, "cantidad": Z, "unidad": "ml"}, ...]
    """
    db = _db(db_path)
    return db.get_formula_cliente(client_id, servicio)


def guardar_formula(client_id: int, servicio: str, formula: list,
                    notas: str = "", db_path=None) -> str:
    """Guarda o actualiza la fórmula personal de la clienta."""
    db = _db(db_path)
    db.guardar_formula_cliente(client_id, servicio, formula, notas)
    logger.info(f"[Valentina] Fórmula guardada: cliente {client_id} — {servicio}")
    return f"✅ Valentina guardó la fórmula de {servicio} para esta clienta."


def registrar_visita(client_id: int, servicio: str, formula_usada: list,
                     db_path=None) -> None:
    """Actualiza fecha de última visita (upsert de fórmula con fecha actual)."""
    db = _db(db_path)
    formula_existente = db.get_formula_cliente(client_id, servicio)
    formula = formula_existente["formula"] if formula_existente else formula_usada
    db.guardar_formula_cliente(client_id, servicio, formula)


# ── Historial y alertas ───────────────────────────────────────────────────────

def historial_cliente(nombre: str, db_path=None) -> str:
    """Historial de servicios de una clienta, formateado para Telegram."""
    db = _db(db_path)
    cliente = db.buscar_cliente_fuzzy(nombre)
    if not cliente:
        return f"⚠️ Valentina: no encontré clienta con nombre *{nombre}*."

    historial = db.get_historial_cliente(cliente["id"])
    lines = [f"👩 *{cliente['nombre']}*"]
    if cliente.get("telefono"):
        lines.append(f"  📱 {cliente['telefono']}")

    if not historial:
        lines.append("  Sin servicios registrados aún.")
        return "\n".join(lines)

    lines.append("\n*Servicios:*")
    for h in historial:
        fecha = (h.get("ultima_visita") or "")[:10]
        n_ing = len(h["formula"])
        lines.append(f"  • {h['servicio']} — {fecha} ({n_ing} ingredientes)")
        if h.get("notas"):
            lines.append(f"    _{h['notas']}_")
    return "\n".join(lines)


def clientes_inactivas(dias: int = 42, db_path=None) -> str:
    """Clientas que llevan más de N días sin visita. Default 6 semanas."""
    db = _db(db_path)
    inactivas = db.get_clientes_inactivos(dias)
    if not inactivas:
        return f"✅ Valentina: todas las clientas han venido en los últimos {dias} días."

    lines = [f"😴 *Clientas sin visita en +{dias} días:*\n"]
    for c in inactivas[:10]:
        ultima = (c.get("ultima") or "nunca")[:10]
        linea = f"  • *{c['nombre']}*"
        if c.get("telefono"):
            linea += f" — 📱 {c['telefono']}"
        linea += f" (última: {ultima})"
        lines.append(linea)
    return "\n".join(lines)


def listar_clientes(db_path=None) -> str:
    db = _db(db_path)
    clientes = db.listar_clientes()
    if not clientes:
        return "👩 Valentina: sin clientas registradas.\nEstilista puede decir: _keratina para nueva clienta [nombre]_"
    lines = [f"👩 *Clientas registradas ({len(clientes)}):*\n"]
    for c in clientes[:20]:
        lines.append(f"  • *{c['nombre']}*" + (f" — {c['telefono']}" if c.get("telefono") else ""))
    if len(clientes) > 20:
        lines.append(f"  _...y {len(clientes)-20} más_")
    return "\n".join(lines)


# ── Interfaz para Angélica ────────────────────────────────────────────────────

def consultar_formula(nombre_cliente: str, servicio: str,
                      db_path=None) -> dict:
    """
    Angélica llama esto antes de aplicar receta.
    Retorna:
      {"encontrada": True, "cliente": {...}, "formula": [...]}
      {"encontrada": False, "cliente": None, "formula": []}
    """
    db = _db(db_path)
    cliente = db.buscar_cliente_fuzzy(nombre_cliente)
    if not cliente:
        return {"encontrada": False, "cliente": None, "formula": []}

    formula_row = db.get_formula_cliente(cliente["id"], servicio)
    if not formula_row:
        return {"encontrada": False, "cliente": cliente, "formula": []}

    return {
        "encontrada": True,
        "cliente":   cliente,
        "formula":   formula_row["formula"],
        "notas":     formula_row.get("notas", ""),
    }


def reporte_valentina(db_path=None) -> str:
    """Resumen rápido para el reporte matutino de Donna."""
    db = _db(db_path)
    clientes = db.listar_clientes()
    inactivas = db.get_clientes_inactivos(dias=42)
    lines = [f"👩 *Valentina:* {len(clientes)} clientas en archivo"]
    if inactivas:
        nombres = ", ".join([c["nombre"].split()[0] for c in inactivas[:3]])
        lines.append(f"  😴 Sin visita 6+ semanas: {nombres}" + (" y más" if len(inactivas) > 3 else ""))
    return "\n".join(lines)
