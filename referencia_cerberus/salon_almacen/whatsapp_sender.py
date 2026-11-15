"""
whatsapp_sender.py — Envío de mensajes vía Meta WhatsApp Business API.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
Requiere en .env:
  WHATSAPP_TOKEN    — token permanente de Meta
  WHATSAPP_PHONE_ID — Phone Number ID del número de negocio

Dos modos:
  1. Mensaje libre (free-form) — solo funciona si el destinatario escribió
     al número de negocio en las últimas 24h (ventana de conversación abierta)
  2. Template — funciona siempre, pero el template debe estar aprobado en Meta
     Business Manager. Incluimos template básico "orden_pedido".

Para pedidos a proveedores: usar template si es primer contacto,
free-form si ya hay conversación activa.
"""
import logging
import os

import requests

logger = logging.getLogger("WhatsAppSender")

_API_VERSION = "v19.0"
_BASE_URL = "https://graph.facebook.com"


def _token() -> str:
    t = os.getenv("WHATSAPP_TOKEN", "")
    if not t:
        raise EnvironmentError("WHATSAPP_TOKEN no configurado en .env")
    return t


def _phone_id() -> str:
    pid = os.getenv("WHATSAPP_PHONE_ID", "")
    if not pid:
        raise EnvironmentError("WHATSAPP_PHONE_ID no configurado en .env")
    return pid


def _endpoint() -> str:
    return f"{_BASE_URL}/{_API_VERSION}/{_phone_id()}/messages"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_token()}",
        "Content-Type": "application/json",
    }


def _normalizar_numero(numero: str, codigo_pais: str = "52") -> str:
    """
    Convierte número a formato E.164 sin + ni espacios.
    codigo_pais: prefijo sin '+'. Default 52 (México).
    Leer de config["codigo_pais"] al llamar si el salón no es mexicano.
    """
    limpio = "".join(c for c in numero if c.isdigit())
    if len(limpio) == 10:
        limpio = codigo_pais + limpio
    return limpio


# ── Mensaje libre (free-form text) ────────────────────────────────────────────

def enviar_texto(numero: str, mensaje: str) -> dict:
    """
    Envía texto libre. Requiere ventana de 24h abierta.
    Úsalo para confirmaciones, respuestas, alertas de seguimiento.
    """
    dest = _normalizar_numero(numero)
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": dest,
        "type": "text",
        "text": {"preview_url": False, "body": mensaje},
    }
    try:
        r = requests.post(_endpoint(), headers=_headers(), json=payload, timeout=15)
        data = r.json()
        if r.status_code == 200:
            msg_id = data.get("messages", [{}])[0].get("id", "?")
            logger.info(f"[WhatsApp] Enviado a {dest} — id={msg_id}")
            return {"ok": True, "message_id": msg_id}
        else:
            logger.error(f"[WhatsApp] Error {r.status_code}: {data}")
            return {"ok": False, "error": data}
    except Exception as e:
        logger.error(f"[WhatsApp] Excepción: {e}")
        return {"ok": False, "error": str(e)}


# ── Template: orden de pedido ─────────────────────────────────────────────────

def enviar_orden_proveedor(numero: str, nombre_proveedor: str,
                            nombre_salon: str, lista_productos: str) -> dict:
    """
    Envía orden de compra usando template aprobado 'orden_pedido'.

    Template en Meta Business Manager debe tener:
      Nombre: orden_pedido
      Idioma: es_MX
      Categoría: UTILITY
      Componentes:
        HEADER (TEXT): "Pedido de {{1}}"
        BODY: "Hola {{2}}, somos {{3}}.\nNecesitamos:\n{{4}}\n¿Pueden confirmar disponibilidad?"
        FOOTER: "Donna — Sistema de Almacén Inteligente"

    Si el template no está aprobado, cae a texto libre.
    """
    dest = _normalizar_numero(numero)
    payload = {
        "messaging_product": "whatsapp",
        "to": dest,
        "type": "template",
        "template": {
            "name": "orden_pedido",
            "language": {"code": "es_MX"},
            "components": [
                {
                    "type": "header",
                    "parameters": [{"type": "text", "text": nombre_salon}],
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre_proveedor},
                        {"type": "text", "text": nombre_salon},
                        {"type": "text", "text": lista_productos},
                    ],
                },
            ],
        },
    }
    try:
        r = requests.post(_endpoint(), headers=_headers(), json=payload, timeout=15)
        data = r.json()
        if r.status_code == 200:
            msg_id = data.get("messages", [{}])[0].get("id", "?")
            logger.info(f"[WhatsApp] Template orden_pedido → {dest} — id={msg_id}")
            return {"ok": True, "message_id": msg_id, "via": "template"}
        else:
            logger.warning(f"[WhatsApp] Template falló ({r.status_code}), intentando texto libre...")
            # Fallback a texto libre
            msg_libre = (
                f"Hola {nombre_proveedor}, somos {nombre_salon} 👋\n\n"
                f"Necesitamos el siguiente pedido:\n{lista_productos}\n\n"
                f"¿Pueden confirmar disponibilidad y precio? 🙏"
            )
            return {**enviar_texto(numero, msg_libre), "via": "free_text_fallback"}
    except Exception as e:
        logger.error(f"[WhatsApp] Excepción en template: {e}")
        return {"ok": False, "error": str(e)}


# ── Alerta de stock bajo (notificación interna) ───────────────────────────────

def alertar_admin(numero_admin: str, salon: str, productos_bajos: list[dict]) -> dict:
    """
    Avisa al admin por WhatsApp cuando hay stock bajo.
    productos_bajos: [{"nombre": str, "stock_actual": float, "unidad": str}, ...]
    """
    if not productos_bajos:
        return {"ok": True, "skip": "sin_alertas"}

    lista = "\n".join([
        f"• {p['nombre']}: {p['stock_actual']:.1f} {p['unidad']}"
        for p in productos_bajos[:8]
    ])
    msg = (
        f"🔔 *{salon} — Alerta de stock*\n\n"
        f"Estos productos están bajo mínimo:\n{lista}\n\n"
        f"_Aldo ya preparó la orden de pedido. ¿Apruebas?_"
    )
    return enviar_texto(numero_admin, msg)


# ── Confirmación de orden enviada ─────────────────────────────────────────────

def confirmar_envio_orden(numero_admin: str, orden_id: str, proveedor: str) -> dict:
    msg = (
        f"✅ Orden {orden_id} enviada a {proveedor} por WhatsApp.\n"
        f"_Aldo está esperando confirmación del proveedor._"
    )
    return enviar_texto(numero_admin, msg)
