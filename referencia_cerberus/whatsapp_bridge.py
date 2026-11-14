import os
import sys
import asyncio
import json
import httpx
import grpc
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, Query
from dotenv import load_dotenv

# Configuración de entorno y paths
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
sys.path.append(os.path.join(os.path.dirname(__file__), 'host_engine'))

import orange_pb2
import orange_pb2_grpc
from host_engine.cerberus_core.bus_sistema import BUS, EventoCerberus
from host_engine.cerberus_core.presence_manager import PRESENCE

load_dotenv()

# Variables de WhatsApp
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")
WHATSAPP_API_URL = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"

GRPC_HOST = "localhost:50052"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("  CERBERUS WHATSAPP BRIDGE — ACTIVE AND LISTENING")
    print("=" * 60)
    asyncio.create_task(BUS.loop_principal())
    asyncio.create_task(heartbeat_wa())
    yield

app = FastAPI(title="Cerberus WhatsApp Bridge", lifespan=lifespan)

# Cliente HTTP global para enviar mensajes
_http = httpx.AsyncClient(timeout=30)

# gRPC stub
_grpc_channel = grpc.insecure_channel(GRPC_HOST)
_grpc_stub = orange_pb2_grpc.OrangeInferenceStub(_grpc_channel)

async def wa_send_message(to: str, text: str):
    """Envía un mensaje de texto vía WhatsApp Cloud API."""
    if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
        print("[🚨 WA_ERR] Variables de entorno faltantes.")
        return

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text}
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    try:
        resp = await _http.post(WHATSAPP_API_URL, json=payload, headers=headers)
        if resp.status_code != 200:
            print(f"[🚨 WA_ERR] Error al enviar: {resp.text}")
    except Exception as e:
        print(f"[🚨 WA_ERR] Exception al enviar: {e}")

async def procesar_mensaje_wa(wa_id: str, texto: str):
    """
    🚪 ContactGate WhatsApp:
      - Número externo → Annie (modo explosivo)
      - Comandante / chalán → Donna (modo ejecutivo/equipo)
    La cadena NUNCA se rompe.
    """
    print(f"[🚪 GATE→WA] Identificando {wa_id}...")
    try:
        from host_engine.cerberus_core.annie_dispatcher import dispatch_async
        reply = await dispatch_async(wa_id, texto, channel="whatsapp")
        await wa_send_message(wa_id, reply or "En un momento te atiendo. 🙏")
    except Exception as e:
        print(f"[❌ WA→GATE] Error: {e}")
        # Fallback al gRPC original si el gate falla
        try:
            tagged_prompt = f"[SOURCE: WHATSAPP_{wa_id}]\n{texto}"
            request = orange_pb2.InferenceRequest(prompt=tagged_prompt)
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: _grpc_stub.RunDeduction(request, timeout=900)
            )
            reply = response.text if response.text else "Sin respuesta del motor."
            await wa_send_message(wa_id, reply)
        except Exception as e2:
            print(f"[❌ WA→gRPC] Error: {e2}")
            await wa_send_message(wa_id, "⚠️ Sistema temporalmente ocupado. Un momento por favor.")



@app.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """Verificación del Webhook por parte de Meta."""
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        print("[✅ WA] Webhook Verificado.")
        return Response(content=hub_challenge)
    return Response(content="Verification failed", status_code=403)

@app.post("/webhook")
async def handle_webhook(request: Request):
    """Receptor de mensajes y eventos de WhatsApp."""
    try:
        data = await request.json()
        print(f"DEBUG: Webhook recibido: {json.dumps(data, indent=2)}")
        
        # Estructura típica: entry -> changes -> value -> messages
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if messages:
            msg = messages[0]
            wa_id = msg.get("from")
            tipo = msg.get("type")
            
            PRESENCE.report_activity("WHATSAPP")
            
            if tipo == "text":
                texto = msg["text"]["body"]
                print(f"[💬 WA] Mensaje de {wa_id}: {texto}")
                # Publicar en el BUS (opcional, para que otros agentes escuchen)
                await BUS.publicar(EventoCerberus("MENSAJE_ENTRANTE_WA", "BRIDGE_WA", {"wa_id": wa_id, "text": texto}))
                # Procesar directamente para respuesta inmediata
                asyncio.create_task(procesar_mensaje_wa(wa_id, texto))
                
            elif tipo == "image":
                # Lógica de Prueba de Entrega (POD)
                img_id = msg["image"]["id"]
                caption = msg.get("image", {}).get("caption", "")
                await BUS.publicar(EventoCerberus("FOTO_RECIBIDA_WA", "BRIDGE_WA", {"wa_id": wa_id, "file_id": img_id, "caption": caption}))
                await wa_send_message(wa_id, "📸 Foto recibida. Procesando evidencia POD...")
        
        return {"status": "ok"}
    except Exception as e:
        print(f"[🚨 WA_WEBHOOK_ERR] {e}")
        return {"status": "error"}

async def heartbeat_wa():
    """Reporta pulso vital al BUS."""
    while True:
        await BUS.publicar(EventoCerberus("HEARTBEAT", "WHATSAPP_BRIDGE", {"status": "active"}))
        await asyncio.sleep(60)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7892)
