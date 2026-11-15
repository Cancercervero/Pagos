"""
onboarding_engine.py — Flujo de primer arranque de Cerberus.

Detecta si el cliente es nuevo (sin config), lanza el wizard:
1. Solicita archivos (Excel/CSV/Word/PDF)
2. Archivista los procesa y puebla las DBs
3. Pregunta lo que no encontró
4. Escribe config_cliente.json

El Comandante interactúa via Telegram/WhatsApp durante el proceso.
"""
from __future__ import annotations
import json
import logging
import os
import threading
from pathlib import Path

_onboarding_lock = threading.Lock()

logger = logging.getLogger("OnboardingEngine")

_CONFIG_PATH = Path(__file__).parent.parent.parent / "Cortex" / "config_cliente.json"
_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "Cortex" / "config_cliente_template.json"

_PREGUNTAS = [
    ("nombre_empresa",    "¿Cuál es el nombre de tu empresa?"),
    ("giro",              "¿A qué se dedica tu empresa? (Ej: manufactura, retail, servicios)"),
    ("stock_min_pct",     "¿Cuándo debe alertarte el inventario bajo? (Ej: cuando quede el 20% del mínimo)"),
    ("dias_mora",         "¿Cuántos días de mora es aceptable antes de alertar? (Ej: 5 días)"),
    ("pipeline_dias",     "¿Cuántos días sin avance en una venta te preocupa? (Ej: 7 días)"),
    ("venta_alta_mxn",    "¿Cuánto considera una venta grande que merece notificación? (Ej: $50,000 MXN)"),
]


def config_existe() -> bool:
    """True si ya existe un config_cliente.json con onboarding_completo=True."""
    if not _CONFIG_PATH.exists():
        return False
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("onboarding_completo", False)
    except Exception:
        return False


def cargar_config() -> dict:
    """Carga config_cliente.json o devuelve el template vacío."""
    if _CONFIG_PATH.exists():
        try:
            with open(_CONFIG_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    if _TEMPLATE_PATH.exists():
        try:
            with open(_TEMPLATE_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("[Onboarding] Template corrupto: %s", e)
    return {}


def guardar_config(data: dict):
    """Escribe config_cliente.json en Cortex/."""
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("[Onboarding] Config guardado en %s", _CONFIG_PATH)


def generar_mensaje_bienvenida() -> str:
    return (
        "👋 *Hola, Comandante. Soy Cerberus.*\n\n"
        "Es la primera vez que arrancamos juntos. Necesito conocer tu negocio "
        "para configurarme correctamente.\n\n"
        "📁 *Paso 1:* Envíame tus archivos — Excel de inventario, lista de clientes, "
        "catálogo de productos, lo que tengas. Los absorbo y me auto-configuro.\n\n"
        "Si no tienes archivos, responde *'sin archivos'* y te haré unas preguntas rápidas."
    )


def procesar_archivo_onboarding(file_path: str, config: dict) -> str:
    """
    Intenta procesar el archivo enviado durante onboarding.
    Delega al Archivista. Retorna mensaje de confirmación.
    """
    try:
        from skills.cerberus_archivist import CerberusArchivist
        archivist = CerberusArchivist()
        resultado = archivist.procesar_archivo(file_path)
        return f"✅ Archivo procesado: {resultado}"
    except Exception as e:
        logger.error("[Onboarding] Error procesando archivo: %s", e)
        return f"⚠️ No pude procesar el archivo. Procedamos con las preguntas."


def siguiente_pregunta(config: dict) -> tuple[str | None, str | None]:
    """
    Devuelve (campo, pregunta) de la siguiente pregunta sin responder.
    Devuelve (None, None) si el onboarding está completo.
    """
    respuestas = config.get("_respuestas_onboarding", {})
    for campo, pregunta in _PREGUNTAS:
        if campo not in respuestas:
            return campo, pregunta
    return None, None


def registrar_respuesta(config: dict, campo: str, valor: str) -> dict:
    """Registra la respuesta del usuario y actualiza el campo correspondiente."""
    if "_respuestas_onboarding" not in config:
        config["_respuestas_onboarding"] = {}
    config["_respuestas_onboarding"][campo] = valor

    if campo == "nombre_empresa":
        config["nombre_empresa"] = valor
    elif campo == "giro":
        config["giro"] = valor
    elif campo == "stock_min_pct":
        try:
            pct = int("".join(filter(str.isdigit, valor)) or "20")
            config.setdefault("alertas", {})["stock_minimo_global_pct"] = pct
        except Exception:
            pass
    elif campo == "dias_mora":
        try:
            dias = int("".join(filter(str.isdigit, valor)) or "5")
            config.setdefault("alertas", {})["dias_mora_alerta"] = dias
        except Exception:
            pass
    elif campo == "pipeline_dias":
        try:
            dias = int("".join(filter(str.isdigit, valor)) or "7")
            config.setdefault("alertas", {})["pipeline_estancado_dias"] = dias
        except Exception:
            pass
    elif campo == "venta_alta_mxn":
        try:
            mxn = int("".join(filter(str.isdigit, valor)) or "50000")
            config.setdefault("alertas", {})["umbral_venta_alta_mxn"] = mxn
        except Exception:
            pass

    return config


def finalizar_onboarding(config: dict) -> str:
    """Marca el onboarding como completo y guarda la config."""
    config.pop("_respuestas_onboarding", None)
    config.pop("_campo_pendiente", None)
    config["onboarding_completo"] = True
    guardar_config(config)
    empresa = config.get("nombre_empresa", "tu empresa")
    alertas = config.get("alertas", {})
    return (
        f"✅ *¡Cerberus configurado para {empresa}!*\n\n"
        f"A partir de ahora:\n"
        f"• Reportes a las 07:00, 13:00 y 19:00\n"
        f"• Alertas de stock bajo al {alertas.get('stock_minimo_global_pct', 20)}%\n"
        f"• Alertas de mora a los {alertas.get('dias_mora_alerta', 5)} días\n\n"
        f"Estoy listo. ¿Qué quieres hacer primero, Comandante?"
    )
