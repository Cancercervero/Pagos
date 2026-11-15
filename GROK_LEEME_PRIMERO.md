# ⚠️ GROK: LEE ESTO PRIMERO. Esto es lo que te perdiste

> **Marca de versión: `v2-negocio-completo`** (tag de git, commit `bf7a80c`).
> Si tu contexto de este proyecto es anterior a esta marca, **está incompleto**. Descártalo y vuelve a leer `INSTRUCCIONES.md`.

## Qué pasó

La primera versión del repo (`4d0fd4c`, "Paquete inicial") solo traía la parte de **pagos**: WhatsApp, cotizaciones, citas, cobranza por CoDi con pey y facturas CFDI en borrador.

**Faltaba la mitad del negocio** que ya teníamos construida en Cerberus: tiendas, gestión de inventario, compras a proveedores, archivo de clientes y atención a clientes. **Ya está agregada.** Si diseñaste, escribiste o propusiste algo sin esto, **revísalo contra lo de abajo**.

## Lo que te perdiste (y dónde está ahora)

### 1. Donna: almacén inteligente del salón por WhatsApp (producto completo)
`referencia_cerberus/salon_almacen/`. **Ya funciona; se porta, no se reescribe.**

| Agente | Archivo | Qué hace |
|---|---|---|
| Donna | `agents/donna.py` | Orquestadora: despacha a los demás, reporte matutino, salud financiera |
| Enzo | `agents/enzo.py` | Almacenista: uso, entradas, mermas, estado del almacén, alertas de stock bajo |
| Angélica + recetas | `agents/angelica.py`, `agents/recetas.py` | Recetas por servicio ("hice un tinte" descuenta todo) y costo real por servicio. Lee fórmulas en foto |
| Aldo | `agents/aldo.py` | Órdenes de compra a proveedores: aprobar/rechazar, envío por WhatsApp, recepción |
| Valentina | `agents/valentina.py` | Archivo de clientas: visitas, fórmula personal, clientas inactivas (6+ semanas) |
| Isabel | `agents/isabel.py` | Predicción: días de stock, fechas de agotamiento, tendencias |
| Tomás | `agents/tomas.py` | Márgenes por producto y servicio, precio sugerido, alza de precios de proveedor |
| Verónica | `agents/veronica.py` | Auditoría de uso y anomalías |
| Expediente | `agents/expediente.py` | Perfil y consumo por estilista |
| (soporte) | `skill.py`, `bot.py`, `onboarding.py`, `ingest.py`, `security.py`, `cron.py`, `seed.py`, `whatsapp_sender.py`, `salon_manager.py` | Fotos con visión, bot, alta del negocio por chat, inventario inicial desde Excel/foto/texto, whitelist y permisos, reportes programados, ~20 insumos de ejemplo, envío por Meta y multi-salón |
| **Pitch** | `DONNA_PROPUESTA_COMERCIAL.md` | **Problema, ROI calculado y precios. Úsalo para el pitch** |

### 2. Módulos de negocio de Cerberus
`referencia_cerberus/negocio/`:
- **Inventario:** `empire_ledger.py` (lotes PEPS/FIFO), `almacen_db.py`, `almacen_skill.py`, `almacenista_skill.py`, `tania_bodeguera_skill.py`
- **Ventas y CRM:** `ventas_skill.py`, `deal_tracker.py`, `business_followup.py`
- **Atención a clientes:** `annie_empathy.py` (tono y guiones), `contact_gate.py` (filtro de contactos), `lingua_detector.py` (idioma), `annie_reporter.py` (bitácora)
- **Onboarding del negocio:** `onboarding_engine.py`, `config_cliente_template.json`
- **Alertas:** `alerta_imperativa.py`
- **Manufactura y recetas con costo:** `manufactura_db.py`, `manufactura_skill.py`
- **Caja, presupuesto y pronóstico:** `cajero_ledger.py`, `budget_sentinel.py`, `prophet_forecasting.py`
- **Acceso:** `auth_gate.py`

### 3. Cambios en la especificación (`INSTRUCCIONES.md`)
- **Sección 2:** 8 departamentos nuevos (almacén, recetas, compras, **tienda**, archivo de clientes, márgenes, atención, onboarding) y un **rol nuevo: staff** (`STAFF_PHONES`), que reporta uso de insumos y **nunca ve costos ni finanzas**.
- **Sección 3:** la demo crece con los pasos 9 a 11. Cadena: **pago → servicio atendido → descuento de insumos por receta → stock bajo → orden de compra → el dueño dice "sí" → le llega al proveedor**. Más la tienda: pedido de producto → cobro CoDi → salida de stock.
- **Sección 4:** carpeta nueva `app/negocio/`.
- **Sección 9:** tools nuevas de dueño (`estado_almacen`, `registrar_entrada`, `ordenes_compra`, `aprobar_orden`, `margen_servicio`, `prediccion_stock`, `clientas_inactivas`, `ficha_cliente`, `crear_receta`), de staff (`registrar_uso`, `servicio_atendido`, `consultar_stock`) y de tienda (`ver_productos`, `comprar_producto`).
- **Sección 10:** casos borde nuevos (stock agotado entre pedido y pago, servicio atendido dos veces, insumo sin stock).
- **Sección 13B (nueva):** cómo portar Donna y engancharla a los pagos de pey.
- **Sección 15:** tabla de qué archivo de referencia va a qué módulo nuevo.
- **`PROMPTS.md`:** nueva **FASE 5B**, y el prompt de pitch ahora incluye la propuesta comercial.
- **`.env.example`:** `STAFF_PHONES` y `SUPPLIER_PHONE`.

## Qué tienes que hacer ahora

1. Vuelve a leer **`INSTRUCCIONES.md` completo**, sobre todo las secciones 2, 3, 9, 13B y 15.
2. Si ya hiciste pitch, README o guion de video, **rehazlos** con la cadena completa (pagos + inventario + compras + clientes) y con el ROI de `DONNA_PROPUESTA_COMERCIAL.md`.
3. Si revisaste o escribiste código, verifica que no dupliques lo que ya existe en `referencia_cerberus/`. **Se porta, no se reescribe.**
4. Confirma que entendiste respondiendo en 5 líneas: qué agrega Donna, cuál es la cadena de la demo y qué no puede ver el rol staff.

## Prompt para pegarle a Grok

```
Tu contexto de este proyecto está desactualizado. Hay una versión nueva marcada como v2-negocio-completo en https://github.com/Cancercervero/Pagos.
Lee GROK_LEEME_PRIMERO.md: te perdiste todo el módulo de negocio (Donna: almacén, recetas, compras a proveedores, archivo de clientas, márgenes; tienda; atención a clientes; onboarding). Después relee INSTRUCCIONES.md completo (secciones 2, 3, 9, 13B y 15) y DONNA_PROPUESTA_COMERCIAL.md.
Descarta lo que hayas propuesto sin esto. Confirma en 5 líneas: qué agrega Donna, cuál es la cadena completa de la demo (pago → servicio → inventario → compra) y qué no puede ver el rol staff. Luego rehaz el pitch, el README y el guion del video con esa cadena y con el ROI de la propuesta.
```

Si Grok no puede abrir el repo, pégale este archivo completo y después `INSTRUCCIONES.md`.
