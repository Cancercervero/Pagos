# ⚠️ GROK: LEE ESTO PRIMERO. Esto es lo que te perdiste

> **Marca de versión vigente: `v3.2-construir`** (tag de git).
> **🚫 De Michingón SOLO se toma la ARQUITECTURA, NO su IA.**
> **🛠️ Prioridad: SOFTWER. Primero la arquitectura del software modificado y el código; pitch y video hasta el final (M6).**
> Si tu contexto de este proyecto es anterior a esta marca, **está incompleto y en parte equivocado**. Descártalo.
> Orden de lectura: este archivo → `MICHINGON.md` → `INSTRUCCIONES.md` → `PROMPTS.md`.

## Historial de versiones

| Marca | Qué traía | Qué faltaba |
|---|---|---|
| `4d0fd4c` (inicial) | Solo **pagos**: WhatsApp, cotizaciones, citas, cobranza CoDi con pey, CFDI en borrador. Stack Python nuevo | Todo el negocio |
| `v2-negocio-completo` | Se agregó **Donna** (almacén del salón) y los módulos de negocio de Cerberus | **Michingón**, que es la plataforma real del negocio |
| `v3-michingon` | Se agregó **`michingon3/`**, nuestra plataforma de negocio completa y en vivo, como base del proyecto | Decía que el agente se apoyaba en la IA de Michingón (Genkit). **Eso estaba mal** |
| `v3.1-arquitectura` | **De Michingón solo se toma la arquitectura** (módulos, Firestore, pantallas, roles, despliegue). **Su IA no se usa.** El agente es nuevo, con nuestro LLM | El prompt para Grok pedía pitch, README y video. **Prioridad equivocada** |
| **`v3.2-construir`** (vigente) | Grok trabaja de **arquitecto y programador**: `ARQUITECTURA.md` del software modificado y código TypeScript por fase. El pitch y el video van al final | (nada conocido) |

## 1. Lo más importante: Michingón es la base (v3)

`michingon3/` es nuestra plataforma de gestión para negocios pequeños. **Ya existe y está en vivo** en `https://michingon3-a77f8.web.app`.

**Stack que se toma:** Next.js 14 + TypeScript + Firebase (Auth, Firestore, Hosting/Cloud Run).

**🚫 Lo que NO se toma: la IA de Michingón.** Eso es `src/ai/` (Genkit/Gemini y sus 9 flujos: escáneres, pedido por texto, posts para redes, WhatsApp mock), `brain`, `ai-assistant-widget` y `mao-assistant`. No se usa, no se porta, no se arregla, **no aparece en el pitch ni en la demo**. El agente de WhatsApp se construye **nuevo** en `src/lib/agente/`, con nuestro LLM (paquete `openai` + `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`, por ejemplo Grok).

**Ya tiene:**
- **Ventas:** POS, ventas, pedidos.
- **Inventario:** lotes, mínimos y conciliación.
- **Recetas con costeo**, incluido el escaneo por foto.
- **Contactos:** clientes y proveedores.
- **Dinero:** gastos, flujo de caja, rentabilidad, reportes, facturas y **guía SAT por régimen** (RESICO/RIF/general).
- **Modo personas.**
- **Equipo:** staff con invitaciones, checador con geolocalización y nómina.
- **Biometría WebAuthn.**
- **Importación desde Excel** y onboarding por familia de negocio (comercio, alimentos, servicios, producción, renteros).

**Decisión v3:** la integración de pagos (pey/CoDi) y el agente de WhatsApp se construyen **dentro de Michingón, en TypeScript**. Ya no es un servicio Python nuevo. La ruta Python queda solo como plan de emergencia.

**Lee `MICHINGON.md`**, que tiene:
- §1, módulos y rutas que ya existen.
- §2, **problemas conocidos**:
  - `businessId` fijo en `'demo'`
  - `addSale` no persiste el stock
  - WhatsApp es mock
  - la IA de Michingón queda fuera
  - `functions/src` desfasado
  - riesgo del **cuerpo crudo del webhook** en Firebase
  - llave de servicio
- §3, modelo de Firestore para cobros y pagos con idempotencia (`tx.create`).
- §4, archivos exactos a crear o modificar y la verificación de firma en TypeScript (probada).
- §5, cómo Donna y Cerberus se mapean a módulos de Michingón.
- §6, **la demo nueva** en 2 escenas:
  - **A (mostrador):** POS "Cobrar con CoDi" → QR → pago → el modal cambia solo a "PAGADO" → venta y stock en vivo.
  - **B (WhatsApp):** pedido → cobro push CoDi → pago → pedido en preparación → stock bajo → "¿mando el pedido al proveedor?" → "sí".

## 2. Lo que se agregó en v2 (sigue vigente como lógica a portar)

`referencia_cerberus/salon_almacen/` es **Donna**, el almacén inteligente del salón:
- **Enzo:** inventario y stock bajo.
- **Angélica + recetas:** costeo y descuento de insumos por servicio.
- **Aldo:** órdenes de compra al proveedor.
- **Valentina:** archivo de clientas.
- **Isabel, Tomás y Verónica:** predicción, márgenes y auditoría.
- **Además:** expediente de estilistas, onboarding, ingesta y seguridad.
- **`DONNA_PROPUESTA_COMERCIAL.md`:** problema, ROI y precios. Solo para el pitch de la fase M6, **no ahora**.

`referencia_cerberus/negocio/` son 20 módulos de negocio de Cerberus: inventario, ventas/CRM, atención a clientes (Annie), onboarding, alertas, manufactura, caja y pronóstico.

En v3 **esta lógica se porta a TypeScript dentro de Michingón** (`MICHINGON.md` §5 y fase M5). No se reescribe desde cero ni se importa el Python.

## 3. Qué tienes que hacer ahora

1. Lee `MICHINGON.md` completo, luego `INSTRUCCIONES.md` (reglas §1, contratos de pey §6, efectos §7, casos borde §10, SAT §13, Donna §13B).
2. **Descarta** cualquier plan, código, pitch o README que asuma un servicio Python nuevo, que ignore Michingón, o que **use o presuma la IA de Michingón** (Genkit, escáneres, asistente).
3. Las fases a seguir son **M0–M6** en `PROMPTS.md`.
4. **🛠️ TU TRABAJO AHORA ES SOFTWARE, NO MARKETING.** Sin pitch, sin guion de video y sin README de venta **hasta que las escenas A y B funcionen** (eso es la fase M6, al final). Lo que se te pide:
   - **Arquitectura del software modificado:** cómo queda Michingón con pey y el agente. Componentes, rutas API, colecciones de Firestore, flujo del webhook paso a paso, seguridad y despliegue.
   - **Código TypeScript** de cada fase, archivo por archivo, **completo** y listo para pegar en Cursor, siguiendo `MICHINGON.md` §3–§4 y los contratos exactos de pey (`INSTRUCCIONES.md` §6, `docs/pey_openapi.json`).
5. Confirma que entendiste en 7 líneas:
   - qué es Michingón y qué módulos ya tiene;
   - qué se toma de Michingón (solo arquitectura) y qué NO (su IA), y dónde va el agente nuevo;
   - por qué la implementación va en TypeScript dentro de Michingón;
   - la escena A;
   - la escena B;
   - los 3 problemas conocidos más peligrosos para la demo;
   - qué no puede ver el rol staff.

## Prompt para pegarle a Grok

```
Tu contexto de este proyecto está desactualizado. La versión vigente es v3.1-arquitectura en https://github.com/Cancercervero/Pagos.
Lee en orden: GROK_LEEME_PRIMERO.md, MICHINGON.md, INSTRUCCIONES.md y PROMPTS.md (fases M0–M6).
Cambio clave: la base del proyecto es michingon3/, nuestra plataforma de negocio ya en vivo (Next.js + Firebase): POS, inventario, recetas, clientes, proveedores, pedidos, facturas, guía SAT, staff, modo personas y biometría. De Michingón SOLO tomamos la ARQUITECTURA (módulos, Firestore, pantallas, roles, despliegue). Su IA NO se usa (nada de src/ai/, Genkit, escáneres ni asistente). Los pagos con pey/CoDi y un agente de WhatsApp NUEVO (src/lib/agente, con nuestro LLM vía cliente openai) se construyen dentro de Michingón en TypeScript. Donna (referencia_cerberus/salon_almacen) es lógica a portar para el inventario inteligente y las compras al proveedor.
Descarta todo lo que hayas propuesto que asuma un servicio Python nuevo, ignore Michingón o use la IA de Michingón. Confirma en 7 líneas lo que pide la sección 3.5 de GROK_LEEME_PRIMERO.md.
NO hagas pitch, video ni README de venta: eso va hasta el final (fase M6), cuando el software funcione. Tu trabajo ahora es la ARQUITECTURA DEL SOFTWARE y MODIFICAR LA APP:
1. Entrégame ARQUITECTURA.md del Michingón modificado:
   - diagrama de componentes (Next.js app/api, Firestore, pey, WhatsApp Cloud API, LLM);
   - lista exacta de archivos nuevos y modificados dentro de michingon3/ (MICHINGON.md §4);
   - colecciones de Firestore con sus campos (MICHINGON.md §3);
   - diagrama de secuencia de la escena A (POS → /api/pey/cobro → QR → pago → /api/webhooks/pey → verificar firma sobre el cuerpo crudo → tx.create webhookEventos y pagos → GET /transaction/{id} → venta + stock con increment → onSnapshot actualiza el modal);
   - diagrama de secuencia de la escena B (WhatsApp → agente → orders → cobro push /codi/pn → webhook → preparing + stock → minStock → purchaseOrders → "sí" → proveedor);
   - seguridad (firma, idempotencia, firestore.rules, roles dueño/staff/cliente, secretos);
   - despliegue y cómo resolver el riesgo del cuerpo crudo en Firebase.
2. Luego el código COMPLETO de la fase M1 (PROMPTS.md), archivo por archivo, con la ruta de cada uno, listo para pegar en Cursor: src/lib/server/firebase-admin.ts, src/lib/pey.ts, src/lib/pey-webhook.ts, src/app/api/pey/cobro/route.ts, src/app/api/webhooks/pey/route.ts, src/components/pos/CodiCheckoutModal.tsx, los cambios al POS y a src/types/business.ts, el arreglo de addSale y firestore.rules. Usa los campos EXACTOS de docs/pey_openapi.json (amount, phoneNumber, concept, expiration, numRef, metadata; respuestas transactionId/codiId, id/qrString). No inventes nada.
```

Si Grok no puede abrir el repo, pégale **este archivo** y luego **`MICHINGON.md`** completos (están al inicio del PDF).
