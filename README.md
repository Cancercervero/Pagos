# Anillo: tu agente bancario en el chat

**Cursor Hackatón México · construido con CoDi usando la API de pey**

Anillo es un agente que atiende a los clientes de un negocio pequeño por chat: cotiza, agenda y **cobra con CoDi**. Cuando el banco confirma el pago, el negocio se mueve solo: la cita se confirma, la venta entra al libro, el inventario baja, se propone la compra al proveedor y se aparta lo del SAT.

La idea completa: instalarlo en el WhatsApp de cualquier negocio y que funcione como un pequeño equipo de departamentos (agenda, cotizaciones, cobranza, almacén, facturas, cuentas). También sirve a una persona para cobrar, anotar gastos y ahorrar.

## Cómo probarlo en 2 minutos

Abre la portada (`/`) con la llave del equipo en el enlace (`/?k=…`). Tiene tres puertas:

| Puerta | Qué es | Para qué |
|---|---|---|
| **La mesa** (`/simulacion`) | El recorrido completo en una pantalla, con botones | Entender la idea sin instalar nada. El banco aquí es simulado y lo dice |
| **El mostrador** (`/panel`) | Tablero en vivo del negocio | Generar un **QR CoDi real de $0.01** y verlo cambiar solo cuando el banco confirma |
| **El teléfono** (`/app`) | La app del dueño y del cliente | Caja, inventario, proveedores, agenda, gasto personal |

En la mesa:

1. Toca **Pedir corte**, **Ver horarios** y **El de las 5**. El agente cotiza, aparta la cita y manda el cobro del anticipo.
2. Toca **Confirmar con Face ID**. Es el banco avisando: la cita pasa a confirmada y el ingreso entra al libro.
3. Vuelve a tocar **Confirmar**. No pasa nada: un pago repetido no se aplica dos veces.
4. Cambia a **Dueño** y toca **Cargar factura** y **Ver almacén**. Cada entrada es un lote con su precio de llegada.

## Qué es real y qué es simulado

**Real**

- Cobros CoDi con pey: QR (`POST /codi/qr`), aviso al banco del cliente (`POST /codi/pn`) y liga de pago.
- Confirmación del lado del servidor: aviso firmado de pey (Standard Webhooks) y consulta a `GET /transaction/{id}`.
- Un pago no se aplica dos veces, aunque el aviso llegue repetido.
- Si el aviso se pierde, una tarea le pregunta a pey y entra por la misma ruta.

**Simulado, y se dice en pantalla**

- El banco de la mesa, para que el recorrido se vea sin gastar.
- El timbrado de la factura: se genera el CFDI 4.0 en borrador, sin PAC ni CSD.
- Los impuestos: son una estimación, no una declaración.
- Las devoluciones: la API de pey no reembolsa. El dueño transfiere y el sistema lo anota.

Los pagos de prueba son de **$0.01**, como pide el evento.

## Qué hace hoy

- **Agente por chat** con herramientas: catálogo, cotización, horarios, apartar con anticipo, reenviar cobro, saldo, gastos, resumen, impuestos, factura, devolución.
- **Cobranza:** recordatorio a medio plazo, vencimiento, pago tardío, pago de más y pago sin conciliar.
- **Caja:** venta de mostrador con cobro CoDi.
- **Almacén:** se carga con el **Excel de la tienda, la factura (XML o PDF) o una foto de la lista**. Los artículos se acomodan por grupo, con su precio de llegada, sus piezas y el valor del inventario. Sale primero lo que llegó primero.
- **Recetas:** al atender un servicio se descuentan sus insumos. Si algo queda bajo el mínimo, se propone la orden al proveedor y el dueño la aprueba.
- **Libro:** cobrado, por cobrar, gastos y utilidad. Se aparta el IVA y el ISR estimados.
- **Persona:** gasto personal, meta de ahorro y cómo gasta.
- **Entrada segura a la app:** cara, huella o correo. El personal ve cantidades, no costos.
- **App Android** (`android/`): envoltura de la app web para el teléfono.

## Casos borde

| Caso | Qué pasa |
|---|---|
| Aviso repetido | Se reconoce y no hay segundo efecto |
| Firma inválida | Se rechaza, sin efectos |
| Cobro vencido | Se confirma con pey que no se pagó, se marca vencido y se avisa |
| Pago tardío | Se acepta, queda marcado y se avisa |
| Pago de más | El excedente queda como saldo a favor |
| Aviso perdido | La conciliación consulta a pey y aplica el pago por la misma ruta |
| Devolución | Manual, con su movimiento en el libro |
| Identidad y entrega | Un pago no las prueba. La cita atendida se confirma aparte |

## Correrlo

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env            # y llena los valores
uvicorn app.main:app --port 8000
```

Abre `http://127.0.0.1:8000/?k=<PANEL_KEY>`.

En Windows también está `iniciar_demo.bat`: levanta el servidor y abre un enlace público temporal para compartirlo.

Variables mínimas: `PEY_API_KEY`, `PANEL_KEY` y `OWNER_PHONES`. Opcionales: `PEY_WEBHOOK_SECRET` (aviso firmado), `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL` (para leer fotos y PDF, y para el chat libre), y `WHATSAPP_*` (WhatsApp Cloud API). Sin LLM, el agente usa respuestas guiadas y el Excel y el XML se cargan igual.

Pruebas: `python -m pytest tests -q` (57 pruebas).

Despliegue: `render.yaml` está listo para Render. El aviso de pey se registra en `https://<tu-app>/webhooks/pey`.

## Cómo está hecho

Python y FastAPI, SQLite y una app web sin framework. El detalle está en [ARQUITECTURA.md](ARQUITECTURA.md).

```
app/
  main.py            rutas
  portada.py         portada para el jurado
  pey.py             cliente de pey
  webhooks_pey.py    firma, deduplicación y efectos del pago
  tareas.py          recordatorios, vencimientos y conciliación
  agente/            agente del chat y sus herramientas
  departamentos/     agenda, cotizaciones, cobranza, almacén, cargas, facturas, impuestos, libro
  seguridad.py       cuentas, sesiones, cara, huella y correo
  tablero.py         lo que ve cada pantalla
  web/               app, mesa y mostrador
android/             app del teléfono
tests/               pruebas
```

## Otras carpetas

- `michingon3/`: Michingón, nuestra plataforma de gestión para negocios (Next.js y Firebase), con una integración de CoDi en el punto de venta. De ahí tomamos la organización por módulos. Unirla con Anillo es la segunda etapa.
- `referencia_cerberus/`: módulos de nuestro sistema anterior que sirvieron de base para el almacén y la atención a clientes.
- `docs/planeacion/`: notas de planeación del equipo durante el hackatón.

## Segunda etapa

- Conectar el número de WhatsApp del negocio.
- Timbrado real con un PAC.
- Unir Anillo con Michingón.
- Alta por chat de un negocio nuevo.
