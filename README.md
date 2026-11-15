# Michingón + CoDi

Michingón es la plataforma de gestión que el negocio ya tiene en vivo: [michingon3-a77f8.web.app](https://michingon3-a77f8.web.app). Punto de venta, ventas, pedidos, inventario por lotes, recetas, clientes, proveedores, gastos, facturas, guía del SAT, staff y biometría.

Este hackatón le suma el cobro con **CoDi** por la API de pey y un agente de WhatsApp **nuevo**. Los dos se construyen dentro de `michingon3/`, en TypeScript. De Michingón se toma la arquitectura: módulos, Firestore, pantallas, roles y despliegue. Su IA no se usa (`src/ai/`, Genkit, escáneres ni asistente). El agente vive en `src/lib/agente/` y llama a nuestro LLM con el cliente `openai` (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`).

La lógica de almacén inteligente y de compras al proveedor se porta desde Donna (`referencia_cerberus/salon_almacen/`), no se reescribe. El detalle está en `MICHINGON.md` y `INSTRUCCIONES.md`. Las fases son M0–M6 en `PROMPTS.md`.

## Qué recupera el negocio

En un salón mediano, Donna estima pérdidas evitables de $5,500 a $15,000 al mes (compras de emergencia, sobrestock, servicios mal costeados y producto sin registro) más unas 17 horas de la dueña. El ahorro calculado es de **$9,050 al mes**. Setup $3,500. Mensualidad $990. Se paga el primer mes.

El staff ve cantidades y puede registrar uso o marcar un servicio atendido. No ve costos, márgenes ni finanzas.

## Escena A, mostrador

1. El dueño abre el punto de venta, agrega productos y pica **Cobrar con CoDi**. Sale un QR.
2. El cliente paga $1 a $5 reales en su app bancaria.
3. Llega el webhook de pey. Se verifica la firma sobre el cuerpo crudo, se deduplica y se confirma con `GET /transaction/{id}` en estado `PAID`.
4. El modal cambia solo a **PAGADO**. La venta aparece, el stock baja en Firestore y el tablero se actualiza en vivo.

## Escena B, WhatsApp

1. El cliente escribe: "Quiero 2 shampoos para recoger mañana a las 5".
2. El agente arma el pedido y manda un cobro push CoDi a su banco.
3. El cliente paga. El pedido pasa a preparación, se descuenta el stock y ambos reciben "Pagado".
4. Si un producto queda bajo el mínimo, al dueño le llega "¿Mando el pedido al proveedor?". Responde "sí" y la orden sale por WhatsApp.

El anticipo de una cita confirma la orden y no toca el inventario. La receta descuenta insumos cuando el servicio ya se atendió o cuando se liquida el saldo.

```
WhatsApp o POS
  → agente nuevo (src/lib/agente) o botón Cobrar con CoDi
  → pey crea el cobro (push, QR o link). El monto lo calcula el servidor, en centavos
  → el banco confirma
  → POST /api/webhooks/pey con el cuerpo crudo
  → firma Standard Webhooks
  → tx.create en webhookEventos y en pagos/{transactionId}
  → solo si ambos son nuevos y GET /transaction/{id} dice PAID:
       venta, stock, pedido, receta u orden al proveedor
  → después del commit se mandan los mensajes
```

El panel en vivo es el de Michingón: Firestore avisa con `onSnapshot`. No se construye otro.

## Qué es real y qué es simulado

- **Real:** cobros CoDi (push, QR y link), la firma del webhook, la confirmación `PAID`, la idempotencia en Firestore y el envío por WhatsApp Cloud API cuando hay token.
- **Simulado, y se dice en pantalla:** el timbrado del CFDI (borrador, sin PAC ni CSD) y la estimación de IVA e ISR. No es una declaración.
- **Manual:** pey no reembolsa. El dueño transfiere y el sistema anota la devolución.

## Casos borde

| Caso | Qué pasa |
|---|---|
| Webhook repetido | `tx.create` falla porque el documento ya existe. Se responde 200 y no hay segundo efecto |
| Firma inválida o cuerpo alterado | No hay efectos |
| Cobro vencido | Se confirma con pey que no está `PAID`, se marca expirado y se avisa |
| Pago tardío | Se acepta, queda marcado y se avisa |
| Pago de más | El excedente queda como saldo a favor |
| Webhook perdido | La conciliación consulta `GET /transaction/{id}` y entra por la misma ruta |
| Servicio atendido dos veces | La receta no descuenta otra vez |
| Stock agotado entre el pedido y el pago | No se finge la salida. Se avisa |
| El pago no prueba identidad | La entrega o la cita atendida se confirman aparte |

Tres riesgos de la demo: el cuerpo crudo del webhook puede alterarse en Firebase (hay que probarlo en la URL pública; si falla, una función con `req.rawBody` o Vercel); `addSale` hoy no persiste el stock, así que el descuento del pago tiene que hacerlo el servidor; WhatsApp hoy solo escribe en consola y `functions/src` va atrasado, así que antes de desplegar se sincroniza `src`.

## Correrlo

```bash
cd michingon3
npm install
copy .env.example .env.local
npm run dev
```

`DEMO_BUSINESS_ID=demo`, el mismo negocio que el cliente web. La llave de servicio de Firebase se descarga de la consola y se apunta con `GOOGLE_APPLICATION_CREDENTIALS`. No se sube al repo.

Para el pago real hace falta un túnel y el webhook registrado en el portal de pey. Producción:

- pey: `https://michingon3-a77f8.web.app/api/webhooks/pey`
- WhatsApp: `https://michingon3-a77f8.web.app/api/webhooks/whatsapp`

Antes de cada deploy se copia `src` a `functions/src`. Los secretos van en `functions/.env`, que no se commitea.

## Variables

Firebase (público y admin), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `PEY_API_KEY`, `PEY_BASE_URL`, `PEY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `DEMO_BUSINESS_ID`, `OWNER_PHONES`, `STAFF_PHONES`, `SUPPLIER_PHONE`, `PUBLIC_BASE_URL`.

## Pitch de 60 segundos

Un salón mediano pierde de $5,500 a $15,000 al mes: no sabe qué tiene, compra de emergencia o de más, y cobra servicios con un precio viejo.

Michingón ya corre ese negocio: caja, inventario por lotes, recetas, clientes y proveedores. Le conectamos CoDi con pey. Cuando el banco confirma el pago, se registra la venta, baja el stock y, si algo queda corto, la dueña autoriza la compra al proveedor con un sí. Desde el mostrador o desde WhatsApp.

En la demo, el QR del punto de venta pasa solo a pagado. Luego un pedido por WhatsApp hace lo mismo y dispara la orden al proveedor.

El ahorro estimado es de $9,050 al mes. La mensualidad son $990. Se paga el primer mes, y el negocio no cambia de herramienta.

## Descripción para el formulario

Michingón ya opera el negocio: punto de venta, inventario por lotes, recetas, clientes, proveedores, pedidos y guía del SAT. Aquí el pago con CoDi, vía pey, confirma la venta, baja el stock y, si falta producto, la dueña autoriza con un sí la compra al proveedor. En el mostrador sale un QR; por WhatsApp el cliente pide y paga. Un salón mediano recupera unos $9,050 al mes frente a una mensualidad de $990. El timbrado y los impuestos van marcados como estimación.

## Guion de 2 minutos

**0:00–0:12.** Plano del salón y una frase en voz: un salón mediano pierde de $5,500 a $15,000 al mes por no controlar el inventario. Michingón ya es su sistema. Hoy se le conecta CoDi.

**0:12–0:28. Escena A.** El dueño abre el punto de venta, agrega el producto y pica Cobrar con CoDi. El QR llena la pantalla. Se dice el monto: entre $1 y $5 reales.

**0:28–0:48.** El cliente escanea con su banco y autoriza. Corte al modal, quieto, en pendiente. Sin tocar la pantalla, cambia a PAGADO. Abajo, la venta nueva y el stock que bajó. Una frase: eso lo escribió el webhook, después de verificar la firma y confirmar el pago con pey.

**0:48–1:05. Escena B.** Teléfono del cliente: "Quiero 2 shampoos para recoger mañana a las 5". El agente responde con el pedido y avisa que el cobro llegó a la app del banco.

**1:05–1:22.** El cliente paga. En el tablero de Michingón el pedido pasa a preparación y el stock vuelve a bajar, solo. Los dos teléfonos muestran "Pagado".

**1:22–1:40.** El producto queda bajo el mínimo. Al dueño le llega: "¿Mando el pedido al proveedor?". Dice "sí". Corte a la ficha del proveedor: la orden ya está enviada, con las piezas, sin un precio inventado.

**1:40–2:00.** Cierre con los números de Donna: $9,050 al mes recuperados, mensualidad $990, setup $3,500, se paga el primer mes. Última frase: el pago confirmado es el que mueve la venta, el stock y la compra. El timbrado y los impuestos se muestran como estimación.
