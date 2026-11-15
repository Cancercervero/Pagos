"""Una sola entrada. La usan el MCP, el WhatsApp emulado y, cuando exista, el webhook de Meta."""

import logging

from app.agente import fallback, llm
from app.agente.herramientas import MENU
from app.config import env, negocio, publico
from app.personas import guardar_mensaje, marcar_privacidad, obtener_o_crear, ya_visto_wa

logger = logging.getLogger("entrada")


async def procesar_entrada(telefono10: str, texto: str, wa_id: str | None = None, nombre: str | None = None, wa_message_id: str | None = None, hilo: str = "estetica") -> str:
    if wa_message_id and ya_visto_wa(wa_message_id):
        return ""
    hilo = "estetica"
    contacto = obtener_o_crear(telefono10, wa_id=wa_id, nombre=nombre)
    contacto["hilo"] = hilo
    guardar_mensaje(contacto["id"], "user", texto, hilo)
    aviso = ""
    if not contacto.get("acepto_privacidad"):
        url = negocio().get("aviso_privacidad_url") or ""
        base = publico()
        if not url.startswith("http") or "<" in url or " " in url:
            url = f"{base}/privacidad" if base else "/privacidad"
        aviso = f"Uso tu número y tus pagos solo para darte este servicio. Aviso de privacidad: {url}. ¿Continuamos?\n"
        marcar_privacidad(contacto["id"])
        contacto["acepto_privacidad"] = 1
    try:
        if env("LLM_API_KEY"):
            respuesta = await llm.completar(contacto)
        else:
            respuesta = await fallback.responder(texto, contacto) or MENU
    except Exception:
        logger.exception("el modelo falló; uso el menú de respaldo")
        try:
            respuesta = await fallback.responder(texto, contacto) or MENU
        except Exception:
            logger.exception("el respaldo también falló")
            respuesta = MENU
    completo = aviso + respuesta
    guardar_mensaje(contacto["id"], "assistant", completo, hilo)
    return completo


async def atender_whatsapp(data: dict) -> None:
    from app.whatsapp import enviar_texto

    try:
        entry = (data.get("entry") or [{}])[0]
        changes = (entry.get("changes") or [{}])[0]
        value = changes.get("value") or {}
        if value.get("statuses"):
            return
        messages = value.get("messages") or []
        if not messages:
            return
        msg = messages[0]
        wa_id = msg.get("from") or ""
        message_id = msg.get("id")
        nombre = None
        contacts = value.get("contacts") or []
        if contacts:
            nombre = ((contacts[0].get("profile") or {}).get("name"))
        if msg.get("type") != "text":
            if wa_id:
                await enviar_texto(wa_id, "Por ahora leo texto. Cuéntame qué servicio quieres.")
            return
        texto = ((msg.get("text") or {}).get("body") or "").strip()
        if not texto or not wa_id:
            return
        respuesta = await procesar_entrada(wa_id, texto, wa_id=wa_id, nombre=nombre, wa_message_id=message_id)
        if respuesta:
            await enviar_texto(wa_id, respuesta)
    except Exception:
        logger.exception("webhook de WhatsApp")
