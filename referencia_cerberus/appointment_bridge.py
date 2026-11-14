"""
APPOINTMENT BRIDGE — Puente de Mando para Citas (V1.0)
Gestiona el ciclo de vida de peticiones de cita entre clientes (Annie/C1),
el Comandante (Donna/C2) y el calendario (Google Calendar).

Flujo:
  1. Annie detecta que un cliente quiere cita → crea ticket "pendiente_aprobacion"
  2. Donna le presenta los huecos al Comandante
  3. Comandante elige → Donna marca el ticket como "aprobado"
  4. Annie confirma con el cliente y crea el evento en Google Calendar
"""
import os
import json
import uuid
import threading
from datetime import datetime

_SYNC_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "Cortex", "appointment_sync.json")
)
_sync_lock = threading.Lock()


def _load() -> list:
    if not os.path.exists(_SYNC_PATH):
        return []
    try:
        with open(_SYNC_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save(tickets: list):
    os.makedirs(os.path.dirname(_SYNC_PATH), exist_ok=True)
    with open(_SYNC_PATH, "w", encoding="utf-8") as f:
        json.dump(tickets, f, ensure_ascii=False, indent=2)


def crear_ticket(cliente: str, asunto: str, source_id: str, huecos: list) -> str:
    """
    Crea un ticket de cita pendiente de aprobación del Comandante.
    huecos: lista de dicts {"fecha": "YYYY-MM-DD", "hora": "HH:MM", "label": "..."}
    Retorna el ticket_id.
    """
    ticket = {
        "ticket_id": str(uuid.uuid4())[:8].upper(),
        "cliente":   cliente,
        "asunto":    asunto,
        "source_id": source_id,
        "huecos":    huecos,
        "eleccion":  None,
        "status":    "pendiente_aprobacion",
        "creado_en": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with _sync_lock:
        tickets = _load()
        tickets.append(ticket)
        _save(tickets)
    return ticket["ticket_id"]


def obtener_pendientes() -> list:
    """Devuelve todos los tickets en estado 'pendiente_aprobacion'."""
    with _sync_lock:
        return [t for t in _load() if t.get("status") == "pendiente_aprobacion"]


def aprobar_ticket(ticket_id: str, eleccion_label: str) -> bool:
    """
    Marca un ticket como aprobado con la elección del Comandante.
    Devuelve True si se encontró y actualizó el ticket.
    """
    with _sync_lock:
        tickets = _load()
        for t in tickets:
            if t["ticket_id"] == ticket_id and t["status"] == "pendiente_aprobacion":
                t["status"] = "aprobado"
                t["eleccion"] = eleccion_label
                _save(tickets)
                return True
    return False


def obtener_aprobados() -> list:
    """Devuelve todos los tickets en estado 'aprobado' listos para que Annie cierre."""
    with _sync_lock:
        return [t for t in _load() if t.get("status") == "aprobado"]


def cerrar_ticket(ticket_id: str):
    """Marca el ticket como cerrado/creado una vez que Annie creó el evento."""
    with _sync_lock:
        tickets = _load()
        for t in tickets:
            if t["ticket_id"] == ticket_id:
                t["status"] = "cerrado"
                break
        _save(tickets)


def generar_alerta_comandante(ticket: dict) -> str:
    """Genera el mensaje de alerta para Donna → Comandante."""
    opciones = "\n".join(f"  {i+1}. {h['label']}" for i, h in enumerate(ticket.get("huecos", [])))
    return (
        f"📅 [CITA PENDIENTE — ID: {ticket['ticket_id']}]\n"
        f"**{ticket['cliente']}** quiere una cita sobre: *{ticket['asunto']}*\n\n"
        f"Tengo estos huecos libres en tu agenda:\n{opciones}\n\n"
        f"¿Cuál eliges, Comandante? (Di el número o la hora directamente)"
    )
