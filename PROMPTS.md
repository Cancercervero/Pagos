# Prompts listos para pegar

> **`v3-michingon`: la ruta principal es construir dentro de `michingon3/`** (fases M0–M6, justo abajo).
> Las fases 1–6 en Python que vienen después quedan como **ruta alternativa**. Úsalas solo si Michingón no compila ni despliega a tiempo.

---

## M0: contexto (pégalo primero en cada chat nuevo de Cursor)

```
Lee completos @MICHINGON.md, @INSTRUCCIONES.md y @.cursor/rules/agente-bancario.mdc.
MICHINGON.md manda sobre el stack: la implementación va DENTRO de michingon3/ (Next.js 14 + Firebase, TypeScript). De Michingón SOLO se toma la ARQUITECTURA (módulos, Firestore, pantallas, roles, despliegue). Su IA NO se usa: no toques src/ai/ (Genkit/Gemini), brain, ai-assistant-widget ni mao-assistant. El agente se construye nuevo en src/lib/agente/ con el cliente openai y LLM_BASE_URL/LLM_API_KEY/LLM_MODEL. INSTRUCCIONES.md manda sobre QUÉ hacer (reglas del reto, demo, contratos de pey §6, idempotencia, casos borde §10, SAT §13, lógica de Donna §13B).
Para la API de pey consulta @docs/pey_openapi.json; no inventes campos. El código de @referencia_cerberus/ (Python) se porta como lógica a TypeScript, no se importa.
Trabajamos por fases M1–M6. Al terminar cada una: npm run build sin errores, dime qué archivos cambiaste y qué falta. No avances sin que te lo pida.
Confirma resumiendo en 5 líneas las escenas A y B de MICHINGON.md §6.
```

## M1: pey + webhook + POS "Cobrar con CoDi" (hito mínimo). Aprox. 2.5 h

```
Implementa M1 según @MICHINGON.md §2–§4 y @INSTRUCCIONES.md §6–§7:
1. cd michingon3 && npm install. Crea .env.local desde .env.example (te paso los valores aparte). Verifica que npm run dev levanta.
2. src/lib/server/firebase-admin.ts, src/lib/pey.ts (crearQr, crearPush, crearLink, obtenerTransaccion; errores {error:{message,type,requestId}}; reintento en 503), src/lib/pey-webhook.ts con verificarFirmaPey (código de MICHINGON.md §4) y procesarEventoPey: transacción Firestore con tx.create en webhookEventos/{webhook-id} y businesses/{bid}/pagos/{transactionId}; confirmar con GET /transaction/{id} status PAID; efectos de la tabla de MICHINGON.md §4 SOLO si ambos create fueron nuevos.
3. src/app/api/pey/cobro/route.ts y src/app/api/webhooks/pey/route.ts (runtime nodejs, raw body con req.text()).
4. Tipos nuevos en src/types/business.ts (Cobro, Pago, PurchaseOrder; Sale.paymentMethod += 'codi').
5. POS: botón "Cobrar con CoDi" → CodiCheckoutModal con QR grande (librería qrcode desde qrString) y estado en vivo vía onSnapshot del doc del cobro → "PAGADO ✓". Al pagar: venta creada en el servidor, stock descontado con FieldValue.increment.
6. Arregla addSale en DataContext para que el stock se descuente en Firestore (MICHINGON.md §2.2).
7. firestore.rules: cobros/pagos de solo lectura para el cliente web.
Listo cuando: en local con túnel (cloudflared/ngrok) y el webhook registrado en portal.mipey.mx, pago un QR de $1 desde mi banco y el modal cambia solo a PAGADO, la venta aparece y el stock baja. Y un webhook repetido no duplica nada.
```

## M2: despliegue temprano + prueba del webhook en producción. Aprox. 1 h

```
Despliega lo de M1 ANTES de seguir (MICHINGON.md §2.5, §2.6 y §8):
1. Sincroniza src → functions/src (como .agent/workflows/deploy-functions.md y .github/workflows/ci.yml), variables en functions/.env (no se commitea) y firebase deploy.
2. Registra https://michingon3-a77f8.web.app/api/webhooks/pey en pey y paga $1. Revisa los Webhook Logs del portal y los logs de la función.
3. Si el cuerpo llega vacío o la firma no valida en Firebase: Plan A, una función dedicada peyWebhook en functions/index.js con req.rawBody; o Plan B, desplegar en Vercel con las mismas variables. Elige el que funcione primero.
Listo cuando: un pago real en producción cambia el POS a PAGADO.
```

## M3: WhatsApp real + agente de pedidos con cobro. Aprox. 2.5 h

```
Implementa M3 según @MICHINGON.md §2.3, §4 y §6 (escena B) y @INSTRUCCIONES.md §8–§9:
1. src/lib/whatsapp.ts: enviarTexto/Imagen/Documento con Graph API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID), normalizar 521/52 → 10 dígitos, reintento con 52+10.
2. api/webhooks/whatsapp/route.ts: VERIFY_TOKEN desde env, ignorar statuses, dedupe por message.id (Firestore), responder 200 rápido, y llamar a src/lib/agente (deja de importar src/ai/flows/whatsapp-flow.ts; NO modifiques nada en src/ai/).
3. Agente NUEVO en src/lib/agente/ (llm.ts, herramientas.ts, prompts.ts) con el paquete openai (npm i openai) y LLM_BASE_URL/LLM_API_KEY/LLM_MODEL. Nada de Genkit. Tools: ver_productos (products con stock>0), crear_pedido (orders, status pending), cobrar_pedido (cobro push /codi/pn con phoneNumber=telefono10), estado_pedido, mi_saldo. Roles por OWNER_PHONES / STAFF_PHONES. Reglas duras: el LLM no marca pagos ni calcula montos.
4. Efecto pedido pagado (MICHINGON.md §4): order → preparing, venta, stock y mensajes a ambos.
5. Historial en conversaciones/{telefono10}/mensajes. Aviso de privacidad la primera vez.
Listo cuando: la escena B pasos 1–3 funciona por WhatsApp con dinero real.
```

## M4: cobranza, casos borde, citas con anticipo. Aprox. 1.5 h

```
Implementa M4 según @INSTRUCCIONES.md §7, §10 y §11 adaptado a Firestore:
1. api/pey/conciliar: expira cobros vencidos (confirmando con GET /transaction/{id}), un recordatorio a la mitad, reconcilia pagos con webhook perdido por la MISMA función idempotente. Protegido con un secreto; lo llama un cron externo (cron-job.org) cada minuto o el dashboard mientras está abierto.
2. Pago tardío, excedente, pago sin conciliar, devolución manual (movimiento en expenses con categoría "devolución").
3. Citas con anticipo: tool agendar_con_anticipo (order con deliveryDate y hora = cita; cobro tipo anticipo; al pagar se confirma). Tool del dueño cobrar_saldo.
Listo cuando: cada fila de la tabla §10 tiene su comportamiento y la cita con anticipo se confirma sola al pagar.
```

## M5: inventario inteligente (Donna) + proveedor. Aprox. 2 h

```
Implementa M5 según @MICHINGON.md §4–§5 y @INSTRUCCIONES.md §13B, portando la lógica de @referencia_cerberus/salon_almacen/ a TypeScript:
1. src/lib/server/inventario.ts (alertas de stock bajo, días de stock: enzo + isabel), src/lib/server/recetas.ts (aplicar receta = descontar ingredientes; recetas ya existen en Michingón), src/lib/server/compras.ts (purchaseOrders: generar, aprobar, rechazar, recibir: aldo).
2. Tras cualquier pago que descuente stock: si un producto queda bajo minStock, se crea purchaseOrder pendiente y se manda WhatsApp al dueño: "¿Mando el pedido a {proveedor}?". El dueño responde "sí" → se envía al proveedor (SUPPLIER_PHONE o supplier.phone).
3. Tools de dueño en el agente: estado_almacen, ordenes_compra, aprobar_orden, margen_producto, resumen_del_dia (ventas CoDi + gastos + estimación de IVA de tax-guide).
4. Rol staff: registrar_uso y servicio_atendido (aplica receta), sin ver costos.
Listo cuando: la escena B paso 4 funciona (stock bajo → "sí" → orden al proveedor) y el dashboard muestra la orden.
```

## M6: pulido de demo y entrega. Aprox. 1.5 h

```
M6:
1. Widget "Cobros CoDi en vivo" en el dashboard (feed de cobros/pagos con onSnapshot). Etiquetas "simulado" donde aplique (timbrado CFDI, estimación SAT).
2. Seed de demo (scripts/seed-demo-complete.ts) con productos con minStock realista y un proveedor con teléfono.
3. Deploy final; revisa que no haya secretos en el repo (serviceAccountKey.json, .env, tokens).
4. README de la raíz del repo: qué es, escenas A y B, qué es real y qué es simulado, casos borde, cómo correrlo.
Listo cuando: las escenas A y B corren completas en la URL pública.
```

---

# Ruta alternativa (Python): solo si Michingón no despliega a tiempo

Instrucciones para el equipo:
- **Cursor** escribe el código. Pégale **una fase a la vez** y no pases a la siguiente hasta que se cumpla el "Listo cuando".
- **Grok** se usa para el pitch, el README, el guion del video, revisar la lógica de impuestos y como segundo par de ojos en el código. Si dentro de Cursor eliges el modelo Grok, los prompts de Cursor sirven igual.

Todos los prompts asumen que el proyecto está abierto en Cursor, en la carpeta `agente-bancario/`.

---

## PROMPT 0: contexto (pégalo primero en cada chat nuevo de Cursor)

```
Lee completos @INSTRUCCIONES.md y @.cursor/rules/agente-bancario.mdc. Son la fuente de verdad del proyecto.
Para cualquier detalle de la API de pey consulta @docs/pey_openapi.json; no inventes campos.
El código en @referencia_cerberus/ es de un proyecto anterior: úsalo como referencia para copiar y adaptar, nunca lo importes directo.
Trabajamos por fases. Al terminar cada fase: corre los tests, dime qué archivos cambiaste y qué falta. No avances a la siguiente fase sin que te lo pida.
Confirma que entendiste resumiendo en 5 líneas el recorrido de la demo (sección 3).
```

---

## FASE 1: hito mínimo (cobro real → webhook → panel). Aprox. 2 h

```
Implementa la FASE 1 según @INSTRUCCIONES.md:
1. Estructura de carpetas de la sección 4 (solo lo necesario para esta fase), requirements.txt ya existe.
2. app/config.py (lee .env con python-dotenv y data/negocio.json).
3. app/db.py con el esquema COMPLETO de la sección 5 (CREATE TABLE IF NOT EXISTS) y helper de transacción atómica. Montos en centavos.
4. app/pey.py: cliente httpx con Bearer, funciones crear_push(), crear_qr(), crear_link(), obtener_transaccion(), con manejo de errores {"error":{message,type,requestId}} y reintento con backoff en 503. Contratos EXACTOS de la sección 6 / openapi.
5. app/webhooks_pey.py: verificar_firma() de la sección 6.5 sobre el cuerpo CRUDO + procesamiento idempotente de 8 pasos (sección 6.5) + efectos de la sección 7 (por ahora: cobro→pagado e ingreso en movimientos).
6. app/main.py: POST /webhooks/pey, POST /api/cobro-prueba (crea cobro QR de $1 con expiración 600), GET /qr/{cobro_id}.png (librería qrcode desde qr_string), GET /api/estado, GET /panel (app/web/panel.html con polling cada 2 s, muestra el QR grande y cambia a PAGADO en verde). Protege /panel y /api/* con ?k=PANEL_KEY.
7. Tests (pytest) en tests/: firma válida, firma inválida → 401, webhook duplicado (mismo webhook-id) → sin efectos dobles, mismo transactionId con distinto webhook-id → sin efectos dobles. Mockea obtener_transaccion.
Listo cuando: los tests pasan y, con el túnel y el webhook registrado en portal.mipey.mx, pago el QR de $1 desde mi banco y el panel cambia a PAGADO solo.
```

---

## FASE 2: WhatsApp + chat de respaldo. Aprox. 1 h

```
Implementa la FASE 2 según @INSTRUCCIONES.md sección 8, adaptando @referencia_cerberus/whatsapp_bridge.py (quita gRPC/BUS/PRESENCE):
1. app/telefono.py: normalizar wa_id (521XXXXXXXXXX / 52XXXXXXXXXX) → telefono10, con tests.
2. app/whatsapp.py: enviar_texto(), enviar_documento(link, filename), enviar_imagen(link); reintento con '52'+10 dígitos si falla '521...'.
3. Rutas GET/POST /webhooks/whatsapp: verificación hub.*, ignorar 'statuses', dedupe por message.id, responder 200 inmediato y procesar en BackgroundTasks.
4. Crear/actualizar contacto (rol 'dueno' si telefono10 está en OWNER_PHONES), guardar mensajes en la tabla mensajes.
5. Por ahora, responder con eco: "Recibí: <texto>". Incluye el aviso de privacidad la primera vez (sección 9).
6. GET /demo (app/web/demo.html): chat web que llama POST /api/chat {telefono10, texto} → MISMA función que procesa WhatsApp.
Listo cuando: mando "hola" por WhatsApp y recibo el eco; /demo hace lo mismo.
```

---

## FASE 3: el agente y los departamentos de cotización, citas y anticipo. Aprox. 2.5 h

```
Implementa la FASE 3 según @INSTRUCCIONES.md secciones 2, 3, 7 y 9:
1. data/catalogo.json ya existe; úsalo.
2. app/departamentos/cotizaciones.py adaptando @referencia_cerberus/cotizacion_skill.py (PDF con reportlab en data/archivos/, sin _match_services, sin deal_tracker). El total lo calcula el código.
3. app/departamentos/citas.py: huecos libres según horarios de negocio.json, apartar y confirmar en SQLite.
4. app/departamentos/cobranza.py: crear_cobro(tipo, metodo, monto, contacto, cotizacion) usando app/pey.py; por defecto metodo='push' con phoneNumber = telefono10 y metadata {"cobro_id": id}.
5. app/agente/llm.py: cliente openai con LLM_BASE_URL/LLM_API_KEY/LLM_MODEL, bucle de tool calling (máx 5 vueltas, timeout 25 s, fallback a menú).
6. app/agente/herramientas.py: tools de CLIENTE de la sección 9 (ver_catalogo, crear_cotizacion, ver_horarios, aceptar_y_apartar, reenviar_cobro, mi_saldo) con validación de rol dentro de cada tool.
7. app/agente/prompts.py con las reglas duras de la sección 9.
8. Efectos del pago (sección 7): anticipo pagado → cita confirmada + mensajes a cliente y dueño (después del commit).
9. Conecta el agente al lugar del eco de la fase 2.
Listo cuando: por WhatsApp hago los pasos 1–5 de la sección 3 con dinero real ($1–$5) y la cita queda confirmada sola al pagar.
```

---

## FASE 4: cobranza completa y casos borde. Aprox. 1.5 h

```
Implementa la FASE 4 según @INSTRUCCIONES.md secciones 10 y 11:
1. app/tareas.py: loop asyncio cada 30 s iniciado en el startup: expiración (verificando con GET /transaction/{id}), un recordatorio a la mitad del tiempo, reconciliación de webhooks perdidos por la MISMA ruta idempotente.
2. Pago tardío (pago_tardio=1), excedente / segundo pago al mismo QR (saldo a favor + aviso al dueño), pago parcial, pago sin conciliar (aviso al dueño).
3. Tools de DUEÑO: cobrar_saldo, crear_cobro_libre, cuentas_por_cobrar, agenda, registrar_devolucion.
4. Liquidación: pagado >= total → cotización 'liquidada'.
5. Tests para cada fila de la tabla de la sección 10 (mockeando pey).
Listo cuando: pasan los tests y en vivo el paso 6 de la sección 3 funciona (cobrar el saldo).
```

---

## FASE 5: facturas, libro, gastos e impuestos. Aprox. 1.5 h

```
Implementa la FASE 5 según @INSTRUCCIONES.md secciones 12 y 13:
1. app/departamentos/facturas.py adaptando @referencia_cerberus/cfdi_engine.py: XML CFDI 4.0 + PDF, NullAdapter, marca "BORRADOR – timbrado simulado (requiere PAC y CSD)", público en general si no hay RFC, forma_pago "03", PUE/PPD. Una factura por cotización (UNIQUE). Se genera y envía sola al liquidar.
2. app/departamentos/libro.py: registrar_gasto, resumen por periodo (cobrado, por cobrar, gastos, utilidad).
3. app/departamentos/impuestos.py: IVA neto e ISR RESICO con la tabla de negocio.json; leyenda de estimación.
4. Tools de dueño: registrar_gasto, resumen_finanzas, estimar_impuestos, generar_factura.
5. Tests de cálculo de impuestos y resumen.
Listo cuando: los pasos 6–8 de la sección 3 funcionan por WhatsApp.
```

---

## FASE 5B: almacén, recetas, clientes, compras y tienda (portar Donna). Aprox. 2 h

```
Implementa la FASE 5B según @INSTRUCCIONES.md secciones 2, 3 (pasos 9–11), 9 (tools de dueño, staff y tienda), 10 y 13B, y la tabla de la sección 15.
PORTA, no reescribas: el código ya existe en @referencia_cerberus/salon_almacen/ y @referencia_cerberus/negocio/.
1. app/negocio/almacen_db.py: copia negocio/empire_ledger.py + negocio/almacen_db.py; DB en data/almacen.db; init = EmpireLedger(path) y luego AlmacenDB(path).migrate(). Corre salon_almacen/seed.py adaptado en el arranque si está vacío y agrega una receta por servicio de data/catalogo.json.
2. app/negocio/enzo.py, recetas.py (+angelica sin fotos), aldo.py (+whatsapp_sender → app/whatsapp.py; sin aldo_scout), valentina.py, analisis.py (isabel+tomas+veronica). Cambia los imports host_engine.* por locales y ask_llm por app/agente/llm.py.
3. Rol STAFF (STAFF_PHONES) con sus 3 tools, sin acceso a costos ni finanzas. Tools nuevas de dueño y de cliente (tienda) de la sección 9.
4. Enganches de la sección 13B: servicio_atendido → receta → descuento → visita → margen → stock bajo → orden de compra → aviso al dueño. Pedido de tienda pagado (webhook) → salida de stock → "listo para recoger".
5. tareas.py: reporte matutino al dueño (reporte de donna) y alerta de stock bajo, una vez por producto al día.
6. Tests: aplicar receta descuenta lo correcto; servicio_atendido dos veces no descuenta doble; staff no ve costos; pedido de tienda solo descuenta stock tras el pago.
Listo cuando: los pasos 9 y 10 de la sección 3 funcionan por WhatsApp (descuento de inventario + orden de compra aprobada con "sí" que llega al proveedor), y el panel muestra el stock.
```

---

## FASE 6: panel pulido y despliegue. Aprox. 1.5 h

```
FASE 6 según @INSTRUCCIONES.md secciones 14 y 18:
1. Panel: feed de eventos en vivo, tarjetas cobrado / por cobrar / gastos / utilidad, citas de hoy, QR grande para cobro presencial, animación al llegar un pago, **stock con semáforo (bajo mínimo en rojo), órdenes de compra pendientes y margen por servicio**, etiquetas "simulado" donde aplique. Que se vea bien en un proyector.
2. Seed al arrancar si la base de datos está vacía (catálogo + contacto dueño).
3. Prepara el despliegue en Render: start command, variables, healthcheck GET /salud.
4. Revisa que no haya secretos en el repo (busca tokens, CLABEs, teléfonos reales) y que .env esté ignorado.
Listo cuando: la app vive en una URL pública, ambos webhooks apuntan ahí y el recorrido completo de la sección 3 funciona contra producción.
```

---

## PROMPT PARA GROK: pitch, README y video

```
Eres el estratega de producto de un equipo en el Cursor Hackatón México (reto: construir con CoDi usando la API de pey). Te paso el documento maestro del proyecto:

<pega aquí INSTRUCCIONES.md completo>

Y esta es la propuesta comercial del módulo de almacén que ya tenemos (problema, ROI y precios):

<pega aquí referencia_cerberus/salon_almacen/DONNA_PROPUESTA_COMERCIAL.md>

Entrégame:
1. Pitch de 60 segundos (problema → solución → demo → por qué ahora), en español de México, sin jerga.
2. Descripción del proyecto para el formulario (máx. 500 caracteres).
3. README.md para el repo público: qué es, cómo funciona (diagrama en texto del flujo WhatsApp → agente → pey/CoDi → webhook → efectos), cómo correrlo, variables de entorno, qué es real y qué es simulado, casos borde manejados, siguientes pasos (Supabase, timbrado real con PAC, plantillas de WhatsApp, modo persona).
4. Guion de video demo de 2 minutos, toma por toma, siguiendo la sección 3.
5. Las 5 preguntas más difíciles que harían los jueces y la respuesta corta a cada una (incluye: idempotencia, pagos tardíos, devoluciones, identidad, SAT).
No inventes funciones que no estén en el documento.
```

## PROMPT PARA GROK: revisión de código (después de cada fase)

```
Revisa este código de un proyecto que cobra con CoDi vía la API de pey y procesa webhooks firmados (Standard Webhooks).
Busca SOLO bugs reales: doble procesamiento de pagos (idempotencia), verificación de firma incorrecta (debe ser sobre el cuerpo crudo), condiciones de carrera en SQLite, montos en float en lugar de centavos, secretos en el código, tools de dueño accesibles a clientes, path traversal en /archivos.
Para cada hallazgo: archivo y línea, el problema, cómo reproducirlo y el arreglo mínimo.
<pega aquí los archivos>
```

## PROMPT PARA GROK: revisión de impuestos

```
Revisa esta lógica de estimación fiscal para un negocio pequeño en México (persona física en RESICO). Confirma o corrige con la LISR y la LIVA vigentes: la tabla de tasas mensuales de ISR RESICO, el IVA trasladado al 16 % sobre cobros y el acreditamiento de IVA solo de gastos con CFDI. Señala lo que falte para que la estimación no engañe al usuario. Es informativa, no una declaración.
<pega aquí app/departamentos/impuestos.py y data/negocio.json>
```
