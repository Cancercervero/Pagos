"""Bucle de tool calling contra un endpoint compatible con OpenAI."""

import asyncio
import logging

from app.agente.herramientas import MENU, args_json, ejecutar, esquemas
from app.agente.prompts import sistema
from app.config import env, negocio
from app.personas import historial

logger = logging.getLogger("llm")


async def completar(contacto: dict) -> str:
    from openai import OpenAI

    cliente = OpenAI(base_url=env("LLM_BASE_URL") or None, api_key=env("LLM_API_KEY"))
    mensajes: list[dict] = [
        {"role": "system", "content": sistema(contacto.get("rol") or "cliente", negocio().get("nombre_comercial", "el negocio"))}
    ]
    for turno in historial(contacto["id"], hilo=contacto.get("hilo")):
        mensajes.append({"role": turno["rol"], "content": turno["contenido"]})
    tools = esquemas(contacto.get("rol") or "cliente")
    modelo = env("LLM_MODEL") or "gpt-4o-mini"
    for _ in range(5):
        resp = await asyncio.to_thread(
            lambda: cliente.chat.completions.create(model=modelo, messages=mensajes, tools=tools, temperature=0.2)
        )
        msg = resp.choices[0].message
        if msg.tool_calls:
            mensajes.append(msg.model_dump(exclude_none=True))
            for call in msg.tool_calls:
                resultado = await ejecutar(call.function.name, args_json(call.function.arguments), contacto)
                mensajes.append({"role": "tool", "tool_call_id": call.id, "content": resultado})
            continue
        return (msg.content or "").strip() or MENU
    return MENU
