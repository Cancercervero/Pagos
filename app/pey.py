"""Cliente HTTP de pey. Los montos que salen de aquí van en pesos."""

import asyncio
import logging

import httpx

from app.config import env

logger = logging.getLogger("pey")

_client: httpx.AsyncClient | None = None


class PeyError(Exception):
    def __init__(self, message: str, tipo: str | None = None, request_id: str | None = None, status: int | None = None):
        super().__init__(message)
        self.tipo = tipo
        self.request_id = request_id
        self.status = status


def set_client(client: httpx.AsyncClient | None) -> None:
    global _client
    _client = client


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20)
    return _client


async def _request(method: str, path: str, json_body: dict | None = None) -> dict:
    base = env("PEY_BASE_URL", "https://api.pey.mx").rstrip("/")
    key = env("PEY_API_KEY")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    espera = 0.2
    ultimo: PeyError | None = None
    for intento in range(3):
        resp = await _http().request(method, base + path, json=json_body, headers=headers)
        if resp.status_code == 503 and intento < 2:
            logger.warning("pey 503 en %s, reintento %s", path, intento + 1)
            await asyncio.sleep(espera)
            espera *= 2
            continue
        if resp.status_code >= 400:
            mensaje, tipo, request_id = _leer_error(resp)
            logger.error("pey %s %s type=%s requestId=%s", resp.status_code, path, tipo, request_id)
            ultimo = PeyError(mensaje, tipo, request_id, resp.status_code)
            raise ultimo
        return resp.json()
    if ultimo:
        raise ultimo
    raise PeyError("pey no respondió", "SERVICE_UNAVAILABLE", status=503)


def _leer_error(resp: httpx.Response) -> tuple[str, str | None, str | None]:
    try:
        cuerpo = resp.json()
    except Exception:
        return (resp.text[:200] or "Error de pey", None, None)
    err = cuerpo.get("error") if isinstance(cuerpo, dict) else None
    if isinstance(err, dict):
        return (
            err.get("message") or "Error de pey",
            err.get("type"),
            err.get("requestId"),
        )
    return ("Error de pey", None, None)


async def crear_push(amount: float, phone_number: str, concept: str, expiration: int = 360, num_ref: str | None = None, metadata: dict | None = None) -> dict:
    cuerpo = {
        "amount": float(amount),
        "phoneNumber": phone_number,
        "concept": concept,
        "expiration": max(360, int(expiration)),
    }
    if num_ref:
        cuerpo["numRef"] = num_ref
    if metadata:
        cuerpo["metadata"] = metadata
    return await _request("POST", "/codi/pn", cuerpo)


async def crear_qr(amount: float, concept: str, expiration: int = 600, num_ref: str | None = None, metadata: dict | None = None) -> dict:
    cuerpo = {
        "amount": float(amount),
        "concept": concept,
        "expiration": int(expiration),
        "generateImage": False,
    }
    if num_ref:
        cuerpo["numRef"] = num_ref
    if metadata:
        cuerpo["metadata"] = metadata
    return await _request("POST", "/codi/qr", cuerpo)


async def crear_link(amount: float, success_url: str, back_url: str, client_reference_id: str, metadata: dict | None = None) -> dict:
    cuerpo = {
        "amount": float(amount),
        "successUrl": success_url,
        "backUrl": back_url,
        "clientReferenceId": client_reference_id,
    }
    if metadata:
        cuerpo["metadata"] = metadata
    return await _request("POST", "/payment-link/create", cuerpo)


async def obtener_transaccion(transaction_id: str) -> dict:
    return await _request("GET", f"/transaction/{transaction_id}")


async def transacciones_qr(qr_id: str) -> dict:
    return await _request("GET", f"/transaction/codi/qr/{qr_id}")


async def obtener_link(link_id: str) -> dict:
    return await _request("GET", f"/payment-link/{link_id}")


async def transacciones_api_key() -> dict:
    return await _request("GET", "/transaction/api-key")
