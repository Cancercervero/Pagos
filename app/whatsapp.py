"""WhatsApp Cloud API. Sin gRPC ni bus: el mensaje entra al agente y ya."""

import logging

import httpx

from app.config import env
from app.telefono import a_telefono10

logger = logging.getLogger("whatsapp")

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20)
    return _client


def _url() -> str:
    version = env("WHATSAPP_API_VERSION", "v21.0")
    phone_id = env("WHATSAPP_PHONE_NUMBER_ID")
    return f"https://graph.facebook.com/{version}/{phone_id}/messages"


async def enviar_texto(wa_id: str, texto: str) -> None:
    await _enviar(wa_id, {"type": "text", "text": {"body": texto[:4000]}})


async def enviar_documento(wa_id: str, link: str, filename: str) -> None:
    await _enviar(wa_id, {"type": "document", "document": {"link": link, "filename": filename}})


async def enviar_imagen(wa_id: str, link: str) -> None:
    await _enviar(wa_id, {"type": "image", "image": {"link": link}})


async def enviar_a_telefono(telefono10: str, texto: str, documento: dict | None = None) -> None:
    from app.personas import obtener_o_crear

    contacto = obtener_o_crear(telefono10)
    wa = contacto.get("wa_id") or ("521" + a_telefono10(telefono10))
    await enviar_texto(wa, texto)
    if documento and documento.get("url"):
        await enviar_documento(wa, documento["url"], documento.get("filename") or "documento.pdf")


async def _enviar(wa_id: str, extra: dict) -> None:
    token = env("WHATSAPP_TOKEN")
    phone_id = env("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_id:
        logger.info("WhatsApp sin token: no envié a %s", wa_id[-4:])
        return
    payload = {"messaging_product": "whatsapp", "to": wa_id, **extra}
    headers = {"Authorization": f"Bearer {token}"}
    resp = await _http().post(_url(), json=payload, headers=headers)
    if resp.status_code == 200:
        return
    logger.error("WhatsApp rechazó el envío status=%s", resp.status_code)
    digitos = "".join(ch for ch in wa_id if ch.isdigit())
    if digitos.startswith("521") and len(digitos) >= 12:
        payload["to"] = "52" + digitos[-10:]
        reintento = await _http().post(_url(), json=payload, headers=headers)
        if reintento.status_code != 200:
            logger.error("reintento 52 tampoco pasó status=%s", reintento.status_code)


async def despachar(mensajes: list[dict]) -> None:
    for m in mensajes:
        try:
            await enviar_a_telefono(m["telefono10"], m["texto"], m.get("documento"))
        except Exception:
            logger.exception("no pude avisar a ***%s", m.get("telefono10", "")[-4:])
