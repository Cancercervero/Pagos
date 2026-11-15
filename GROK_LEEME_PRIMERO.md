# ⚠️ GROK: LEE ESTO PRIMERO. Esto es lo que te perdiste

> **Marca de versión vigente: `v3-michingon`** (tag de git).
> Si tu contexto de este proyecto es anterior a esta marca, **está incompleto y en parte equivocado**. Descártalo.
> Orden de lectura: este archivo → `MICHINGON.md` → `INSTRUCCIONES.md` → `PROMPTS.md`.

## Historial de versiones

| Marca | Qué traía | Qué faltaba |
|---|---|---|
| `4d0fd4c` (inicial) | Solo **pagos**: WhatsApp, cotizaciones, citas, cobranza CoDi con pey, CFDI en borrador. Stack Python nuevo | Todo el negocio |
| `v2-negocio-completo` | Se agregó **Donna** (almacén del salón) y los módulos de negocio de Cerberus | **Michingón**, que es la plataforma real del negocio |
| **`v3-michingon`** (vigente) | Se agregó **`michingon3/`**, nuestra plataforma de negocio completa y en vivo. **Ahora es la base del proyecto** | (nada conocido) |

## 1. Lo más importante: Michingón es la base (v3)

`michingon3/` es nuestra plataforma de gestión para negocios pequeños. **Ya existe y está en vivo** en `https://michingon3-a77f8.web.app`.

**Stack:** Next.js 14 + TypeScript + Firebase (Auth, Firestore, Hosting/Cloud Run) + Genkit/Gemini.

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
- **9 flujos de IA:** pedidos por texto, escáneres de producto, factura, contacto, conteo de inventario y posts para redes.

**Decisión v3:** la integración de pagos (pey/CoDi) y el agente de WhatsApp se construyen **dentro de Michingón, en TypeScript**. Ya no es un servicio Python nuevo. La ruta Python queda solo como plan de emergencia.

**Lee `MICHINGON.md`**, que tiene:
- §1, módulos y rutas que ya existen.
- §2, **problemas conocidos**:
  - `businessId` fijo en `'demo'`
  - `addSale` no persiste el stock
  - WhatsApp es mock
  - Genkit/Gemini 1.5 viejo
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
- **`DONNA_PROPUESTA_COMERCIAL.md`:** problema, ROI y precios. **Úsalo para el pitch.**

`referencia_cerberus/negocio/` son 20 módulos de negocio de Cerberus: inventario, ventas/CRM, atención a clientes (Annie), onboarding, alertas, manufactura, caja y pronóstico.

En v3 **esta lógica se porta a TypeScript dentro de Michingón** (`MICHINGON.md` §5 y fase M5). No se reescribe desde cero ni se importa el Python.

## 3. Qué tienes que hacer ahora

1. Lee `MICHINGON.md` completo, luego `INSTRUCCIONES.md` (reglas §1, contratos de pey §6, efectos §7, casos borde §10, SAT §13, Donna §13B).
2. **Descarta** cualquier plan, código, pitch o README que asuma un servicio Python nuevo o que ignore Michingón.
3. Las fases a seguir son **M0–M6** en `PROMPTS.md`.
4. Rehaz el **pitch, el README y el guion del video** con:
   - **Michingón:** la plataforma completa que ya existe y está en vivo.
   - **pey/CoDi:** el pago confirmado dispara trabajo real (venta, stock, pedido, compra al proveedor).
   - **WhatsApp:** el negocio opera desde el chat.
   - El ROI de `DONNA_PROPUESTA_COMERCIAL.md`.
5. Confirma que entendiste en 6 líneas:
   - qué es Michingón y qué módulos ya tiene;
   - por qué la implementación va en TypeScript dentro de Michingón;
   - la escena A;
   - la escena B;
   - los 3 problemas conocidos más peligrosos para la demo;
   - qué no puede ver el rol staff.

## Prompt para pegarle a Grok

```
Tu contexto de este proyecto está desactualizado. La versión vigente es v3-michingon en https://github.com/Cancercervero/Pagos.
Lee en orden: GROK_LEEME_PRIMERO.md, MICHINGON.md, INSTRUCCIONES.md y PROMPTS.md (fases M0–M6).
Cambio clave: la base del proyecto es michingon3/, nuestra plataforma de negocio ya en vivo (Next.js + Firebase): POS, inventario, recetas, clientes, proveedores, pedidos, facturas, guía SAT, staff, modo personas, biometría y flujos de IA. Los pagos con pey/CoDi y el agente de WhatsApp se construyen DENTRO de Michingón en TypeScript. Donna (referencia_cerberus/salon_almacen) es lógica a portar para el inventario inteligente y las compras al proveedor.
Descarta todo lo que hayas propuesto que asuma un servicio Python nuevo o ignore Michingón. Confirma en 6 líneas lo que pide la sección 3.5 de GROK_LEEME_PRIMERO.md. Luego rehaz el pitch de 60 s, la descripción para el formulario (máx. 500 caracteres), el README y el guion del video de 2 minutos con las escenas A y B de MICHINGON.md §6 y el ROI de referencia_cerberus/salon_almacen/DONNA_PROPUESTA_COMERCIAL.md.
```

Si Grok no puede abrir el repo, pégale **este archivo** y luego **`MICHINGON.md`** completos (están al inicio del PDF).
