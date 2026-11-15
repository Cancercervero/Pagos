# Michingón + pey: la base real del proyecto

> **Versión `v3.1-arquitectura`. Este documento manda sobre la parte de stack de `INSTRUCCIONES.md`.**
> La implementación se hace **dentro de `michingon3/`** (Next.js 14 + Firebase), no en un servicio Python nuevo.
>
> **🚫 De Michingón SOLO se toma la ARQUITECTURA:** módulos, modelo de datos en Firestore, pantallas, roles y permisos, despliegue. **Su IA NO se usa:** ni `src/ai/` (Genkit/Gemini y sus 9 flujos), ni `brain`, ni `ai-assistant-widget`, ni `mao-assistant`, ni los escáneres con IA. No se porta, no se extiende, no se presenta en la demo ni en el pitch. **El agente se construye nuevo** en `src/lib/agente/`, con nuestro propio LLM (cliente compatible con OpenAI, configurable con `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL`, por ejemplo Grok), según `INSTRUCCIONES.md` §9.
> `INSTRUCCIONES.md` sigue siendo la fuente de verdad de **qué** hacer: reglas del reto, recorrido de la demo, contratos de pey, idempotencia, casos borde, SAT y lógica de Donna. Este documento dice **dónde y cómo** hacerlo en Michingón.

---

## 1. Qué es Michingón

Plataforma de gestión para negocios pequeños, ya construida y **en vivo** en `https://michingon3-a77f8.web.app`. Código en `michingon3/`.

**Stack:**
- Next.js 14 (App Router) + TypeScript + Tailwind + Radix
- Firebase: Auth, Firestore y Hosting, que reenvía todo a una función de Cloud Run `nextjsfunc`
- La IA de Michingón (Genkit 0.5 con Gemini) **no se usa** en este proyecto

**Familias de negocio** (`src/types/business-types.ts`): comercio, alimentos, servicios, producción y renteros. Cada familia activa distintos módulos. También define el régimen SAT (`RESICO | RIF | general | none`).

**Módulos que ya existen** (`src/app/(app)/business/[id]/…`):

| Ruta | Qué hace | Para la demo |
|---|---|---|
| `pos` | Punto de venta | **Aquí va el botón "Cobrar con CoDi"** (QR en pantalla) |
| `sales` | Ventas | Se agrega `paymentMethod: 'codi'` |
| `orders` | Pedidos con fecha y hora de entrega | **Pedidos por WhatsApp** (idea #2) y **citas con anticipo** (idea #4) |
| `inventory` + `inventory/reconciliation` | Inventario con lotes, mínimos y conciliación | Descuento de stock al confirmarse el pago |
| `recipes` | Recetas con costeo (+ escaneo de receta por foto/archivo) | Descuento de insumos por servicio, como Donna |
| `clients` | Clientes | Ficha del cliente y su teléfono de WhatsApp |
| `suppliers` | Proveedores | Orden de compra cuando hay stock bajo (Aldo) |
| `expenses`, `cashflow`, `profitability`, `reports` | Gastos, flujo, rentabilidad, reportes | Resumen del dueño |
| `invoicing` | Facturas (emitidas, gastos, canceladas, escaneo) | Factura al liquidar |
| `tax-guide` | Guía SAT por régimen | Estimación de IVA/ISR |
| `personal` | Modo personas | "También sirve para personas" (pitch) |
| `staff`, `payroll` + `api/workforce/*` | Empleados, invitaciones, checador con geolocalización | Rol staff |
| `brain` + `components/dashboard/ai-assistant-widget`, `mao-assistant` | Asistente de IA de Michingón | **🚫 No se usa** (solo arquitectura) |
| `settings`, `settings/import` | Configuración e importación (Excel) | Onboarding |
| `api/auth/webauthn` | **Biometría (WebAuthn)** | Era una decisión de diseño original: confirmar con huella o Face ID |
| `api/webhooks/whatsapp` | Webhook de WhatsApp | **Se reusa la ruta** (verificación y recepción). Deja de llamar a `ai/flows/whatsapp-flow.ts` y llama a **nuestro agente** `src/lib/agente/` |

**IA de Michingón** (`src/ai/`, Genkit): **🚫 fuera del proyecto.** Los 9 flujos (`whatsapp-flow`, `process-order-text-flow`, escáneres, `social-post-flow`, etc.) se quedan como están: no se tocan, no se portan, no se muestran en la demo. Si una pantalla que se use en la demo depende de ellos y falla, se oculta ese botón; no se arregla la IA.

**Datos** (`src/contexts/DataContext.tsx`). Escucha Firestore en tiempo real (`onSnapshot`) en:
- `businesses/{businessId}/products`
- `…/sales`, `…/expenses`, `…/clients`, `…/employees`, `…/assets`, `…/suppliers`, `…/invoices`, `…/orders`

Todo lo que el servidor escriba ahí **aparece solo en el panel**. Ese es el panel en vivo de la demo; no hay que construir otro.

## 2. Problemas conocidos de Michingón (arreglar o tenerlos en cuenta)

1. **`businessId` está fijo en `'demo'`** en `DataContext.tsx`. Para la demo usa `DEMO_BUSINESS_ID=demo` en el servidor, y así ambos lados ven lo mismo.
2. **`addSale` descuenta stock solo en el estado local**, no en Firestore. Al recargar, el stock vuelve. Con pagos CoDi, el descuento se hace **en el servidor** (webhook) con transacción de Firestore. Arregla también `addSale` para que use `increment(-cantidad)`.
3. **WhatsApp es mock:** `sendWhatsAppMessage` solo hace `console.log`, y el `VERIFY_TOKEN` está fijo en el código. Hay que pasarlo a variable de entorno. El envío real va en `src/lib/whatsapp.ts`.
4. **La IA de Michingón no se usa.** Genkit 0.5 + `gemini15Flash` se quedan fuera. El agente nuevo usa un cliente compatible con OpenAI (paquete `openai`) con `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL` (Grok: `https://api.x.ai/v1`), según `INSTRUCCIONES.md` §9.
5. **Despliegue:** Firebase Hosting reenvía todo a la función `nextjsfunc`, que corre Next desde `functions/`. **`functions/src` es una copia de `src`** y está desfasada (38 archivos distintos). Antes de cada deploy se sincroniza (ver `.agent/workflows/deploy-functions.md` y `.github/workflows/ci.yml`).
6. **Riesgo del cuerpo crudo en webhooks:** Cloud Functions puede parsear el body antes de que llegue a Next. La firma de pey se verifica sobre el **cuerpo crudo**. **Pruébalo primero** con un webhook real de pey en la URL de producción. Si llega vacío o alterado:
   - **Plan A:** exportar en `functions/index.js` una función dedicada `peyWebhook` (`onRequest`) que use `req.rawBody`.
   - **Plan B:** desplegar el proyecto en **Vercel**, que corre Next nativo sin ese problema.
7. **Llave de servicio:** el repo privado original `michingon3` tiene `serviceAccountKey.json` **commiteado**. En esta copia pública **se quitó**. Para correr scripts o el Admin SDK en local, descárgala de la consola de Firebase y apúntala con `GOOGLE_APPLICATION_CREDENTIALS`. **Nunca la subas.** En producción (Cloud Run) se usan las credenciales por defecto del proyecto.

## 3. Modelo de datos para pagos (Firestore)

Se agrega junto a lo existente. Todo se escribe **desde el servidor** con `firebase-admin`.

```
businesses/{bid}/cobros/{cobroId}
  tipo: 'anticipo' | 'saldo' | 'pedido' | 'venta_pos' | 'libre'
  metodo: 'push' | 'qr' | 'link'
  montoCentavos: number            // siempre centavos enteros
  concepto: string
  estado: 'pendiente' | 'pagado' | 'expirado' | 'fallido' | 'cancelado'
  clienteId?, telefono10?, orderId?, saleDraft?   // saleDraft: items para crear la venta al pagar
  peyTransactionId?, peyCodiId?, peyQrId?, peyLinkId?, qrString?, linkUrl?
  expiraEn: Timestamp, pagadoEn?: Timestamp, pagoTardio: boolean, recordatorios: number
  creadoEn: Timestamp

businesses/{bid}/pagos/{peyTransactionId}      ← el ID del doc ES el transactionId (idempotencia del dinero)
  cobroId | null, montoCentavos, tipoEvento, payload, recibidoEn

webhookEventos/{webhook-id}                    ← colección raíz; idempotencia de la entrega
  recibidoEn

businesses/{bid}/purchaseOrders/{id}           ← órdenes de compra (Aldo)
  supplierId, items[{productId, cantidad, costoUnit}], estado: 'pendiente'|'aprobada'|'enviada'|'recibida'|'rechazada'

businesses/{bid}/conversaciones/{telefono10}/mensajes/{id}   ← historial para el agente
```

**Idempotencia en Firestore:** dentro de `db.runTransaction`, usa `tx.create(ref)` sobre `webhookEventos/{id}` y sobre `pagos/{transactionId}`. Si el documento ya existe, `create` falla: se responde 200 y no se ejecuta ningún efecto. Los efectos (venta, stock, pedido, mensajes) **solo** ocurren si ambos `create` tuvieron éxito. Los mensajes de WhatsApp se mandan **después** del commit.

## 4. Archivos a crear o modificar en `michingon3/`

```
src/lib/server/firebase-admin.ts        # initializeApp() una vez; getFirestore()
src/lib/pey.ts                          # cliente: crearPush, crearQr, crearLink, obtenerTransaccion (contratos: INSTRUCCIONES §6)
src/lib/pey-webhook.ts                  # verificarFirmaPey (abajo) + procesarEventoPey (transacción idempotente)
src/lib/whatsapp.ts                     # enviarTexto / enviarImagen / enviarDocumento (Graph API), normalizar teléfono
src/app/api/pey/cobro/route.ts          # POST: crea cobro (POS, pedido, anticipo, libre). Protegido: solo usuario autenticado del negocio
src/app/api/webhooks/pey/route.ts       # POST: raw body → verificar → procesar → 200
src/app/api/pey/conciliar/route.ts      # POST/GET con secreto: expira cobros, recordatorios, reconcilia con GET /transaction/{id}
src/app/api/webhooks/whatsapp/route.ts  # MODIFICAR: verify token de env, ignorar statuses, dedupe por message.id, responder 200 rápido,
                                        #   y llamar a src/lib/agente (YA NO a src/ai/flows/whatsapp-flow.ts)
src/lib/agente/llm.ts                   # NUEVO: cliente openai con LLM_BASE_URL/LLM_API_KEY/LLM_MODEL, bucle de tool calling (máx. 5 vueltas, timeout)
src/lib/agente/herramientas.ts          # NUEVO: tools (catálogo = products, pedido = orders, cobro = pey, stock, compras) con validación de rol
src/lib/agente/prompts.ts               # NUEVO: system prompts cliente/dueño/staff con las reglas duras de INSTRUCCIONES §9
src/ai/**                               # NO TOCAR (IA de Michingón, fuera del proyecto)
src/components/pos/CodiCheckoutModal.tsx  # QR grande + estado en vivo (onSnapshot al doc del cobro) → "PAGADO ✓"
src/app/(app)/business/[id]/pos/page.tsx  # MODIFICAR: botón "Cobrar con CoDi"
src/components/dashboard/codi-live-widget.tsx  # feed de cobros/pagos en vivo en el dashboard
src/types/business.ts                   # MODIFICAR: Sale.paymentMethod += 'codi'; tipos Cobro, Pago, PurchaseOrder
firestore.rules                         # cobros/pagos: lectura para usuarios del negocio; escritura SOLO servidor (admin)
```

### Verificación de firma (TypeScript, probada contra el estándar Standard Webhooks)

```ts
import crypto from "node:crypto";

export function verificarFirmaPey(secret: string, headers: Headers, rawBody: string, toleranciaS = 300): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const firmas = headers.get("webhook-signature");
  if (!id || !ts || !firmas) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranciaS) return false;
  const llave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperado = crypto.createHmac("sha256", llave).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return firmas.split(" ").some((f) => {
    const [version, valor] = f.split(",");
    return version === "v1" && !!valor && valor.length === esperado.length &&
      crypto.timingSafeEqual(Buffer.from(valor), Buffer.from(esperado));
  });
}
```

En la ruta: `export const runtime = "nodejs"`, luego `const raw = await req.text()`, se verifica y **después** `JSON.parse(raw)`.

### Efectos de un pago confirmado (en la misma transacción)

| `cobro.tipo` | Efecto en Michingón |
|---|---|
| `venta_pos` | Crea `sales` con `paymentMethod: 'codi'`, `status: 'completed'`, descuenta stock con `FieldValue.increment(-cantidad)` y suma `totalPurchases` del cliente |
| `pedido` (WhatsApp) | `orders/{id}.status` pasa de `pending` a `preparing`, crea la venta y descuenta stock. Mensaje: "✅ Pagado, tu pedido está en preparación" |
| `anticipo` (cita) | `orders/{id}` (la cita) se marca confirmada, sin tocar stock. Mensajes a cliente y dueño |
| `saldo` | Venta por el resto. Al completarse la orden, aplica la **receta** (descuento de insumos, como Donna) y genera la factura en borrador |
| cualquiera | Si un producto queda **bajo `minStock`**, crea `purchaseOrders` pendiente y avisa al dueño por WhatsApp: "¿Mando el pedido a {proveedor}?" → "sí" → se envía al proveedor |

## 5. Cómo se mapea Donna y Cerberus a Michingón

| Donna / Cerberus (`referencia_cerberus/`) | En Michingón |
|---|---|
| Enzo (inventario, stock bajo) | `products` + `inventory/reconciliation`. Portar `alertas_stock_bajo` a `src/lib/server/inventario.ts` |
| Angélica + recetas (costeo, aplicar receta) | `recipes` ya tiene costeo. Portar `aplicar_receta` (descontar ingredientes) a `src/lib/server/recetas.ts` |
| Aldo (órdenes de compra) | `suppliers` + colección nueva `purchaseOrders` + envío por WhatsApp |
| Valentina (archivo de clientas, inactivas) | `clients` (agregar `ultimaVisita`, `formula`) |
| Isabel / Tomás / Verónica (predicción, márgenes, auditoría) | `profitability` y `reports`. Portar `dias_de_stock` y `analizar_margen` como funciones del servidor que use el agente |
| Annie (tono, idioma) | `src/lib/agente/prompts.ts` (agente nuevo, no la IA de Michingón) |
| Onboarding / ingesta | `onboarding`, `create-business`, `settings/import` (ya existen) |
| CFDI borrador (`cfdi_engine.py`) | Opcional: `invoicing`. Generar XML borrador o solo el PDF con la leyenda "timbrado simulado" |
| Impuestos (INSTRUCCIONES §13) | `tax-guide` + `iva-breakdown-dialog` (ya existen); sumar los cobros CoDi |

## 6. Recorrido de la demo en Michingón (2 escenas, todo verificable)

**Escena A, mostrador (POS + QR):**
1. El dueño abre Michingón → POS → agrega productos → **"Cobrar con CoDi"** → QR grande.
2. El cliente escanea con su app bancaria y paga $1–$5 reales.
3. Llega el webhook de pey → se verifica → se deduplica → se confirma con `GET /transaction/{id}`.
4. **El modal cambia solo a "PAGADO ✓"**, la venta aparece, el stock baja y el dashboard se actualiza en vivo.

**Escena B, WhatsApp (pedido y cita con anticipo):**
1. El cliente escribe: "Quiero 2 shampoos para recoger mañana a las 5".
2. El agente arma el pedido (`orders`) y manda un **cobro push CoDi** a su app bancaria.
3. El cliente paga → webhook → el pedido pasa a "en preparación", se descuenta el stock y se envía "✅ Pagado" a ambos lados.
4. El stock queda bajo el mínimo → al dueño le llega "¿Mando el pedido al proveedor?" → "sí" → la orden sale al proveedor por WhatsApp.

Casos borde y respuestas para los jueces: `INSTRUCCIONES.md` §10.

## 7. Variables de entorno

Ver `michingon3/.env.example`: Firebase (público y admin), **LLM del agente** (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`), pey, WhatsApp, `DEMO_BUSINESS_ID`, `OWNER_PHONES`, `STAFF_PHONES`, `SUPPLIER_PHONE` y `PUBLIC_BASE_URL`.

**En producción (Firebase Functions):** las variables van en `functions/.env` (o `functions/.env.local`, que el workflow copia). Los secretos (`PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`) van con `firebase functions:secrets:set` si da tiempo, o en el `.env` que **no** se commitea.

## 7B. Bases del concurso y activación de pey (hoja del evento)

- **Entrega:** domingo 15 de noviembre, **1:00 PM CDMX**, un proyecto por equipo, en el formulario de la hoja (o con su QR). Se pide:
  - nombre del equipo y descripción
  - **repositorio público (obligatorio)**
  - link en vivo (preferido)
  - video (opcional)
  - correos de los integrantes
- **Alta ante Banxico:** tarda unos 5 días. **Para probar hoy** se usan las **CLABEs pre-autorizadas** impresas en la hoja del evento. Se dan de alta en `portal.pey.mx`. **No se copian a este repo público.**
- **Transacciones de prueba de $0.01.** Los pagos de prueba **no se devuelven**, por eso `PEY_MONTO_DEMO_CENTAVOS=1`: el POS muestra el total real de la venta y le cobra a pey $0.01 con la etiqueta "DEMO" (regla "si simulas, indícalo").
- Para publicar el proyecto con cobros reales, hay que registrar una CLABE propia cuando esté activa.
- Documentación: `docs.pey.mx`.

## 7C. Qué ya está construido (`v4`)

| Pieza | Archivos | Estado |
|---|---|---|
| Cliente pey (QR, push, link, transacciones) | `src/lib/pey.ts` | ✅ contratos del OpenAPI |
| Pagos idempotentes + efectos (venta, stock con `increment`, pedido, orden de compra por stock bajo, eventos) | `src/lib/server/pagos.ts` | ✅ |
| Firma Standard Webhooks | `verificarFirmaPey` en `pagos.ts` | ✅ probada |
| Crear y consultar cobro (+ reconciliación con pey si el webhook no llega) | `src/app/api/pey/cobro/route.ts`, `src/app/api/pey/cobro/[id]/route.ts` | ✅ |
| Webhook de pey | `src/app/api/webhooks/pey/route.ts` | ✅ |
| POS: botón "Cobrar con CoDi" → QR o push al banco → "PAGADO ✓" en vivo | `src/components/pos/CodiCheckoutModal.tsx`, `pos/page.tsx` | ✅ |
| **Carga fácil de inventario:** Excel de la tienda, factura (XML/PDF) o foto de la lista → artículos agrupados con costo, precio, stock y **valor del inventario** | `src/lib/server/inventario-import.ts`, `src/app/api/inventario/*`, `inventory/cargar/page.tsx` | ✅ Excel y XML probados. Foto/PDF y agrupación necesitan `LLM_*` |
| LLM propio (OpenAI-compatible, no Genkit) | `src/lib/agente/llm.ts` | ✅ |
| Agente de WhatsApp (escena B): ver productos, crear pedido, cobro push CoDi, estado, órdenes de compra, "SÍ" aprueba y manda al proveedor, resumen del día; roles dueño/staff/cliente | `src/lib/agente/agente.ts`, `src/lib/whatsapp.ts`, `src/app/api/webhooks/whatsapp/route.ts` | ✅ código. Falta probar con `WHATSAPP_*` y `LLM_*` reales |
| Avisos después del pago (cliente, dueño, stock bajo) | `src/lib/server/notificaciones.ts` | ✅ |
| Chat web del agente (respaldo si WhatsApp falla en vivo) | `business/[id]/whatsapp`, `/api/agente/chat` | ✅ |
| Despliegue | `functions/package.json` con las dependencias nuevas (`firebase-admin`, `qrcode`, `xlsx`, `pdf-parse`, `firebase-functions`) | ✅ listo; falta `firebase deploy` con las variables |

### Cómo correrlo en local (5 minutos)

```bash
cd michingon3
cp .env.example .env.local   # llena Firebase, PEY_*, LLM_*, WHATSAPP_*, OWNER_PHONES
# Llave de servicio de Firebase (NO al repo): GOOGLE_APPLICATION_CREDENTIALS=C:/ruta/serviceAccountKey.json
npm install
npm run dev                  # http://localhost:3000
cloudflared tunnel --url http://localhost:3000   # URL pública para los webhooks de pey y Meta
```
En `portal.pey.mx` registra el webhook `https://<túnel>/api/webhooks/pey` y copia el secreto a `PEY_WEBHOOK_SECRET`. Aunque el webhook falle, el POS confirma el pago consultando a pey cada 4 s (reconciliación del lado del servidor, igual de idempotente).

## 8. URLs de los webhooks

Con Firebase:
- pey: `https://michingon3-a77f8.web.app/api/webhooks/pey` (registrar en `portal.mipey.mx/developers`)
- WhatsApp: `https://michingon3-a77f8.web.app/api/webhooks/whatsapp` (Meta → WhatsApp → Configuration)

Si se mueve a Vercel, cambia el dominio.
