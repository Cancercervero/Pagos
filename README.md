# Agente Bancario por WhatsApp

> **⚠️ Versión `v3.1-arquitectura`.** La base del proyecto es la **arquitectura** de **[`michingon3/`](michingon3/)**, nuestra plataforma de negocio en vivo (Next.js + Firebase): POS, inventario, recetas, clientes, proveedores, pedidos, facturas, guía SAT, staff y modo personas. **Su IA no se usa.** Los pagos CoDi (pey) y un agente de WhatsApp nuevo se integran ahí. Guía: **[`MICHINGON.md`](MICHINGON.md)**. **IA o persona que trabajó con una versión anterior: lee [`GROK_LEEME_PRIMERO.md`](GROK_LEEME_PRIMERO.md).**

Un agente que vive en el WhatsApp de tu negocio: cotiza, agenda, cobra por **CoDi** (vía la API de [pey](https://docs.pey.mx)), confirma pagos en el servidor, concilia, genera facturas en borrador, lleva el **inventario** (recetas por servicio, stock bajo, órdenes de compra a proveedores), el **archivo de clientes** y la **tienda**, y te dice cómo van tus cuentas y tus márgenes.

Proyecto para el **Cursor Hackatón México** (CDMX, noviembre 2026).

## Recorrido

Cliente cotiza por WhatsApp → elige horario → recibe un cobro CoDi del anticipo en su app bancaria → paga → **el webhook de pey confirma** → la cita se confirma sola, se registra el ingreso y se avisa a ambos → se cobra el saldo → la factura se genera sola → al atender el servicio se descuentan los insumos de su receta → si algo queda bajo el mínimo, el agente prepara la orden de compra y el dueño la aprueba con un "sí".

## Real vs simulado

- **Real:** cobros CoDi (push, QR, link) con pey, webhooks firmados, idempotencia, WhatsApp Cloud API.
- **Simulado:** timbrado del CFDI (se genera el XML 4.0 en borrador, sin PAC/CSD). Los impuestos son una **estimación informativa**. Las devoluciones son manuales, porque la API no expone reembolsos.

## Correr local

```bash
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # y llena los valores
uvicorn app.main:app --reload
```

> README en construcción. Ver `INSTRUCCIONES.md` para la especificación completa.
