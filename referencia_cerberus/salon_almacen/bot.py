"""
salon_almacen/bot.py — Bot de Telegram del salón.

Arranca con: python -m host_engine.products.salon_almacen.start
(o directamente: python -m host_engine.products.salon_almacen.bot)
"""
import json
import logging
import os
import re
import shutil
import tempfile
from datetime import datetime

from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    ContextTypes, filters
)

from host_engine.products.salon_almacen import skill, onboarding, security

logger = logging.getLogger("DonnaSalonBot")

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
_pending: dict = {}  # {chat_id: pending_dict} confirmaciones de foto


def _load_config() -> dict:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def _rol(user_id: str, config: dict) -> str:
    return config.get("roles", {}).get(str(user_id), "")


def _es_admin(user_id: str, config: dict) -> bool:
    return _rol(user_id, config) in ("admin", "duena")


def _registrado(user_id: str, config: dict) -> bool:
    return bool(_rol(user_id, config))


# ── /start ────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)

    if _registrado(user_id, config):
        salon = config.get("salon_nombre", "Salón")
        rol = _rol(user_id, config)
        await update.message.reply_text(
            f"💇 *Donna — {salon}*\nRol: _{rol}_\n\nManda foto del producto que usaste o escribe qué necesitas.",
            parse_mode="Markdown"
        )
        return

    # Desconocido → silencio total
    logger.warning(f"[Bot] /start de usuario no registrado: {user_id}")
    return


# ── /setup — reiniciar onboarding ────────────────────────────────────────────

async def cmd_setup(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    chat_id = str(update.effective_chat.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    onboarding.clear_state(chat_id)
    await update.message.reply_text(onboarding.procesar(chat_id), parse_mode="Markdown")


# ── /si /no — confirmación de foto ───────────────────────────────────────────

async def cmd_si(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    chat_id = update.effective_chat.id
    str_chat = str(chat_id)

    if onboarding.is_onboarding(str_chat):
        await update.message.reply_text(onboarding.procesar(str_chat, texto="sí"), parse_mode="Markdown")
        return

    # Pending de recepción de pedido (factura + productos)
    if user_id in _pending_recepcion:
        await confirmar_recepcion(user_id, config, update)
        return

    # Pending de fórmula manuscrita (Angélica)
    from host_engine.products.salon_almacen.agents.angelica import confirmar_formula, _pending_formula
    if user_id in _pending_formula:
        respuesta = confirmar_formula(user_id)
        await update.message.reply_text(respuesta, parse_mode="Markdown")
        await _notificar_admin(ctx, config, respuesta)
        return

    pending = _pending.pop(chat_id, None)
    if not pending:
        await update.message.reply_text("No hay operación pendiente.")
        return
    respuesta = skill.confirmar_uso(pending, config=config)
    await update.message.reply_text(respuesta, parse_mode="Markdown")
    await _notificar_admin(ctx, config, respuesta)


async def cmd_no(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    str_chat = str(update.effective_chat.id)
    if onboarding.is_onboarding(str_chat):
        await update.message.reply_text(onboarding.procesar(str_chat, texto="no"), parse_mode="Markdown")
        return
    _pending_recepcion.pop(user_id, None)
    _pending.pop(update.effective_chat.id, None)
    await update.message.reply_text("❌ Cancelado.")


# ── /aprobar_XXXX /rechazar_XXXX — órdenes de Aldo ───────────────────────────

async def cmd_aprobar(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    texto = update.message.text.strip()
    m = re.match(r'/aprobar_(\S+)', texto, re.IGNORECASE)
    if not m:
        await update.message.reply_text("Uso: /aprobar_ORD-XXXXXX")
        return
    from host_engine.products.salon_almacen.agents.aldo import aprobar_orden
    respuesta = aprobar_orden(m.group(1))
    await update.message.reply_text(respuesta, parse_mode="Markdown")


async def cmd_rechazar(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    texto = update.message.text.strip()
    m = re.match(r'/rechazar_(\S+)', texto, re.IGNORECASE)
    if not m:
        await update.message.reply_text("Uso: /rechazar_ORD-XXXXXX")
        return
    from host_engine.products.salon_almacen.agents.aldo import rechazar_orden
    await update.message.reply_text(rechazar_orden(m.group(1)), parse_mode="Markdown")


async def cmd_ordenes(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    from host_engine.products.salon_almacen.agents.donna import ordenes_pendientes_msg
    await update.message.reply_text(ordenes_pendientes_msg(), parse_mode="Markdown")


# ── /reporte — Isabel análisis semanal ───────────────────────────────────────

async def cmd_reporte(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin o dueña.")
        return
    await update.message.reply_text("📊 Preparando reporte...", parse_mode="Markdown")
    from host_engine.products.salon_almacen.agents.donna import reporte_semanal_completo
    await update.message.reply_text(reporte_semanal_completo(config), parse_mode="Markdown")


# ── /prediccion — fechas de agotamiento + estacionalidad ─────────────────────

async def cmd_prediccion(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin o dueña.")
        return
    await update.message.reply_text("🔮 Calculando predicciones...", parse_mode="Markdown")
    from host_engine.products.salon_almacen.agents.isabel import reporte_predictivo
    await update.message.reply_text(reporte_predictivo(), parse_mode="Markdown")


# ── /salud — diagnóstico financiero ──────────────────────────────────────────

async def cmd_salud(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin o dueña.")
        return
    await update.message.reply_text("💳 Analizando salud financiera...", parse_mode="Markdown")
    from host_engine.products.salon_almacen.agents.donna import salud_financiera
    await update.message.reply_text(salud_financiera(config), parse_mode="Markdown")


# ── /proveedores — lista y estado ────────────────────────────────────────────

async def cmd_proveedores(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB()
    db.migrate()
    provs = db.listar_proveedores()
    if not provs:
        await update.message.reply_text(
            "No hay proveedores registrados.\nUsa /setup para agregarlos o escribe:\n"
            "_registra proveedor [nombre] whatsapp [número]_",
            parse_mode="Markdown"
        )
        return
    lines = ["🏭 *Proveedores registrados:*\n"]
    for p in provs:
        linea = f"  • *{p['name']}* ⭐{p.get('rating', 5):.0f}"
        if p.get("whatsapp"):
            linea += f"\n    📱 {p['whatsapp']}"
        if p.get("email"):
            linea += f"\n    📧 {p['email']}"
        if p.get("ciudad"):
            linea += f"\n    📍 {p['ciudad']}"
        lines.append(linea)
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /clientes — archivo de clientas ──────────────────────────────────────────

async def cmd_clientes(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin.")
        return
    texto = update.message.text.strip()
    from host_engine.products.salon_almacen.agents import valentina as _v
    # /clientes inactivas → clientes sin visita 6 semanas
    if "inactiv" in texto.lower():
        await update.message.reply_text(_v.clientes_inactivas(), parse_mode="Markdown")
        return
    # /clientes [nombre] → historial de esa clienta
    m = re.match(r'/clientes\s+(.+)', texto)
    if m:
        await update.message.reply_text(_v.historial_cliente(m.group(1)), parse_mode="Markdown")
        return
    # /clientes → lista completa
    await update.message.reply_text(_v.listar_clientes(), parse_mode="Markdown")


# ── /perfil — expediente del estilista ───────────────────────────────────────

async def cmd_perfil(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _registrado(user_id, config):
        return

    # Admin puede pedir perfil de otro: /perfil 123456789
    texto = update.message.text.strip()
    m = re.match(r'/perfil\s+(\d+)', texto)
    target_id = m.group(1) if m and _es_admin(user_id, config) else user_id

    from host_engine.products.salon_almacen.agents.expediente import reporte_estilista, reporte_top
    moneda = config.get("moneda", "$")

    if target_id == "top" and _es_admin(user_id, config):
        await update.message.reply_text(reporte_top(moneda=moneda), parse_mode="Markdown")
    else:
        await update.message.reply_text(reporte_estilista(target_id, moneda=moneda), parse_mode="Markdown")


# ── /recetas — listar recetas de servicio ────────────────────────────────────

async def cmd_recetas(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _registrado(user_id, config):
        return
    from host_engine.products.salon_almacen.agents.angelica import listar
    moneda = config.get("moneda", "$")
    await update.message.reply_text(listar(moneda=moneda), parse_mode="Markdown")


# ── /stock — inventario rápido ────────────────────────────────────────────────

async def cmd_stock(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _registrado(user_id, config):
        await update.message.reply_text("No estás registrado.")
        return
    from host_engine.products.salon_almacen.agents.enzo import reporte_enzo
    await update.message.reply_text(reporte_enzo(), parse_mode="Markdown")


# ── /historial — importar datos pasados para Isabel ──────────────────────────

_pending_historial: dict = {}  # user_id → "esperando"


async def cmd_historial(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin puede importar historial.")
        return

    args = ctx.args
    if args:
        # Texto inline: /historial en enero usé 200ml de tinte rubio...
        texto = " ".join(args)
        db_path = config.get("db_path")
        from host_engine.cerberus_core.almacen_db import AlmacenDB
        from host_engine.products.salon_almacen.ingest import ingest_historial
        db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
        db.migrate()
        n = ingest_historial(texto, db)
        await update.message.reply_text(
            f"✅ Importé *{n}* registros.\nIsabel ya puede analizar patrones.",
            parse_mode="Markdown"
        )
        return

    _pending_historial[user_id] = "esperando"
    await update.message.reply_text(
        "📅 *Importar historial*\n\n"
        "Manda tu data histórica:\n"
        "  📸 Foto de cuaderno o hoja de registro\n"
        "  📝 Texto: _\"en enero usé 200ml de tinte rubio\"_\n"
        "  📊 Escribe `/historial [texto con tus datos]`\n\n"
        "Isabel usará esto para predecir cuándo se acaba cada producto.",
        parse_mode="Markdown"
    )


# ── /ayuda ────────────────────────────────────────────────────────────────────

async def cmd_ayuda(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    es_admin = _es_admin(user_id, config)
    lines = [
        "💇 *Donna — Comandos:*\n",
        "📸 Manda foto de un producto → Donna lo identifica",
        "✍️ Escribe qué usaste → Enzo lo descuenta\n",
        "/stock — ver inventario completo",
        "/recetas — ver recetas de servicio",
        "/perfil — mi expediente (servicios y consumo)",
        "/si /no — confirmar operación",
    ]
    if es_admin:
        lines += [
            "\n_Admin:_",
            "/clientes — archivo de clientas",
            "/clientes inactivas — sin visita 6+ semanas",
            "/clientes [nombre] — historial de clienta",
            "/perfil top — ranking de estilistas",
            "/perfil 12345 — expediente de estilista específico",
            "_Escribe:_ `nueva receta [servicio]: [cantidad] [producto], ...`",
            "/prediccion — cuándo se acaba qué + estacionalidad",
            "/recibir — registrar pedido recibido (foto factura + productos)",
            "/historial — importar datos pasados (Excel/foto/texto)",
            "/reporte — análisis semanal de Isabel",
            "/salud — salud financiera del salón",
            "/ordenes — ver órdenes pendientes de Aldo",
            "/proveedores — ver proveedores",
            "/aprobar\\_ORD-XXXX — aprobar pedido",
            "/rechazar\\_ORD-XXXX — rechazar pedido",
            "/setup — reconfigurar el sistema",
        ]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── Helpers de caption ───────────────────────────────────────────────────────

_SERVICIOS_KEYWORDS = (
    "keratina", "tinte", "coloración", "decoloración", "alisado",
    "tratamiento", "baño de color", "mechas", "balayage", "formula", "fórmula",
)
_CLIENTE_PREPOSICIONES = ("para", "de", "a", "cliente")


def _caption_es_formula(caption: str) -> bool:
    """True si el caption menciona un servicio o clienta → es fórmula manuscrita."""
    low = caption.lower()
    return any(k in low for k in _SERVICIOS_KEYWORDS + _CLIENTE_PREPOSICIONES)


def _extraer_nombre_caption(caption: str) -> str | None:
    """Extrae nombre de clienta del caption. Ej: 'keratina para señora Martínez' → 'señora Martínez'"""
    low = caption.lower()
    for prep in _CLIENTE_PREPOSICIONES:
        idx = low.find(prep + " ")
        if idx != -1:
            resto = caption[idx + len(prep) + 1:].strip()
            # Quitar palabras de servicio del resto
            for svc in _SERVICIOS_KEYWORDS:
                resto = re.sub(rf'\b{svc}\b', '', resto, flags=re.IGNORECASE).strip()
            if len(resto) > 2:
                return resto
    return None


# ── Recepción de pedidos ──────────────────────────────────────────────────────

_RECEPCION_KEYWORDS = [
    "llegó", "llego", "recibí", "recibi", "recepción", "recepcion",
    "pedido", "factura", "remisión", "remision", "nota de entrega",
    "entregaron", "trajeron", "nos llegó",
]

_PROMPT_RECEPCION = """Eres un auditor de entregas para salón de belleza.
Analiza esta foto (puede mostrar productos + factura, nota de remisión, o etiquetas).
Extrae TODA la información visible.
Responde SOLO con JSON válido:
{
  "factura": {
    "numero": "F-001 o vacío si no se ve",
    "fecha": "YYYY-MM-DD o vacío",
    "proveedor": "nombre del proveedor o vacío"
  },
  "productos": [
    {"nombre": "nombre del producto", "cantidad": N, "unidad": "ml|g|pza|litro|caja|tubo|sobre"}
  ],
  "total_items_distintos": N
}
Si no hay factura visible, deja los campos de factura vacíos."""

_pending_recepcion: dict = {}  # user_id → {"productos": [...], "factura": {...}, "photo_ref": "..."}


def _caption_es_recepcion(caption: str) -> bool:
    low = caption.lower()
    return any(k in low for k in _RECEPCION_KEYWORDS)


async def _procesar_foto_recepcion(tmp_path: str, evidencia_path: str,
                                    user_id: str, update: Update):
    from host_engine.cerberus_core.llm_router import ask_llm_vision
    import json as _json, re as _re

    await update.message.reply_text("📦 Leyendo factura y productos...", parse_mode="Markdown")

    raw = ask_llm_vision(_PROMPT_RECEPCION, tmp_path)
    m = _re.search(r'\{.*\}', raw, _re.DOTALL)
    if not m:
        await update.message.reply_text("⚠️ No pude leer la factura. Intenta con mejor iluminación.")
        return

    try:
        data = _json.loads(m.group())
    except _json.JSONDecodeError:
        await update.message.reply_text("⚠️ Error al leer la imagen.")
        return

    productos = data.get("productos", [])
    factura   = data.get("factura", {})

    if not productos:
        await update.message.reply_text("⚠️ No detecté productos en la imagen.")
        return

    # Guardar factura en /facturas/YYYY-MM/
    factura_dir = os.path.join(os.path.dirname(__file__), "facturas",
                               datetime.now().strftime("%Y-%m"))
    os.makedirs(factura_dir, exist_ok=True)
    ts = int(datetime.now().timestamp())
    factura_ref = os.path.join(factura_dir, f"{user_id}_{ts}_factura.jpg")
    shutil.copy2(evidencia_path, factura_ref)

    _pending_recepcion[user_id] = {
        "productos": productos,
        "factura":   factura,
        "photo_ref": factura_ref,
    }

    # Mostrar resumen para confirmación
    lines = ["📦 *Recepción detectada:*\n"]
    if factura.get("numero"):
        lines.append(f"  📄 Factura: *{factura['numero']}*")
    if factura.get("proveedor"):
        lines.append(f"  🏭 Proveedor: {factura['proveedor']}")
    if factura.get("fecha"):
        lines.append(f"  📅 Fecha: {factura['fecha']}")
    lines.append("")
    lines.append("*Productos:*")
    for p in productos:
        lines.append(f"  • {p['nombre']}: *{p['cantidad']:.0f}* {p.get('unidad','pza')}")
    lines.append("\n¿Confirmas entrada? Responde */si* para registrar o */no* para cancelar.")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_recibir(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    """Admin anuncia que llegó un pedido → Donna espera foto de factura + productos."""
    config = _load_config()
    user_id = str(update.effective_user.id)
    if not _es_admin(user_id, config):
        await update.message.reply_text("⛔ Solo admin puede registrar recepciones.")
        return
    _pending_recepcion[user_id] = "__esperando_foto__"
    await update.message.reply_text(
        "📦 *Recibir pedido*\n\n"
        "Manda foto de la *factura + productos* recibidos.\n"
        "Si puedes, incluye los productos desplegados para que cuente las unidades.\n\n"
        "_También puedes mandar la foto con caption 'llegó pedido' sin usar este comando._",
        parse_mode="Markdown"
    )


async def confirmar_recepcion(user_id: str, config: dict, update: Update):
    """Admin confirma la recepción → Enzo registra ENTRADAs + Aldo marca orden."""
    pending = _pending_recepcion.pop(user_id, None)
    if not pending:
        return

    from host_engine.cerberus_core.almacen_db import AlmacenDB
    from host_engine.products.salon_almacen.ingest import _resolver_producto_fuzzy
    from host_engine.products.salon_almacen.agents import aldo as _aldo

    db_path = config.get("db_path")
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    provs = db.listar_proveedores()
    prov_nombre = pending["factura"].get("proveedor", "")
    prov = db.get_proveedor(prov_nombre) if prov_nombre else None
    prov_id = prov["id"] if prov else (provs[0]["id"] if provs else db.registrar_proveedor("Proveedor Salón"))

    fecha_str = pending["factura"].get("fecha") or datetime.now().isoformat()
    photo_ref = pending["photo_ref"]

    lines = ["✅ *Enzo registró la entrada:*\n"]
    errores = []
    for p in pending["productos"]:
        prod = _resolver_producto_fuzzy(db, p["nombre"])
        if not prod:
            errores.append(f"  ⚠️ No encontrado: {p['nombre']}")
            continue
        precio_compra = float(prod.get("costo_bruto") or 0)
        db.entrada_stock(
            prod["id"], prov_id,
            float(p["cantidad"]),
            precio_compra=precio_compra,
            photo_ref=photo_ref,
            fecha=fecha_str,
        )
        lines.append(f"  +{p['cantidad']:.0f} {prod.get('unit','pza')} *{prod['name']}*")
        # Alerta de variación de precio (Tomás)
        from host_engine.products.salon_almacen.agents.tomas import alerta_variacion_en_recepcion
        moneda = config.get("moneda", "$")
        alerta = alerta_variacion_en_recepcion(prod["id"], precio_compra, db_path, moneda)
        if alerta:
            lines.append(f"  {alerta}")

    if errores:
        lines.append("\n⚠️ *No encontrados (agrégalos al inventario):*")
        lines.extend(errores)

    # Vincular con orden de Aldo si hay una aprobada para estos productos
    orden_match = _aldo.match_orden_por_productos(pending["productos"])
    if orden_match:
        factura_num = pending["factura"].get("numero", "")
        msg_aldo = _aldo.recibir_orden(
            orden_match["id"],
            productos_recibidos=pending["productos"],
            factura_num=factura_num,
            photo_ref=photo_ref,
        )
        lines.append(f"\n{msg_aldo}")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── Fotos ─────────────────────────────────────────────────────────────────────

async def handle_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    chat_id = update.effective_chat.id
    str_chat = str(chat_id)

    # Capa 1: whitelist
    if not _registrado(user_id, config):
        if not onboarding.is_onboarding(str_chat):
            logger.warning(f"[Bot] Foto de usuario no registrado: {user_id} — ignorado")
            return

    photo = update.message.photo[-1]
    file = await ctx.bot.get_file(photo.file_id)

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    await file.download_to_drive(tmp_path)

    # Guardar evidencia antes de procesar
    evidencia_path = None
    if not onboarding.is_onboarding(str_chat):
        ev_dir = os.path.join(os.path.dirname(__file__), "evidencias",
                              datetime.now().strftime("%Y-%m-%d"))
        os.makedirs(ev_dir, exist_ok=True)
        ts = int(datetime.now().timestamp())
        evidencia_path = os.path.join(ev_dir, f"{user_id}_{ts}.jpg")
        shutil.copy2(tmp_path, evidencia_path)

    try:
        if onboarding.is_onboarding(str_chat):
            await update.message.reply_text("📸 Analizando imagen...", parse_mode="Markdown")
            await update.message.reply_text(
                onboarding.procesar(str_chat, image_path=tmp_path), parse_mode="Markdown"
            )
            return

        # Admin en modo /historial → leer foto como registro histórico
        if user_id in _pending_historial:
            _pending_historial.pop(user_id)
            from host_engine.cerberus_core.almacen_db import AlmacenDB
            from host_engine.products.salon_almacen.ingest import ingest_historial_foto
            db_path = config.get("db_path")
            db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
            db.migrate()
            n = ingest_historial_foto(tmp_path, db)
            await update.message.reply_text(
                f"✅ *{n}* registros históricos importados.\n"
                "Isabel ya puede analizar patrones de consumo.",
                parse_mode="Markdown"
            )
            return

        caption = (update.message.caption or "").strip()

        # Admin en modo /recibir O caption de recepción → flujo de factura
        en_modo_recibir = _pending_recepcion.get(user_id) == "__esperando_foto__"
        if en_modo_recibir:
            _pending_recepcion.pop(user_id)
        if en_modo_recibir or (caption and _caption_es_recepcion(caption)):
            if not _es_admin(user_id, config):
                await update.message.reply_text("⛔ Solo admin puede registrar recepciones.")
                return
            await _procesar_foto_recepcion(tmp_path, evidencia_path, user_id, update)
            return

        # Caption con nombre de clienta/servicio → modo fórmula manuscrita
        if caption and _caption_es_formula(caption):
            await update.message.reply_text("📋 Leyendo fórmula...", parse_mode="Markdown")
            from host_engine.products.salon_almacen.agents.angelica import foto_formula_a_servicio
            nombre_cliente = _extraer_nombre_caption(caption)
            resp = foto_formula_a_servicio(tmp_path, nombre_cliente, user_id, config)
            await update.message.reply_text(resp, parse_mode="Markdown")
            return

        # Sin caption o caption genérico → identificar producto (flujo normal)
        await update.message.reply_text("📸 Analizando producto...", parse_mode="Markdown")
        result = skill.procesar_foto(tmp_path, user_id, config, photo_ref=evidencia_path)
        if result["pending"]:
            _pending[chat_id] = result["pending"]
        await update.message.reply_text(result["mensaje"], parse_mode="Markdown")
    finally:
        os.unlink(tmp_path)


# ── Texto ─────────────────────────────────────────────────────────────────────

async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    config = _load_config()
    user_id = str(update.effective_user.id)
    texto = update.message.text.strip()
    str_chat = str(update.effective_chat.id)

    # Onboarding activo → pasar directo (usuario ya se está registrando)
    if onboarding.is_onboarding(str_chat):
        await update.message.reply_text(
            onboarding.procesar(str_chat, texto=texto), parse_mode="Markdown"
        )
        return

    # Capa 1: whitelist — usuario no registrado
    if not _registrado(user_id, config):
        # Única excepción: setup_token para primer admin
        if security.verificar_setup_token(texto, config):
            onboarding.clear_state(str_chat)
            # Registrar como admin provisional
            _agregar_rol_config(user_id, "admin", config)
            await update.message.reply_text(
                "✅ Token correcto. Bienvenido, admin.\n\n" +
                onboarding.procesar(str_chat),
                parse_mode="Markdown"
            )
        else:
            logger.warning(f"[Bot] Mensaje de no registrado: {user_id} — ignorado")
        return

    # Capa 2: anti-inyección
    seguro, _ = security.sanitizar(texto)
    if not seguro:
        logger.warning(f"[Bot] Posible inyección de {user_id}: '{texto[:50]}'")
        await update.message.reply_text(
            "📦 Solo soy el almacenista. Puedo ayudarte con stock, productos y pedidos."
        )
        return

    # Capa 3: scope guard — mensajes largos fuera de tema
    if len(texto) > 30 and not security.es_tema_inventario(texto):
        await update.message.reply_text(security.respuesta_fuera_scope())
        return

    from host_engine.products.salon_almacen.agents.donna import despachar_texto
    respuesta = despachar_texto(texto, user_id, config)
    await update.message.reply_text(respuesta, parse_mode="Markdown")
    await _notificar_admin(ctx, config, respuesta)


def _agregar_rol_config(user_id: str, rol: str, config: dict):
    import json
    config.setdefault("roles", {})[str(user_id)] = rol
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


# ── Notificación interna ──────────────────────────────────────────────────────

async def _notificar_admin(ctx, config: dict, mensaje: str):
    if "BAJO MÍNIMO" not in mensaje and "URGENTE" not in mensaje:
        return
    admin_id = config.get("admin_chat_id", "")
    if not admin_id:
        return
    try:
        await ctx.bot.send_message(
            chat_id=admin_id,
            text=f"🔔 *Alerta:*\n{mensaje}",
            parse_mode="Markdown"
        )
    except Exception:
        pass


# ── Arranque ──────────────────────────────────────────────────────────────────

def run():
    config = _load_config()
    token = config.get("telegram_token", "")
    if not token:
        raise ValueError("Falta telegram_token en config.json")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    logger.info(f"Arrancando Donna — {config.get('salon_nombre', 'sin configurar')}")

    app = ApplicationBuilder().token(token).build()

    # Iniciar cron
    from host_engine.products.salon_almacen import cron
    cron.iniciar(app.bot)

    # Comandos
    app.add_handler(CommandHandler("start",       cmd_start))
    app.add_handler(CommandHandler("setup",       cmd_setup))
    app.add_handler(CommandHandler("si",          cmd_si))
    app.add_handler(CommandHandler("no",          cmd_no))
    app.add_handler(CommandHandler("ordenes",     cmd_ordenes))
    app.add_handler(CommandHandler("prediccion",  cmd_prediccion))
    app.add_handler(CommandHandler("reporte",     cmd_reporte))
    app.add_handler(CommandHandler("salud",       cmd_salud))
    app.add_handler(CommandHandler("proveedores", cmd_proveedores))
    app.add_handler(CommandHandler("clientes",    cmd_clientes))
    app.add_handler(CommandHandler("perfil",      cmd_perfil))
    app.add_handler(CommandHandler("recetas",     cmd_recetas))
    app.add_handler(CommandHandler("stock",       cmd_stock))
    app.add_handler(CommandHandler("recibir",     cmd_recibir))
    app.add_handler(CommandHandler("historial",   cmd_historial))
    app.add_handler(CommandHandler("ayuda",       cmd_ayuda))

    # Comandos dinámicos /aprobar_XXX /rechazar_XXX
    app.add_handler(MessageHandler(filters.Regex(r'^/aprobar_\S+'), cmd_aprobar))
    app.add_handler(MessageHandler(filters.Regex(r'^/rechazar_\S+'), cmd_rechazar))

    # Mensajes
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    run()
