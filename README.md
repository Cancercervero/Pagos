# Agente bancario por WhatsApp

Un agente en el WhatsApp del negocio: cotiza, aparta horario, cobra por **CoDi** con la API de [pey](https://docs.pey.mx), confirma el pago en el servidor y deja la factura en borrador.

Borrador para el Cursor Hackatón México. La especificación completa está en `INSTRUCCIONES.md`.

## Recorrido

```
Cliente por WhatsApp
  → cotización (el código calcula el total)
  → horario apartado
  → push CoDi del anticipo (POST /codi/pn)
  → webhook firmado de pey + GET /transaction/{id}
  → cita confirmada, ingreso en el libro, panel en vivo
  → el dueño cobra el saldo
  → CFDI 4.0 en borrador
```

Si WhatsApp no responde, el mismo agente está en `/demo` (WhatsApp emulado, sin Meta).

El MCP `agente-bancario` (`.cursor/mcp.json`) expone la herramienta `mensaje`. El emulador, el MCP y el webhook `/webhooks/whatsapp` llaman a la misma función. Conectar Meta después es llenar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_VERIFY_TOKEN`, y registrar el callback. No hay otro cableado.

## Qué es real y qué es simulado

- **Real:** cobros CoDi (push, QR y link), webhooks con firma Standard Webhooks, idempotencia por `webhook-id` y por `transactionId`, WhatsApp Cloud API.
- **Simulado:** el timbrado del CFDI. Se genera XML 4.0 y PDF marcados como borrador, sin PAC ni CSD. Los impuestos son una estimación informativa (IVA 16 % e ISR RESICO). Las devoluciones son manuales: pey no tiene reembolso; el dueño transfiere y el sistema solo anota el movimiento.

## Correr en local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

- Panel: `http://localhost:8000/panel?k=TU_PANEL_KEY`
- Chat de respaldo: `http://localhost:8000/demo?k=TU_PANEL_KEY`
- Salud: `GET /salud`

Pruebas:

```bash
pytest
```

Para recibir webhooks en local hace falta un túnel HTTPS (`cloudflared tunnel --url http://localhost:8000`) y registrar esa URL en pey y en Meta.

## Variables

Están en `.env.example`. Mínimo: `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `OWNER_PHONES`, `PUBLIC_BASE_URL`, `PANEL_KEY`.

Sin `LLM_API_KEY` el recorrido de la demo sigue funcionando con un ruteo de respaldo. El modelo, si está configurado, no decide pagos ni calcula montos.

## Casos que ya contempla

Webhook repetido, misma transacción con otro `webhook-id`, firma inválida, cobro vencido, pago tardío, segundo pago al mismo QR, abono parcial, webhook perdido (se reconcilia con `GET /transaction/{id}`), pey en 503, pago sin conciliar y devolución manual.

## Despliegue

`render.yaml` levanta `uvicorn` y revisa `GET /salud`. En pey el webhook es `https://<tu-app>/webhooks/pey`. En Meta, `https://<tu-app>/webhooks/whatsapp`. SQLite se reinicia en cada deploy; al arrancar se crea el contacto del dueño si `OWNER_PHONES` viene en el entorno.
