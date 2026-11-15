"""
DEAL TRACKER — Pipeline CRM de Cerberus (V1.0)
================================================
Gestiona el ciclo de vida de oportunidades de negocio.

Stages del pipeline:
  prospecto → cotizacion_enviada → negociacion → cerrado_ganado | cerrado_perdido

Archivo de datos: Cerberus_Data/Business/deals.json (thread-safe via Lock)

API pública:
    crear_deal(client_id, client_name, asunto, monto=0) → deal_id
    avanzar_deal(deal_id, nuevo_stage) → bool
    agregar_nota(deal_id, nota) → bool
    get_deals_activos() → list
    get_follow_ups(dias=3) → list  # Deals sin actualización reciente
    get_pipeline_summary() → str   # Texto para enviar al Comandante
"""
import os
import json
import uuid
import threading
from datetime import datetime, date, timedelta

_DEALS_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "Business", "deals.json")
)
_lock = threading.Lock()

STAGES = ["prospecto", "cotizacion_enviada", "negociacion", "cerrado_ganado", "cerrado_perdido"]
STAGES_ACTIVOS = {"prospecto", "cotizacion_enviada", "negociacion"}
STAGES_ES = {
    "prospecto":          "🔵 Prospecto",
    "cotizacion_enviada": "📄 Cotización Enviada",
    "negociacion":        "🤝 En Negociación",
    "cerrado_ganado":     "✅ Cerrado (Ganado)",
    "cerrado_perdido":    "❌ Cerrado (Perdido)",
}


def _load() -> list:
    if not os.path.exists(_DEALS_PATH):
        return []
    try:
        with open(_DEALS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save(deals: list):
    os.makedirs(os.path.dirname(_DEALS_PATH), exist_ok=True)
    with open(_DEALS_PATH, "w", encoding="utf-8") as f:
        json.dump(deals, f, ensure_ascii=False, indent=2)


# ── API PÚBLICA ──────────────────────────────────────────────────────────────

def crear_deal(client_id: str, client_name: str, asunto: str, monto: float = 0.0) -> str:
    """Crea un nuevo deal en stage 'prospecto'. Retorna el deal_id."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    deal = {
        "deal_id":     str(uuid.uuid4())[:8].upper(),
        "client_id":   client_id,
        "client_name": client_name,
        "asunto":      asunto,
        "monto":       monto,
        "stage":       "prospecto",
        "notas":       [],
        "cotizacion_path": None,
        "creado_en":   now,
        "actualizado_en": now,
    }
    with _lock:
        deals = _load()
        deals.append(deal)
        _save(deals)
    return deal["deal_id"]


def avanzar_deal(deal_id: str, nuevo_stage: str) -> bool:
    """Mueve un deal al siguiente stage. Retorna True si se actualizó."""
    if nuevo_stage not in STAGES:
        return False
    with _lock:
        deals = _load()
        for d in deals:
            if d["deal_id"] == deal_id:
                d["stage"] = nuevo_stage
                d["actualizado_en"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                _save(deals)
                return True
    return False


def agregar_nota(deal_id: str, nota: str) -> bool:
    """Agrega una nota de seguimiento a un deal."""
    with _lock:
        deals = _load()
        for d in deals:
            if d["deal_id"] == deal_id:
                d["notas"].append({
                    "ts":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "nota": nota,
                })
                d["actualizado_en"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                _save(deals)
                return True
    return False


def set_cotizacion_path(deal_id: str, path: str):
    """Vincula el PDF de cotización al deal."""
    with _lock:
        deals = _load()
        for d in deals:
            if d["deal_id"] == deal_id:
                d["cotizacion_path"] = path
                d["stage"] = "cotizacion_enviada"
                d["actualizado_en"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                _save(deals)
                return


def get_deals_activos() -> list:
    """Retorna todos los deals en stage activo (no cerrados)."""
    with _lock:
        return [d for d in _load() if d.get("stage") in STAGES_ACTIVOS]


def get_follow_ups(dias: int = 3) -> list:
    """Deals activos sin actualización en los últimos N días."""
    cutoff = (date.today() - timedelta(days=dias)).strftime("%Y-%m-%d")
    activos = get_deals_activos()
    return [d for d in activos if d.get("actualizado_en", "")[:10] < cutoff]


def get_deal_by_client(client_id: str) -> list:
    """Retorna todos los deals de un cliente."""
    with _lock:
        return [d for d in _load() if d.get("client_id") == client_id]


def get_pipeline_summary() -> str:
    """Genera texto de resumen del pipeline para el Comandante."""
    with _lock:
        all_deals = _load()

    if not all_deals:
        return "📊 Pipeline vacío — sin deals registrados."

    por_stage = {}
    total_monto = 0.0
    for d in all_deals:
        s = d.get("stage", "?")
        por_stage.setdefault(s, []).append(d)
        if s in STAGES_ACTIVOS:
            total_monto += d.get("monto", 0)

    lines = ["📊 *Pipeline Cerberus*", "━━━━━━━━━━━━━━━━━━"]
    for stage in STAGES:
        deals_en_stage = por_stage.get(stage, [])
        if not deals_en_stage:
            continue
        label = STAGES_ES.get(stage, stage)
        lines.append(f"\n{label} ({len(deals_en_stage)})")
        for d in deals_en_stage[-5:]:  # Máximo 5 por stage
            monto_str = f" — ${d['monto']:,.0f}" if d.get("monto") else ""
            lines.append(f"  • [{d['deal_id']}] {d['client_name']}: {d['asunto'][:40]}{monto_str}")

    lines.append(f"\n💰 *Valor en pipeline activo: ${total_monto:,.0f} MXN*")

    follow_ups = get_follow_ups()
    if follow_ups:
        lines.append(f"\n⏰ *Follow-ups pendientes ({len(follow_ups)}):*")
        for d in follow_ups[:5]:
            lines.append(f"  • {d['client_name']}: {d['asunto'][:40]} (último contacto: {d['actualizado_en'][:10]})")

    return "\n".join(lines)
