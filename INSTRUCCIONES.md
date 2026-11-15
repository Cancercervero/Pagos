# Agente Bancario por WhatsApp: instrucciones maestras

> Documento fuente de verdad para quien programe este proyecto (Cursor, Grok o una persona).
> Léelo completo antes de escribir código. Si algo aquí choca con tu intuición, gana este documento.
> Si algo choca con `docs/pey_openapi.json`, gana el OpenAPI y se corrige este documento.

---

## 0. Contexto

- **Evento:** Cursor Hackatón México (CDMX), sábado 14 de noviembre.
- **Cierre de entrega:** **domingo 15 de noviembre, 1:00 PM hora CDMX**, un proyecto por equipo.
- **Qué se entrega en el formulario:**
  - nombre del equipo y descripción
  - **repositorio público (obligatorio)**
  - link de la app en vivo (preferido)
  - video demo (opcional)
  - correos de los integrantes
- **Riel de pago:** CoDi (Banxico) a través de la API de **pey** (`https://api.pey.mx`). Documentación en `docs.pey.mx`. La especificación completa está en `docs/pey_openapi.json`.
- **Código previo:** en `referencia_cerberus/` está lo que ya construimos en Cerberus. **Son referencia, no dependencia.** No los importes tal cual: dependen de rutas y módulos que no existen aquí. Cópialos y adáptalos al módulo nuevo que corresponda (ver la sección 15). Hay tres grupos:
  - `referencia_cerberus/*.py`: WhatsApp, cotizaciones, citas, cobranza, ventas, CFDI, router y LLM.
  - `referencia_cerberus/salon_almacen/`: **producto completo "Donna"**, el almacén inteligente para salones operado por WhatsApp/Telegram, con su equipo de agentes: Enzo (almacenista), Angélica y recetas (costeo y fórmulas), Aldo (compras a proveedores), Valentina (archivo de clientas), Isabel (predicción), Tomás (márgenes), Verónica (auditoría), expediente (estilistas), onboarding, ingesta de inventario, seguridad, cron de reportes y envío por WhatsApp. Lee `DONNA_PROPUESTA_COMERCIAL.md`: explica el valor de negocio.
  - `referencia_cerberus/negocio/`: módulos de negocio de Cerberus. Inventario (`almacen_db`, `empire_ledger`, `almacen_skill`, `almacenista_skill`, `tania_bodeguera_skill`), ventas y CRM (`ventas_skill`, `deal_tracker`, `business_followup`), atención a clientes (`annie_empathy`, `contact_gate`, `lingua_detector`, `annie_reporter`), onboarding del negocio (`onboarding_engine`, `config_cliente_template.json`), alertas (`alerta_imperativa`), manufactura y recetas (`manufactura_db`, `manufactura_skill`), caja y presupuesto (`cajero_ledger`, `budget_sentinel`), pronóstico (`prophet_forecasting`) y control de acceso (`auth_gate`).

## 1. Reglas del reto (hoja oficial "20 ideas para construir con pey")

> "Un pago confirmado puede iniciar un trabajo, activar un equipo o cambiar una experiencia en vivo. Elige un caso y demuestra el recorrido completo."

Requisitos que los jueces van a revisar. Todos son obligatorios:

1. **Una pantalla, un cobro y una acción verificable.** El recorrido debe ir de punta a punta.
2. **Confirma el pago desde el servidor:** por webhook firmado y/o consultando `GET /transaction/{id}`. Nunca confíes en lo que diga el cliente ni en el frontend.
3. **Evita ejecutar dos veces la misma orden (idempotencia).** Un webhook repetido no puede agendar dos citas, registrar dos ingresos ni mandar dos facturas.
4. **Si simulas algo** (por ejemplo, el timbrado del CFDI), **dilo en la demo y en la interfaz.**
5. **Antes de prometer, prueba las notificaciones en el banco elegido.**
6. **Un pago no prueba identidad ni entrega.**
7. **Define qué pasa con pagos tardíos, fallas y devoluciones** (ver la sección 10).

Ideas de la hoja que este proyecto cubre en un solo flujo: **#2** pedidos por WhatsApp, **#3** cotización que arranca el trabajo, **#4** anticipo que confirma una cita y **#19** facturas que se concilian solas.

## 2. Producto

**"Tu agente bancario en WhatsApp."** Un negocio (o una persona) conecta el agente a su WhatsApp, y el agente atiende, cotiza, agenda, cobra por CoDi, da seguimiento, concilia y lleva las cuentas. Es como tener un pequeño equipo de departamentos dentro del chat.

### Departamentos (herramientas del agente)

| Departamento | Qué hace | Lo usa |
|---|---|---|
| Cotizaciones | Arma la cotización desde el catálogo y genera el PDF | Cliente |
| Agenda / Citas | Ofrece horarios; la cita queda *apartada* y se *confirma* al pagar el anticipo | Cliente, dueño |
| Cobranza | Crea cobros CoDi (push al banco, QR o link), manda recordatorios y detecta expirados y tardíos | Automático, dueño |
| Facturas | Genera el CFDI 4.0 en **borrador** (XML + PDF) cuando un cobro se liquida. **El timbrado está simulado** | Automático, dueño |
| Libro y gastos | Registra ingresos automáticos (por webhook) y gastos manuales (dueño), y calcula el saldo | Automático, dueño |
| Impuestos (SAT) | Da una **estimación informativa** de IVA y del ISR RESICO del mes. No es asesoría fiscal | Dueño |
| Seguimiento | Avisa al cliente y al dueño de cada cambio de estado | Automático |
| **Almacén / Inventario** (Enzo) | Entradas, salidas, mermas, stock actual y alertas de stock bajo. Descuenta insumos solo cuando se atiende un servicio pagado o se vende un producto | Automático, dueño, staff |
| **Recetas y costeo** (Angélica + recetas) | Cada servicio tiene su receta de insumos. "Hice un tinte" descuenta todo de una vez. Calcula el costo real por servicio | Automático, dueño |
| **Compras a proveedores** (Aldo) | Con stock bajo arma la orden de compra; el dueño la aprueba con un "sí" y sale por WhatsApp al proveedor. Al recibirla, registra la entrada y alerta si subió el precio | Dueño |
| **Tienda** | Venta de productos (shampoo, tratamientos) por WhatsApp: pedido → cobro CoDi → pago confirmado → salida de stock → "listo para recoger". Idea #2 de la hoja | Cliente, dueño |
| **Archivo de clientes** (Valentina) | Historial de visitas, fórmula personal de cada clienta y clientas inactivas (6+ semanas) para mandarles seguimiento | Automático, dueño |
| **Análisis y márgenes** (Isabel, Tomás, Verónica) | Días de stock restantes, fechas de agotamiento, margen por servicio y producto, variaciones de precio de proveedor y anomalías de uso | Dueño |
| **Atención a clientes** (Annie) | Tono cálido y profesional, detección de idioma, filtro de contactos, bitácora de interacciones | Todos |
| **Onboarding del negocio** | Entrevista por WhatsApp para dar de alta el negocio: nombre, servicios, precios, inventario inicial (Excel, foto o texto), proveedores y staff | Dueño |

### Roles por número de teléfono
- **Dueño:** su teléfono está en `OWNER_PHONES`. Tiene acceso a todo: finanzas, gastos, impuestos, agenda, cobro de saldos y cobros libres, almacén, compras, márgenes y clientes.
- **Staff** (estilistas o empleados): sus teléfonos están en `STAFF_PHONES`. Pueden reportar uso de insumos ("usé 2 tubos de tinte"), consultar stock y marcar un servicio como atendido. **No ven costos, márgenes ni finanzas** (misma regla de permisos que `salon_almacen/config.json`).
- **Cliente:** cualquier otro número. Puede ver el catálogo, cotizar, aceptar, elegir horario, comprar productos, pagar, consultar su saldo y pedir que le reenvíen un cobro.
- **Modo persona** (pitch, prioridad baja): el mismo motor sirve a una persona para cobrar adelantos y gastos compartidos y llevar su control. En código basta con `crear_cobro_libre` + `registrar_gasto` + `resumen_finanzas`.

## 3. Recorrido de la demo (esto es lo que se debe ver funcionando)

Participan dos teléfonos: el del **dueño** y el del **cliente**. Ambos escriben primero al bot, por la ventana de 24 h de WhatsApp (sección 8).

1. **Cliente:** "Hola, quiero cotizar un corte y un tinte" → el agente responde con la cotización (folio, partidas, IVA, total) y el PDF.
2. **Cliente:** "Va, lo quiero" → el agente ofrece 3 horarios.
3. **Cliente:** "El de las 5" → la cita queda **apartada**. El agente crea el cobro del **anticipo** (porcentaje en `negocio.json`, 50 % por defecto) y lo envía como **notificación push CoDi** al celular del cliente (`POST /codi/pn`). Por WhatsApp avisa: "Te llegó un cobro de $X a tu app bancaria, tienes 6 minutos".
4. El cliente autoriza en su app bancaria.
5. **Llega el webhook `codi.pn.payment_received`** → se verifica la firma → se deduplica → se confirma con `GET /transaction/{id}` (status `PAID`) → cobro `pagado` → ingreso en el libro → cita **confirmada**. Mensajes a cliente y dueño. **El panel cambia en vivo.**
6. **Dueño:** "Cóbrale el resto a [cliente]" → segundo cobro por el saldo → pago → la cotización queda `liquidada` → se generan el **CFDI borrador** y el PDF, y se envían.
7. **Dueño:** "¿Cómo voy este mes?" → cobrado, por cobrar, gastos, utilidad y estimación de IVA/ISR (marcada como estimación).
8. **Dueño:** "Gasté 200 en tinte, proveedor X" → gasto registrado, el resumen se actualiza.
9. **Staff o dueño:** "Ya quedó el tinte de [cliente]" → se aplica la **receta** del servicio y se descuentan los insumos del almacén (tubo de tinte, guantes, papel aluminio). Valentina registra la visita y la fórmula de la clienta. El margen real del servicio queda en el resumen.
10. El tinte queda **bajo el mínimo** → alerta al dueño: "Tinte permanente: quedan 2, se acaba en ~4 días. ¿Mando el pedido a Proveedor Salón?" → **Dueño:** "sí" → Aldo genera la orden de compra y la envía al proveedor por WhatsApp.
11. **(Tienda, si da tiempo) Cliente:** "¿Tienen shampoo matizador?" → precio y stock → "lo quiero" → cobro CoDi → pago confirmado → salida de stock → "Listo para recoger".

Los pasos 9 y 10 son la cadena más fuerte para los jueces: **el pago dispara trabajo real**. Pagado → servicio → inventario → compra al proveedor, todo verificable en el panel.

Montos de la demo: **$1 a $5 MXN reales**, o $0.01 para pruebas. pey no tiene sandbox y recomienda probar en producción con montos pequeños.

**Hito mínimo entregable (si todo lo demás falla):** el panel web con un botón que crea un cobro, el pago real y el panel que cambia a "pagado" por webhook. Eso solo ya cumple la regla 1. Constrúyelo primero (fase 1).

## 4. Stack y estructura

- **Python 3.11+ y FastAPI.** Un solo servicio.
- **SQLite** (archivo `data/app.db`). Simple y suficiente para la demo. Supabase queda como mejora futura; no se implementa hoy.
- **LLM vía cliente compatible con OpenAI** (paquete `openai`), configurable por entorno para usar Grok (xAI), Gemini o el que haya con créditos. Ver la sección 9.
- **WhatsApp Cloud API** (Meta Graph API).
- Panel web: HTML + JS sin framework, servido por FastAPI, refrescando cada 2–3 s con `fetch`.
- Despliegue: Render o Railway (HTTPS público, necesario para ambos webhooks).

```
agente-bancario/
├── app/
│   ├── main.py              # FastAPI: rutas, arranque, tarea de fondo
│   ├── config.py            # lee .env y data/negocio.json
│   ├── db.py                # esquema SQLite + helpers (transacciones atómicas)
│   ├── pey.py               # cliente HTTP de pey (QR, push, link, transacciones)
│   ├── webhooks_pey.py      # verificación de firma + procesamiento idempotente
│   ├── whatsapp.py          # recibir/enviar mensajes, documentos, imágenes
│   ├── telefono.py          # normalización de números (WhatsApp ↔ 10 dígitos)
│   ├── tareas.py            # loop: expiraciones, recordatorios
│   ├── agente/
│   │   ├── llm.py           # cliente OpenAI-compatible + bucle de tool calling
│   │   ├── herramientas.py  # definiciones JSON de tools + dispatch
│   │   └── prompts.py       # system prompts (cliente / dueño)
│   ├── departamentos/
│   │   ├── cotizaciones.py
│   │   ├── citas.py
│   │   ├── cobranza.py
│   │   ├── facturas.py
│   │   ├── libro.py
│   │   ├── impuestos.py
│   │   └── tienda.py        # pedidos de productos por WhatsApp
│   ├── negocio/             # adaptado de referencia_cerberus/salon_almacen + negocio/
│   │   ├── almacen_db.py    # AlmacenDB + EmpireLedger (mismo SQLite: data/almacen.db)
│   │   ├── enzo.py          # inventario: uso, entradas, mermas, stock bajo
│   │   ├── recetas.py       # recetas de servicio + costeo (Angélica)
│   │   ├── aldo.py          # órdenes de compra a proveedores
│   │   ├── valentina.py     # archivo de clientas, fórmulas, inactivas
│   │   ├── analisis.py      # Isabel + Tomás + Verónica (predicción, márgenes, auditoría)
│   │   ├── atencion.py      # tono Annie, idioma, filtro de contactos
│   │   └── onboarding.py    # alta del negocio por WhatsApp
│   └── web/
│       ├── panel.html       # panel en vivo del dueño
│       └── demo.html        # chat simulador (respaldo si WhatsApp falla)
├── data/
│   ├── catalogo.json        # servicios y precios de ejemplo
│   └── negocio.json         # nombre, RFC de ejemplo, % anticipo, horarios, tasas
├── docs/pey_openapi.json
├── referencia_cerberus/     # código previo (solo lectura/consulta)
├── tests/
├── .env.example
├── requirements.txt
└── README.md
```

## 5. Modelo de datos (SQLite)

Todas las cantidades van en **centavos (INTEGER)** dentro de la base de datos. Solo se convierten a pesos (float con 2 decimales) al hablar con pey y al mostrar. Todas las fechas van en ISO 8601 UTC.

```sql
CREATE TABLE contactos (
  id INTEGER PRIMARY KEY,
  telefono10 TEXT UNIQUE NOT NULL,      -- 10 dígitos MX
  wa_id TEXT,                           -- como lo manda WhatsApp (52..., 521...)
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente',  -- 'cliente' | 'dueno'
  acepto_privacidad INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE cotizaciones (
  id INTEGER PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,           -- COT-YYYYMMDD-NNNN
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  partidas_json TEXT NOT NULL,          -- [{servicio_id, descripcion, cantidad, precio_unit_centavos}]
  subtotal_centavos INTEGER NOT NULL,
  iva_centavos INTEGER NOT NULL,
  total_centavos INTEGER NOT NULL,
  pagado_centavos INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL,                 -- 'enviada' | 'aceptada' | 'anticipo_pagado' | 'liquidada' | 'cancelada'
  pdf_path TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE citas (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER REFERENCES cotizaciones(id),
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  inicio TEXT NOT NULL,                 -- ISO local
  estado TEXT NOT NULL,                 -- 'apartada' | 'confirmada' | 'cancelada' | 'expirada'
  creado_en TEXT NOT NULL
);

CREATE TABLE cobros (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER REFERENCES cotizaciones(id),   -- NULL en cobros libres
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  tipo TEXT NOT NULL,                   -- 'anticipo' | 'saldo' | 'libre'
  metodo TEXT NOT NULL,                 -- 'push' | 'qr' | 'link'
  monto_centavos INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  estado TEXT NOT NULL,                 -- 'pendiente' | 'pagado' | 'expirado' | 'fallido' | 'cancelado'
  pey_transaction_id TEXT,              -- respuesta de /codi/pn
  pey_codi_id TEXT,                     -- codiId de /codi/pn
  pey_qr_id TEXT,                       -- id (IDC) de /codi/qr
  pey_link_id TEXT,                     -- id de /payment-link/create
  qr_string TEXT,
  link_url TEXT,
  expira_en TEXT,
  pagado_en TEXT,
  pago_tardio INTEGER NOT NULL DEFAULT 0,
  recordatorios_enviados INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE pagos (                    -- un renglón por transacción real de pey
  id INTEGER PRIMARY KEY,
  pey_transaction_id TEXT UNIQUE NOT NULL,   -- ← idempotencia a nivel de dinero
  cobro_id INTEGER REFERENCES cobros(id),    -- NULL si no se pudo conciliar
  monto_centavos INTEGER NOT NULL,
  tipo_evento TEXT NOT NULL,            -- codi.pn.payment_received | codi.qr.payment_received | ...
  payload_json TEXT NOT NULL,
  recibido_en TEXT NOT NULL
);

CREATE TABLE webhook_eventos (          -- idempotencia a nivel de entrega
  webhook_id TEXT PRIMARY KEY,          -- header 'webhook-id'
  recibido_en TEXT NOT NULL
);

CREATE TABLE movimientos (              -- libro: ingresos (+) y gastos/devoluciones (-)
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,                   -- 'ingreso' | 'gasto' | 'devolucion'
  monto_centavos INTEGER NOT NULL,      -- positivo siempre; el tipo define el signo
  concepto TEXT NOT NULL,
  categoria TEXT,
  pago_id INTEGER REFERENCES pagos(id),
  con_factura INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL
);

CREATE TABLE facturas (
  id INTEGER PRIMARY KEY,
  cotizacion_id INTEGER UNIQUE NOT NULL REFERENCES cotizaciones(id),  -- una por cotización
  serie TEXT NOT NULL, folio TEXT NOT NULL,
  xml TEXT NOT NULL, pdf_path TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador',   -- 'borrador' (timbrado simulado)
  creado_en TEXT NOT NULL
);

CREATE TABLE mensajes (                 -- historial para el contexto del LLM
  id INTEGER PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id),
  rol TEXT NOT NULL,                    -- 'user' | 'assistant' | 'tool'
  contenido TEXT NOT NULL,
  creado_en TEXT NOT NULL
);
```

## 6. API de pey (contratos exactos, tomados de `docs/pey_openapi.json`)

- **Base:** `https://api.pey.mx`. **Solo producción.** El sandbox está marcado como "próximamente", así que se prueba con montos pequeños.
- **Auth:** header `Authorization: Bearer <PEY_API_KEY>`. La key se crea en `portal.mipey.mx`; en el evento dan cuentas de prueba.
- **Errores:** el cuerpo es `{"error": {"message", "type", "requestId"}}`. Hay que loguear siempre `requestId`. Tipos relevantes:
  - `INVALID_STATE`: la key no tiene CoDi habilitado.
  - `INVALID_AMOUNT`.
  - `INVALID_PARAMETER`.
  - `SERVICE_UNAVAILABLE` (503): reintentar con backoff y avisar al usuario.

### 6.1 Cobro por notificación push. **Método principal en WhatsApp**
El cliente está en su teléfono y no puede escanear un QR que ve en su propia pantalla. Por eso el push es lo natural: el cobro le llega directo a su app bancaria.

```
POST /codi/pn
{
  "amount": 150.0,                 // requerido, >0, <= 1,000,000, MXN
  "phoneNumber": "5512345678",     // requerido, exactamente 10 dígitos
  "concept": "Anticipo COT-20261114-0001",
  "expiration": 360,               // segundos, mínimo y default 360
  "numRef": "1234567",             // opcional, 1-7 dígitos
  "metadata": {"cobro_id": "42"}   // opcional, valores escalares, se devuelven como string
}
→ 200 {"transactionId": "01J5K...", "codiId": "12345678901234567890"}
```
Guarda `transactionId` en `cobros.pey_transaction_id`. Con eso se concilia el webhook.

### 6.2 Cobro por QR (presencial: el panel lo muestra en pantalla)
```
POST /codi/qr
{
  "amount": 150.0,                 // requerido, >=0; 0 = el pagador escribe el monto
  "concept": "Saldo COT-...",
  "expiration": 600,               // 0 = sin expiración; si se define, mínimo 360
  "numRef": "1234567",
  "generateImage": false,          // mejor generar el PNG nosotros desde qrString (lib qrcode)
  "metadata": {"cobro_id": "42"}
}
→ 201 {"id": "AB12CD34EF", "qrString": "{...}", "qrImage": null}
```
Guarda `id` en `cobros.pey_qr_id`. **Ojo:** un QR puede recibir **varias** transacciones (`GET /transaction/codi/qr/{id}` lista hasta 20). Para "QR de un solo uso" hay que poner monto fijo y `expiration` corta, y si llega un segundo pago al mismo QR, tratarlo como **excedente** (sección 10).

### 6.3 Link de pago (respaldo: un link clicable en WhatsApp, acepta CoDi y tarjeta)
```
POST /payment-link/create
{"amount": 150, "successUrl": "https://<app>/gracias", "backUrl": "https://<app>/", "clientReferenceId": "cobro-42", "metadata": {"cobro_id": "42"}}
→ 200 {"id": "01HXYZ...", "url": "https://app.mipey.mx/payment-link/01HXYZ..."}
GET /payment-link/{id} → status: pending | processing | paid | partial
```
Las URLs deben ser HTTPS.

### 6.4 Consultar transacciones (confirmación del lado del servidor)
- `GET /transaction/{id}` → `{id, status: PENDING|PAID, amount, amountBreakdown{base, tip, fee}, paymentMethod, payableType: PAYMENT_LINK|API_CODI_QR|API_CODI_PN, payableId, datePaid, metadata, ...}`
- `GET /transaction/codi/qr/{id}` → `{items: [...]}`: pagos recibidos por un QR.
- `GET /transaction/api-key` → `{items: [...]}`: últimas 80 de la key. Sirve para reconciliar si se perdió un webhook.

### 6.5 Webhooks
Se registran en `portal.mipey.mx/developers` → engrane de la API key → URL → "Crear Webhook" → **guardar el secreto** en `PEY_WEBHOOK_SECRET`. Ahí mismo están los "Webhook Logs" con cada intento y la respuesta que dimos, muy útiles para depurar.

Eventos que nos importan (campo `type` del cuerpo):
- `codi.pn.payment_received`: `{type, transactionId, amount, concept, datePaid, numRef, apiKeyId, bankAccountId?, metadata}`
- `codi.qr.payment_received`: igual, más `codiQrId`.
- Actualización de estado de un link de pago: cuando llegue, consulta `GET /payment-link/{id}`.

**Firma (Standard Webhooks).** Los headers son `webhook-id`, `webhook-timestamp` y `webhook-signature`. Se firma con HMAC-SHA256 sobre `"{webhook-id}.{webhook-timestamp}.{cuerpo crudo}"`, usando como llave el secreto decodificado en base64 (sin el prefijo `whsec_`). La firma viene como `v1,<base64>`, y puede haber varias separadas por espacio. **Verifica sobre el cuerpo crudo (bytes), antes de parsear el JSON.**

```python
import base64, hashlib, hmac, time

def verificar_firma(secret: str, headers: dict, body: bytes, tolerancia_s: int = 300) -> bool:
    msg_id = headers.get("webhook-id")
    ts = headers.get("webhook-timestamp")
    firmas = headers.get("webhook-signature")
    if not (msg_id and ts and firmas):
        return False
    if abs(time.time() - int(ts)) > tolerancia_s:
        return False
    llave = base64.b64decode(secret.removeprefix("whsec_"))
    esperado = base64.b64encode(
        hmac.new(llave, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    ).decode()
    for f in firmas.split(" "):
        version, _, valor = f.partition(",")
        if version == "v1" and hmac.compare_digest(valor, esperado):
            return True
    return False
```
Si no valida con el secreto real, prueba el SDK oficial (`pip install standardwebhooks`) y revisa los Webhook Logs del portal. **Nunca** desactives la verificación en producción. Mientras se depura, se puede activar un modo `PEY_WEBHOOK_INSECURE=1` **solo en local**, que loguea una advertencia enorme.

**Procesamiento idempotente.** Todo lo siguiente va en **una transacción SQLite**:
1. Verificar la firma. Si falla, responder **401** y no hacer nada más.
2. `INSERT INTO webhook_eventos(webhook_id)`. Si ya existía, responder **200** y no hacer nada más (entrega duplicada).
3. Parsear el JSON y aceptar solo los `type` conocidos.
4. **Confirmar con el servidor:** `GET /transaction/{transactionId}` debe traer `status == "PAID"`, y el monto debe coincidir.
5. `INSERT INTO pagos(pey_transaction_id, ...)`. Si choca con el UNIQUE, ya se procesó ese dinero: responder 200 y salir.
6. Conciliar con el cobro, en este orden:
   - por `pey_transaction_id` (push)
   - por `pey_qr_id == codiQrId` (QR)
   - por `metadata.cobro_id` / `metadata.externalMetadata.cobro_id`
   - si nada coincide, `cobro_id = NULL` y se avisa al dueño como "pago sin conciliar".
7. Aplicar los efectos (sección 7). Esto es **solo si el paso 5 insertó un renglón nuevo**.
8. **Commit** y responder **200** rápido. Los mensajes de WhatsApp se envían **después del commit**, en una tarea de fondo, para no bloquear la respuesta.

## 7. Máquina de estados y efectos de un pago confirmado

```
cobro.pendiente ──pago──▶ cobro.pagado
cobro.pendiente ──expira sin pago (verificado con GET /transaction)──▶ cobro.expirado
cobro.expirado  ──pago llega tarde──▶ cobro.pagado + pago_tardio=1
```

Efectos al pasar a `pagado` (una sola vez, garantizado por la sección 6.5):
- `movimientos`: un `ingreso` por el monto, ligado al `pago_id`.
- `cotizaciones.pagado_centavos += monto`.
  - Si `tipo == 'anticipo'`: la cotización pasa a `anticipo_pagado` y la cita apartada pasa a **`confirmada`**.
  - Si `pagado_centavos >= total_centavos`: la cotización pasa a `liquidada`. Se **genera la factura borrador** (una por cotización, garantizado por el UNIQUE) y se envía el PDF.
- Mensajes:
  - Al cliente: "✅ Recibimos tu pago de $X. Tu cita del <fecha> está confirmada."
  - Al dueño: "💰 <Cliente> pagó $X (anticipo COT-…)."
- Los recordatorios de ese cobro se detienen solos, porque ya no está `pendiente`.

## 8. WhatsApp Cloud API

Toma como base `referencia_cerberus/whatsapp_bridge.py`. Quita gRPC, BUS y PRESENCE y llama directo al agente.

- **Verificación del webhook:** `GET /webhooks/whatsapp`. Si `hub.mode == "subscribe"` y `hub.verify_token == WHATSAPP_VERIFY_TOKEN`, responder el `hub.challenge` en texto plano.
- **Recepción:** `POST /webhooks/whatsapp`. La ruta es `entry[0].changes[0].value.messages[0]`, con los campos `from` (wa_id) y `text.body`. Hay que **ignorar** los eventos de `statuses` (entregado, leído). Responder 200 de inmediato y procesar en tarea de fondo. Deduplicar por `messages[0].id`, porque Meta reintenta.
- **Envío:** `POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` con `Authorization: Bearer {WHATSAPP_TOKEN}`.
  - Texto: `{"messaging_product":"whatsapp","to":wa_id,"type":"text","text":{"body":...}}`.
  - Documento (PDF): `"type":"document","document":{"link":"https://<app>/archivos/<id>.pdf","filename":"COT-....pdf"}`.
  - Imagen (QR): `"type":"image","image":{"link":"https://<app>/qr/<cobro_id>.png"}`.
- **Teléfonos:** WhatsApp manda `from` como `521XXXXXXXXXX` o `52XXXXXXXXXX`. Para pey se usan **los últimos 10 dígitos**. Para responder, usa el mismo `wa_id` que llegó. Si Meta rechaza `521...`, reintenta con `52` + 10 dígitos (es una peculiaridad conocida de México).
- **Ventana de 24 h:** el bot solo puede mandar texto libre a quien le escribió en las últimas 24 h. Fuera de esa ventana se necesitan plantillas aprobadas. **Para la demo, dueño y cliente le escriben "hola" al bot antes de empezar.**
- **Número de prueba de Meta:** solo envía a números registrados como destinatarios (hasta 5). Registra los teléfonos del equipo.
- **El token puede estar vencido** (los tokens temporales duran 24 h). Genera uno nuevo en el panel de Meta. Prueba el envío **antes** que nada.
- **Respaldo obligatorio:** `GET /demo` es un chat web que llama **la misma función del agente** con un teléfono simulado. Si WhatsApp falla en vivo, la demo sigue ahí.

## 9. El agente (LLM con herramientas)

- **Cliente LLM:** `openai.OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)`, modelo `LLM_MODEL`. Todo por entorno.
  - Grok (xAI): `LLM_BASE_URL=https://api.x.ai/v1`.
  - Gemini: `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`.
  - El modelo exacto es el que tenga créditos. No lo dejes fijo en el código.
- **Bucle de tool calling:**
  - Se mandan el historial (últimos 12 mensajes del contacto), el system prompt según el rol y las tools según el rol.
  - Se ejecutan las tool calls y se repite hasta obtener texto, con un **máximo de 5 vueltas**.
  - Timeout de 25 s. Si el LLM falla, se responde con un menú de respaldo: "1) Ver catálogo 2) Cotizar 3) Mi saldo".
- **Reglas duras** (en el system prompt y **también en el código**):
  1. **El LLM nunca decide que algo está pagado.** Solo el webhook (sección 6.5) cambia estados de pago.
  2. **El LLM nunca calcula montos.** Los montos los calcula el código desde el catálogo y la base de datos. El LLM solo elige servicios, cantidades e intenciones.
  3. Las tools de dueño **no se exponen** a clientes. El rol se valida dentro de cada tool, no solo en el prompt.
  4. Respuestas cortas, estilo WhatsApp, en español de México, con emojis moderados.
  5. Para impuestos siempre se dice: "Estimación informativa; confirma con tu contador".
- **Primer contacto (datos personales, LFPDPPP):** el primer mensaje a un número nuevo incluye un aviso breve: "Uso tu número y tus pagos solo para darte este servicio. Aviso de privacidad: <url>. ¿Continuamos?". Luego se guarda `acepto_privacidad=1`.

### Herramientas

Cliente:
| Tool | Parámetros | Efecto |
|---|---|---|
| `ver_catalogo` | — | Lista los servicios con precio |
| `crear_cotizacion` | `partidas: [{servicio_id, cantidad}]` | Crea la cotización y el PDF; devuelve folio y total |
| `ver_horarios` | `fecha?` | Hasta 3 huecos libres según `negocio.json` |
| `aceptar_y_apartar` | `folio, horario_iso` | Cita `apartada` + cobro de anticipo por push. Devuelve el resumen |
| `reenviar_cobro` | `cobro_id, metodo: push\|link\|qr` | Crea un **cobro nuevo** (el anterior pasa a `cancelado`) |
| `mi_saldo` | — | Cotizaciones y saldo pendiente del contacto |

Dueño (todas las de cliente, más):
| Tool | Parámetros | Efecto |
|---|---|---|
| `cobrar_saldo` | `folio, metodo?` | Cobro por el saldo restante |
| `crear_cobro_libre` | `telefono10, monto, concepto, metodo?` | Adelantos o cobros sin cotización (modo persona) |
| `registrar_gasto` | `monto, concepto, categoria?, con_factura?` | Gasto en el libro |
| `resumen_finanzas` | `periodo: hoy\|semana\|mes` | Cobrado, por cobrar, gastos, utilidad |
| `cuentas_por_cobrar` | — | Lista de quién debe y cuánto |
| `agenda` | `fecha?` | Citas apartadas y confirmadas |
| `estimar_impuestos` | `mes?` | IVA e ISR RESICO estimados |
| `generar_factura` | `folio` | Fuerza la factura borrador si está liquidada |
| `registrar_devolucion` | `pago_id, monto, motivo` | Movimiento `devolucion` (ver la sección 10) |
| `estado_almacen` | `categoria?` | Stock actual por producto, con los que están bajo el mínimo marcados |
| `registrar_entrada` | `producto, cantidad, costo_unit, proveedor?` | Llegó mercancía; alerta si subió el precio |
| `ordenes_compra` | — | Órdenes pendientes de aprobar |
| `aprobar_orden` / `rechazar_orden` | `orden_id` | Aprueba y la manda al proveedor por WhatsApp / la descarta |
| `margen_servicio` | `servicio?` | Costo de insumos vs precio, margen % y precio sugerido |
| `prediccion_stock` | — | Días de stock y fechas de agotamiento |
| `clientas_inactivas` | `dias? (42)` | Lista para seguimiento; el dueño puede pedir "mándales recordatorio" |
| `ficha_cliente` | `nombre_o_telefono` | Historial de visitas, fórmula personal y saldo |
| `crear_receta` | `servicio, insumos: [{producto, cantidad}]` | Receta de servicio |

Staff (solo estas):
| Tool | Parámetros | Efecto |
|---|---|---|
| `registrar_uso` | `producto, cantidad` | Salida de stock con nota del staff |
| `servicio_atendido` | `folio_o_cliente, servicio` | Aplica la receta, descuenta insumos y registra la visita en el archivo de clientes |
| `consultar_stock` | `producto?` | Solo cantidades, **sin costos** |

Cliente (tienda):
| Tool | Parámetros | Efecto |
|---|---|---|
| `ver_productos` | — | Productos a la venta con precio y disponibilidad (sin mostrar cantidades exactas) |
| `comprar_producto` | `producto_id, cantidad` | Valida el stock, crea el pedido y el cobro CoDi. **El stock se descuenta solo al confirmarse el pago** |

## 10. Casos borde (respuestas listas para los jueces)

| Caso | Qué hace el sistema |
|---|---|
| Webhook duplicado | `webhook_eventos` y `pagos.pey_transaction_id` UNIQUE hacen que sea un no-op, y se responde 200 |
| Firma inválida | 401, sin efectos, queda en log |
| Cobro expira sin pago | `tareas.py` lo detecta, confirma con `GET /transaction/{id}` que sigue sin `PAID`, lo marca `expirado`, **avisa al cliente y al dueño** y ofrece reenviar |
| Pago tardío (llega después de expirar) | Se acepta (el dinero ya llegó), queda `pagado` con `pago_tardio=1` y se avisa. Si la cita ya se había liberado, el dueño decide |
| Segundo pago al mismo QR / pago de más | El ingreso se registra y el excedente queda como **saldo a favor**. Se avisa al dueño para devolver o aplicar |
| Pago parcial (QR con monto libre) | Se suma a `pagado_centavos`; la cotización sigue abierta con el saldo restante |
| Webhook perdido | La tarea de fondo consulta `GET /transaction/{id}` de los cobros pendientes; si está `PAID`, se procesa por la **misma** ruta idempotente |
| pey 503 / timeout | Reintento con backoff (3 intentos); se avisa "el banco no responde, reintento en 1 min" |
| Devolución | **La API de pey no tiene endpoint de reembolso.** El dueño devuelve por transferencia y registra `registrar_devolucion` (movimiento negativo en el libro). Se dice tal cual en la demo |
| El pago no prueba identidad ni entrega | Lo dice la hoja. La entrega se confirma aparte (la cita se marca como atendida por el dueño) |
| Cliente sin CoDi activo en su banco | El push falla o no llega; el agente ofrece **link de pago** (acepta tarjeta) |
| Tienda: se agota el stock entre el pedido y el pago | El pago se acepta (el dinero llegó), el pedido queda `pagado_sin_stock`, se avisa al dueño y al cliente: se surte en cuanto llegue o se devuelve |
| Servicio atendido dos veces por error | `servicio_atendido` es idempotente por cita: si la cita ya está `atendida`, no se descuenta otra vez |
| Insumo de la receta sin stock suficiente | Se descuenta lo que haya, se registra el faltante y se alerta al dueño. Nunca se deja stock negativo silencioso |

## 11. Recordatorios (cobranza)

`tareas.py` corre cada 30 s (`asyncio` en el startup de FastAPI):
- Cobros `pendiente` con `expira_en` vencido → flujo de expiración (sección 10).
- Cobros `pendiente` sin respuesta a la mitad del tiempo → **un** recordatorio por WhatsApp ("Tu cobro de $X vence en 3 min").
- Cotizaciones `aceptada` o `anticipo_pagado` con saldo y sin cobro activo → el dueño ve "por cobrar" en el panel. En la demo no se manda nada automático fuera de la ventana de 24 h.

## 12. Facturas (CFDI 4.0, timbrado simulado)

Adapta `referencia_cerberus/cfdi_engine.py`, que genera un XML CFDI 4.0 válido sin timbrar y su PDF:
- Emisor desde `negocio.json` (RFC de ejemplo). Receptor: si el cliente no da RFC, se usa **público en general** (`XAXX010101000`, uso `S01`).
- `forma_pago`: `"03"` (transferencia, porque CoDi es SPEI). `metodo_pago`: `"PUE"` si se liquidó de una vez, `"PPD"` si hubo anticipo (en ese caso, mencionar el complemento de pago como trabajo futuro).
- **Usa `NullAdapter`** (estado `borrador`). En el PDF y en el mensaje debe decir **"BORRADOR – timbrado simulado (requiere PAC y CSD)"**.

## 13. Impuestos (SAT, estimación)

`departamentos/impuestos.py`, con las tasas en `negocio.json` para que se puedan editar:
- **IVA del mes** = IVA trasladado de los ingresos cobrados (16 %) − IVA de los gastos `con_factura` (16 %).
- **ISR estimado, RESICO persona física** (tasa mensual sobre ingresos cobrados sin IVA). Tabla configurable; **verificar contra la LISR vigente antes de presentarla**:
  - hasta $25,000: 1.00 %
  - hasta $50,000: 1.10 %
  - hasta $83,333.33: 1.50 %
  - hasta $208,333.33: 2.00 %
  - hasta $3,500,000: 2.50 %
- La respuesta siempre termina con: "Estimación informativa, no sustituye a tu contador ni al SAT."

## 13B. Almacén, recetas, clientes y compras (Donna)

Esto ya existe y funciona en `referencia_cerberus/salon_almacen/` (bot de Telegram) y `referencia_cerberus/negocio/`. **El trabajo es portarlo al agente de WhatsApp, no reescribirlo.**

**Base de datos.** El almacén usa el esquema de `negocio/empire_ledger.py` y luego el de `negocio/almacen_db.py`:
- `parts` (productos, con `processing_cost` y `sale_price`)
- `stock_items` (lotes PEPS/FIFO)
- `inventory_tx` (auditoría)
- `suppliers`, `locations`
- `service_recipes`, `clients`, `client_formulas`

Para crearlo: `EmpireLedger(db_path)` crea las tablas base y luego `AlmacenDB(db_path).migrate()` las extiende. Usa **un archivo propio** `data/almacen.db`, separado de `data/app.db` (pagos). Así se porta casi sin cambios. El enlace entre los dos es el teléfono del cliente (`clients.telefono` ↔ `contactos.telefono10`).

**Seed.** `salon_almacen/seed.py` trae unos 20 insumos de salón con mínimos y costos. Úsalo para que la demo tenga inventario real desde el arranque. Agrega una receta por servicio del catálogo:
- tinte = 1 tubo de tinte + 1 par de guantes + papel aluminio
- corte = toalla desechable

**Portado.** Cambia `from host_engine...` por imports locales y `ask_llm` / `ask_llm_vision` por `app/agente/llm.py`. El envío por Telegram se reemplaza por `app/whatsapp.py`. Cada función `reporte_*` devuelve texto y sirve tal cual como respuesta de una tool.

**Enganche con pagos** (lo que hace verificable la cadena):
- Pago de anticipo o saldo → no toca el inventario (el servicio aún no se presta).
- `servicio_atendido` (staff o dueño) → `recetas.aplicar_receta` → `enzo` descuenta → `valentina.registrar_visita` → `analisis` recalcula el margen → si algo queda bajo el mínimo, se llama `aldo.generar_orden` y se avisa al dueño.
- Pago de pedido de tienda → `enzo` registra la salida del producto vendido → mensaje "listo para recoger".
- `aprobar_orden` → `whatsapp.enviar_texto(proveedor, orden)` → al recibir la mercancía, `registrar_entrada` + `tomas.alerta_variacion_en_recepcion`.

**Fotos (si da tiempo).** `salon_almacen/skill.py` (`procesar_foto`) y `angelica.leer_formula_foto` usan visión para leer un producto o una fórmula manuscrita. Solo porta esto si el LLM elegido acepta imágenes y queda tiempo. Es muy vistoso, pero no es crítico.

**Seguridad.** Reutiliza las ideas de `salon_almacen/security.py`: whitelist de staff, sanitizado de entrada y respuesta "fuera de tema".

## 14. Panel en vivo (`GET /panel`) y API para el panel

- `GET /api/estado` → JSON con:
  - cobros recientes (estado, monto, método, tardío)
  - citas de hoy
  - cobrado / por cobrar / gastos / utilidad del mes
  - últimos 10 eventos (para el "feed")
- `panel.html` hace polling cada 2 s. Un pago nuevo muestra una animación verde. Los QR de cobros `metodo='qr'` se muestran grandes, para cobrar en persona.
- Botón **"Cobro de prueba $1"**, que crea un cobro QR. Es el hito mínimo (sección 3).
- `GET /qr/{cobro_id}.png` genera el PNG desde `qr_string` con la librería `qrcode`.
- `GET /archivos/{nombre}` sirve los PDFs generados, **solo** de la carpeta `data/archivos/`. Hay que prevenir path traversal.
- **Protección:** `/panel` y `/api/*` piden `?k=PANEL_KEY` (un secreto simple en `.env`). Los webhooks no la usan, porque tienen su propia verificación.

## 15. Qué reutilizar de `referencia_cerberus/`

| Archivo de referencia | Destino nuevo | Qué tomar / qué cambiar |
|---|---|---|
| `whatsapp_bridge.py` | `app/whatsapp.py` + rutas en `main.py` | Verificación GET, parseo de `entry/changes/value/messages`, envío con httpx. **Quitar** gRPC, BUS, PRESENCE y heartbeat |
| `cotizacion_skill.py` | `departamentos/cotizaciones.py` | El generador del PDF con reportlab y el cálculo de partidas. **Quitar** `_match_services` por keywords (lo reemplaza el LLM con `servicio_id`), deal_tracker y rutas Cerberus_Data. Escribir en `data/archivos/` |
| `appointment_bridge.py` | `departamentos/citas.py` | La idea de tickets y huecos. **Pasar a SQLite** (tabla `citas`) en lugar del JSON con lock |
| `petra_cobranzas_skill.py` + `ventas_db.py` | `departamentos/cobranza.py` + `libro.py` | Las consultas de cuentas por cobrar y la lógica de saldo. Usar **nuestro** esquema (sección 5). La personalidad agresiva de "Petra" **no** va: tono cordial y profesional |
| `cfdi_engine.py` | `departamentos/facturas.py` | `generar_cfdi_xml`, `generar_pdf`, `NullAdapter` casi tal cual. Config desde `negocio.json`. Ajustar `forma_pago` según la sección 12 |
| `ops_router.py` | (concepto) | Ruteo de intents por keywords. **No se usa:** el LLM con tools lo reemplaza. Sirve como fallback si no hay LLM |
| `llm_router.py` | `agente/llm.py` | Solo como referencia de manejo de errores y timeouts. Se reescribe con el cliente OpenAI-compatible |
| `negocio/empire_ledger.py` + `negocio/almacen_db.py` | `app/negocio/almacen_db.py` | **Casi tal cual.** Solo cambia la ruta por defecto a `data/almacen.db` |
| `salon_almacen/agents/enzo.py` | `app/negocio/enzo.py` | Uso, entradas, mermas, estado y alertas de stock bajo |
| `salon_almacen/agents/recetas.py` + `angelica.py` | `app/negocio/recetas.py` | `aplicar_receta`, `costear_receta`, `crear_receta_desde_texto`; la lectura de fórmula por foto es opcional |
| `salon_almacen/agents/aldo.py` + `whatsapp_sender.py` | `app/negocio/aldo.py` | Órdenes de compra, aprobar/rechazar, envío al proveedor. `aldo_scout` (buscar proveedores en web) **no** va |
| `salon_almacen/agents/valentina.py` | `app/negocio/valentina.py` | Archivo de clientas, fórmulas, visitas, inactivas |
| `salon_almacen/agents/isabel.py`, `tomas.py`, `veronica.py` | `app/negocio/analisis.py` | Predicción de agotamiento, márgenes, variación de precios, auditoría de uso |
| `salon_almacen/agents/expediente.py` | (opcional) | Perfil por estilista. Solo si sobra tiempo |
| `salon_almacen/agents/donna.py` + `skill.py` | `app/agente/` | Donna es el orquestador. Su `despachar_texto` lo reemplaza el LLM con tools, pero sus **reportes** (`reporte_matutino`, `salud_financiera`) se reusan |
| `salon_almacen/onboarding.py` + `ingest.py` + `negocio/onboarding_engine.py` | `app/negocio/onboarding.py` | Alta del negocio por chat e inventario inicial desde texto o Excel. Para la demo basta el seed; esto es el pitch de "se instala en tu WhatsApp y ya" |
| `salon_almacen/cron.py` + `negocio/alerta_imperativa.py` | `app/tareas.py` | Reporte matutino al dueño y alertas de stock bajo, en el mismo loop de la sección 11 |
| `salon_almacen/security.py` + `negocio/auth_gate.py` + `negocio/contact_gate.py` | `app/negocio/atencion.py` + validación de rol | Whitelist de staff, sanitizado, filtro de contactos |
| `negocio/annie_empathy.py` + `negocio/lingua_detector.py` | `app/agente/prompts.py` + `app/negocio/atencion.py` | Tono y guiones de atención; respuesta en el idioma del cliente |
| `negocio/ventas_skill.py`, `deal_tracker.py`, `business_followup.py` | `departamentos/cotizaciones.py` + `cobranza.py` | Pipeline de oportunidades y seguimiento comercial |
| `negocio/almacen_skill.py`, `almacenista_skill.py`, `tania_bodeguera_skill.py` | `app/negocio/enzo.py` | Frases y detección de intención en lenguaje natural para inventario; útiles para el fallback sin LLM |
| `negocio/manufactura_db.py` + `manufactura_skill.py` | (opcional) | Recetas con COGS para negocios que producen (comida, manufactura). Para el pitch de "sirve para cualquier negocio" |
| `negocio/cajero_ledger.py`, `budget_sentinel.py`, `prophet_forecasting.py` | `departamentos/libro.py` (opcional) | Caja, alertas de presupuesto y pronóstico de ventas |
| `negocio/annie_reporter.py` | (opcional) | Bitácora de interacciones y reporte de atención |
| `salon_almacen/DONNA_PROPUESTA_COMERCIAL.md` | Pitch | Problema, ROI y precios. Material para el pitch de Grok |

**Antes de publicar el repo:** verifica que nada en `referencia_cerberus/` tenga secretos o datos personales (ya se limpió, pero revísalo). Si estorba, bórralo: el código nuevo no debe depender de él.

## 16. Seguridad mínima

- `.env` **nunca** se commitea (ya está en `.gitignore`). Solo se sube `.env.example`.
- Todos los secretos van por entorno: `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `LLM_API_KEY`, `PANEL_KEY`.
- Los logs no imprimen tokens ni cuerpos completos con datos bancarios (CLABE). Hay que enmascararlos.
- Los teléfonos de dueño se definen en `OWNER_PHONES`. Cualquier otro número es cliente.
- El rol se valida dentro de cada tool.

## 17. Variables de entorno

Ver `.env.example`. Mínimo para funcionar: `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `OWNER_PHONES`, `PUBLIC_BASE_URL`, `PANEL_KEY`. Opcionales: `STAFF_PHONES` y `SUPPLIER_PHONE` (proveedor de la demo, para la orden de compra).

## 18. Despliegue

1. Repo **público** en GitHub, sin `.env`.
2. Render (Web Service) o Railway:
   - build: `pip install -r requirements.txt`
   - start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - cargar las variables de entorno en su panel.
3. `PUBLIC_BASE_URL=https://<tu-app>.onrender.com`.
4. pey: en `portal.mipey.mx/developers`, registrar el webhook `https://<tu-app>/webhooks/pey` y copiar el secreto.
5. Meta: App → WhatsApp → Configuration → Callback URL `https://<tu-app>/webhooks/whatsapp` + Verify token → suscribir el campo `messages`.
6. Desarrollo local: `cloudflared tunnel --url http://localhost:8000` (o ngrok) y apuntar ambos webhooks al túnel.
7. SQLite en Render se borra con cada deploy. Para la demo está bien; al iniciar se carga un **seed** con el catálogo y el dueño.

## 19. Checklist de entrega (antes del domingo 1:00 PM)

- [ ] Repo público con README: qué es, cómo correrlo, arquitectura, qué es real y qué es simulado, y los casos borde.
- [ ] App en vivo (link).
- [ ] Video demo de 2 min o menos con el recorrido de la sección 3.
- [ ] En la demo se dice: timbrado CFDI simulado; impuestos son una estimación; devoluciones manuales.
- [ ] Probado con el banco real (regla 5).
- [ ] Formulario enviado con los correos de todos los integrantes.
