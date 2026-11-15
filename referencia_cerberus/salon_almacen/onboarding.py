"""
salon_almacen/onboarding.py — Onboarding conversacional para nuevos clientes.

El agente entrevista al cliente por Telegram/WhatsApp.
No necesita intervención del desarrollador después de instalar.

Estado persistido en onboarding_state.json por chat_id.

Flujo:
  INICIO → NOMBRE_SALON → RECIBE_LISTA → CONFIRMA_PRODUCTOS → ROLES → COMPLETO
"""
import json
import logging
import os
import re

logger = logging.getLogger("SalonOnboarding")

_STATE_PATH = os.path.join(os.path.dirname(__file__), "onboarding_state.json")
_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

# ── Estado por chat_id ────────────────────────────────────────────────────────

def _load_states() -> dict:
    if os.path.exists(_STATE_PATH):
        with open(_STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_states(states: dict):
    with open(_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(states, f, ensure_ascii=False, indent=2)


def get_state(chat_id: str) -> dict:
    return _load_states().get(str(chat_id), {})


def set_state(chat_id: str, data: dict):
    states = _load_states()
    states[str(chat_id)] = data
    _save_states(states)


def clear_state(chat_id: str):
    states = _load_states()
    states.pop(str(chat_id), None)
    _save_states(states)


def is_onboarding(chat_id: str) -> bool:
    s = get_state(chat_id)
    return bool(s) and s.get("fase") != "COMPLETO"


# ── LLM helpers ──────────────────────────────────────────────────────────────

_PROMPT_EXTRAER_LISTA = """Eres un asistente que extrae listas de productos de salón de belleza.
El cliente envió este mensaje con su inventario actual.
Extrae TODOS los productos. Si no hay cantidades, pon 0.
Responde SOLO con JSON válido:
{
  "productos": [
    {"nombre": "...", "cantidad": N, "unidad": "pza|ml|g|litro|caja|tubo|sobre", "costo": N_o_0},
    ...
  ]
}
Mensaje del cliente:
"""

_PROMPT_EXTRAER_FOTO = """Eres un extractor de inventario para salón de belleza.
Analiza esta imagen. Puede ser una lista escrita, una foto de anaqueles, o una hoja de inventario.
Extrae TODOS los productos visibles.
Responde SOLO con JSON válido:
{
  "productos": [
    {"nombre": "...", "cantidad": N, "unidad": "pza|ml|g|litro|caja|tubo|sobre", "costo": 0},
    ...
  ]
}
Si no hay cantidades visibles, pon 0."""


def _extraer_lista_texto(texto: str) -> list:
    from host_engine.cerberus_core.llm_router import ask_llm
    raw = ask_llm(_PROMPT_EXTRAER_LISTA + texto, max_tokens=1024)
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group()).get("productos", [])
    except Exception:
        return []


def _extraer_lista_foto(image_path: str) -> list:
    from host_engine.cerberus_core.llm_router import ask_llm_vision
    raw = ask_llm_vision(_PROMPT_EXTRAER_FOTO, image_path)
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group()).get("productos", [])
    except Exception:
        return []


# ── Guardar producto confirmado ───────────────────────────────────────────────

def _guardar_producto(prod: dict, db_path: str = None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    nombre = prod["nombre"].strip().title()
    sku = re.sub(r'[^A-Z0-9]', '', nombre.upper())[:8]
    existente = db.get_producto(sku) or db.get_producto(nombre.lower())
    if existente:
        return existente["id"]

    pid = db.registrar_producto(
        name=nombre, sku=sku,
        unit=prod.get("unidad", "pza"),
        categoria=prod.get("categoria", "general"),
        min_stock=float(prod.get("min_stock") or 0),
        costo_bruto=float(prod.get("costo") or 0),
        costo_proceso=0.0,
        precio_venta=0.0,
    )
    cantidad = float(prod.get("cantidad") or 0)
    if cantidad > 0:
        provs = db.listar_proveedores()
        prov_id = provs[0]["id"] if provs else db.registrar_proveedor("Proveedor Salón")
        db.entrada_stock(pid, prov_id, cantidad, precio_compra=float(prod.get("costo") or 0))
    return pid


# ── Guardar roles en config ───────────────────────────────────────────────────

def _agregar_rol(chat_id_nuevo: str, rol: str):
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    config.setdefault("roles", {})[str(chat_id_nuevo)] = rol
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def _guardar_nombre_salon(nombre: str):
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    config["salon_nombre"] = nombre.strip().title()
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


# ── Máquina de estados ────────────────────────────────────────────────────────

def procesar(chat_id: str, texto: str = None, image_path: str = None, db_path: str = None) -> str:
    """
    Recibe un mensaje (texto o imagen) del cliente durante onboarding.
    Retorna la respuesta del agente.
    """
    state = get_state(chat_id)
    fase = state.get("fase", "INICIO")

    # ── INICIO ───────────────────────────────────────────────────────────────
    if fase == "INICIO":
        set_state(chat_id, {"fase": "NOMBRE_SALON"})
        return (
            "👋 Hola, soy *Donna*, tu asistente de almacén.\n\n"
            "Vamos a configurar tu inventario juntos. Es rápido.\n\n"
            "¿Cómo se llama tu salón?"
        )

    # ── NOMBRE_SALON ─────────────────────────────────────────────────────────
    if fase == "NOMBRE_SALON":
        nombre_salon = texto.strip() if texto else "Mi Salón"
        _guardar_nombre_salon(nombre_salon)
        set_state(chat_id, {"fase": "RECIBE_LISTA", "salon": nombre_salon, "productos_pendientes": [], "idx": 0})
        return (
            f"✅ Perfecto, *{nombre_salon}*.\n\n"
            "Ahora dime tu inventario. Puedes:\n"
            "  📝 Pegar una lista de texto\n"
            "  📸 Mandar fotos de tus productos o anaqueles\n"
            "  📊 Decirme el link de tu Excel o Sheets\n\n"
            "Cuando termines de mandar todo, escribe *listo*."
        )

    # ── RECIBE_LISTA ─────────────────────────────────────────────────────────
    if fase == "RECIBE_LISTA":
        state = get_state(chat_id)
        pendientes = state.get("productos_pendientes", [])

        if texto and texto.strip().lower() in ("listo", "ya", "eso es todo", "es todo"):
            if not pendientes:
                return "No capturé ningún producto todavía. Manda tu lista o fotos primero."
            # Pasar a confirmación
            set_state(chat_id, {**state, "fase": "CONFIRMA_PRODUCTOS", "idx": 0})
            return _preguntar_producto(pendientes, 0)

        nuevos = []
        if image_path:
            nuevos = _extraer_lista_foto(image_path)
        elif texto:
            # Detectar link Sheets
            if "docs.google.com/spreadsheets" in texto or re.match(r'^[a-zA-Z0-9_-]{20,}$', texto.strip()):
                return (
                    "📊 Recibí el link de Sheets.\n"
                    "Para importar directamente escribe:\n"
                    "`/ingest_sheets <ID_o_URL>`\n\n"
                    "O pega el contenido aquí como texto."
                )
            nuevos = _extraer_lista_texto(texto)

        if not nuevos:
            return "🤔 No pude extraer productos de eso. Intenta con una lista más clara o manda una foto."

        pendientes.extend(nuevos)
        set_state(chat_id, {**state, "productos_pendientes": pendientes})
        n = len(nuevos)
        total = len(pendientes)
        return (
            f"✅ Capturé *{n}* producto{'s' if n>1 else ''} más ({total} en total).\n"
            "Puedes mandar más fotos/listas, o escribe *listo* para confirmarlos."
        )

    # ── CONFIRMA_PRODUCTOS ───────────────────────────────────────────────────
    if fase == "CONFIRMA_PRODUCTOS":
        state = get_state(chat_id)
        pendientes = state["productos_pendientes"]
        idx = state["idx"]
        sub_fase = state.get("sub_fase")

        if not texto:
            if sub_fase == "esperando_min":
                return _preguntar_min(pendientes[idx])
            return _preguntar_producto(pendientes, idx)

        t = texto.strip().lower()

        # ── esperando mínimo de stock ──────────────────────────────────────
        if sub_fase == "esperando_min":
            prod = pendientes[idx]
            if t in ("no sé", "no se", "ns", "0", "ninguno", "omitir", "skip"):
                prod["min_stock"] = 0.0
            elif re.search(r'[\d.]+', t):
                prod["min_stock"] = float(re.search(r'[\d.]+', t).group())
                # máximo = si el usuario escribe "3/10" → min=3, max=10
                partes = re.findall(r'[\d.]+', t)
                if len(partes) >= 2:
                    prod["max_stock"] = float(partes[1])
            else:
                return "Escribe un número (ej: *3*) o *no sé* para omitir."

            try:
                _guardar_producto(prod, db_path)
                logger.info(f"Guardado: {prod['nombre']} min={prod.get('min_stock',0)}")
            except Exception as e:
                logger.warning(f"Error guardando {prod['nombre']}: {e}")

            idx += 1
            if idx >= len(pendientes):
                set_state(chat_id, {**state, "fase": "PROVEEDORES", "idx": idx,
                                    "sub_fase": None, "proveedores_encontrados": []})
                return (
                    f"🎉 ¡Listo! {idx} productos guardados.\n\n"
                    "Ahora los proveedores. ¿Ya tienes a quién le compras?\n\n"
                    "  *sí* → dime sus datos\n"
                    "  *no* → Aldo los busca por ti en internet\n\n"
                    "¿Tienes proveedores?"
                )
            set_state(chat_id, {**state, "productos_pendientes": pendientes,
                                "idx": idx, "sub_fase": None})
            return _preguntar_producto(pendientes, idx)

        # ── confirmación del producto ──────────────────────────────────────
        if t in ("si", "sí", "ok", "s", "yes", "✅"):
            set_state(chat_id, {**state, "productos_pendientes": pendientes,
                                "idx": idx, "sub_fase": "esperando_min"})
            return _preguntar_min(pendientes[idx])

        elif t in ("no", "n", "skip", "omitir"):
            idx += 1

        elif t.startswith("corregir ") or t.startswith("nombre "):
            nuevo_nombre = re.sub(r'^(corregir|nombre)\s+', '', texto.strip(), flags=re.IGNORECASE)
            pendientes[idx]["nombre"] = nuevo_nombre
            set_state(chat_id, {**state, "productos_pendientes": pendientes})
            return f"✏️ Corregido a *{nuevo_nombre}*. ¿Confirmas? (sí/no)"

        elif re.match(r'^\d+', t):
            pendientes[idx]["cantidad"] = float(re.search(r'[\d.]+', t).group())
            set_state(chat_id, {**state, "productos_pendientes": pendientes})
            return "✏️ Cantidad actualizada. ¿Confirmas este producto? (sí/no)"

        if idx >= len(pendientes):
            set_state(chat_id, {**state, "fase": "PROVEEDORES", "idx": idx,
                                "sub_fase": None, "proveedores_encontrados": []})
            return (
                f"🎉 ¡Listo! {idx} productos guardados.\n\n"
                "Ahora los proveedores. ¿Ya tienes a quién le compras?\n\n"
                "  *sí* → dime sus datos\n"
                "  *no* → Aldo los busca por ti en internet\n\n"
                "¿Tienes proveedores?"
            )

        set_state(chat_id, {**state, "productos_pendientes": pendientes,
                            "idx": idx, "sub_fase": None})
        return _preguntar_producto(pendientes, idx)

    # ── PROVEEDORES ──────────────────────────────────────────────────────────
    if fase == "PROVEEDORES":
        state = get_state(chat_id)
        t = texto.strip().lower() if texto else ""

        # Cliente dice que no tiene → Aldo busca
        if t in ("no", "n", "ninguno", "no tengo", "no sé", "no se"):
            ciudad = state.get("ciudad", "")
            if not ciudad:
                set_state(chat_id, {**state, "fase": "PROVEEDORES_CIUDAD"})
                return "¿En qué ciudad está tu salón? Aldo busca proveedores cerca de ti."
            return _buscar_proveedores_web(chat_id, state, ciudad, db_path)

        # Admin seleccionó proveedores → ya hay lista y manda números


        # Admin selecciona proveedores de la lista encontrada: "1 3" o "1"
        provs_encontrados = state.get("proveedores_encontrados", [])
        if provs_encontrados and re.match(r'^[\d\s]+$', t):
            nums = [int(x) - 1 for x in t.split() if x.isdigit()]
            from host_engine.products.salon_almacen.agents.aldo_scout import guardar_proveedores_seleccionados
            msg = guardar_proveedores_seleccionados(provs_encontrados, nums, db_path)
            set_state(chat_id, {**state, "fase": "PROV_MANUAL", "proveedores_encontrados": []})
            return msg + "\n\n¿Quieres agregar algún proveedor manualmente? Escribe sus datos o *listo*."

        if t in ("ninguno", "no", "listo", "ya"):
            set_state(chat_id, {**state, "fase": "ROLES"})
            return _preguntar_roles()

        # Cliente dice que sí tiene → pedirle los datos
        if t in ("si", "sí", "yes", "s"):
            set_state(chat_id, {**state, "fase": "PROV_MANUAL"})
            return (
                "📋 Manda los datos de tu proveedor:\n\n"
                "_Formato (lo que tengas):_\n"
                "Nombre: Belleza Dist\n"
                "WhatsApp: 5512345678\n"
                "Email: pedidos@belleza.com\n"
                "Web: bellezadist.com\n\n"
                "Cuando termines de agregar todos, escribe *listo*."
            )

        return "¿Tienes proveedores? Responde *sí* o *no*."

    # ── PROVEEDORES_CIUDAD ────────────────────────────────────────────────────
    if fase == "PROVEEDORES_CIUDAD":
        ciudad = texto.strip().title() if texto else "Ciudad de México"
        state = get_state(chat_id)
        state["ciudad"] = ciudad
        _guardar_config_campo("ciudad_salon", ciudad)
        return _buscar_proveedores_web(chat_id, state, ciudad, db_path)

    # ── PROV_MANUAL ───────────────────────────────────────────────────────────
    if fase == "PROV_MANUAL":
        state = get_state(chat_id)
        t = texto.strip().lower() if texto else ""

        if t in ("listo", "ya", "no hay más", "es todo"):
            set_state(chat_id, {**state, "fase": "ROLES"})
            return _preguntar_roles()

        # Parsear datos del proveedor desde texto libre
        prov = _parsear_proveedor(texto or "")
        if prov:
            _guardar_proveedor_manual(prov, db_path)
            return (
                f"✅ *{prov['nombre']}* registrado.\n"
                f"  📱 WA: {prov.get('whatsapp') or '—'}\n"
                f"  📧 Email: {prov.get('email') or '—'}\n\n"
                "¿Hay otro proveedor? Manda sus datos o escribe *listo*."
            )
        return "No entendí los datos. Usa el formato:\nNombre: ...\nWhatsApp: ...\nEmail: ...\nO escribe *listo*."

    # ── ROLES ────────────────────────────────────────────────────────────────
    if fase == "ROLES":
        if texto.strip().lower() in ("listo", "ya", "no hay", "ninguno", "solo yo"):
            set_state(chat_id, {**state, "fase": "HISTORIAL"})
            return _preguntar_historial()

        lineas = texto.strip().split("\n")
        agregados = []
        for linea in lineas:
            partes = linea.strip().split()
            nums = [p for p in partes if re.match(r'^\d{6,}$', p)]
            if nums:
                uid = nums[0]
                _agregar_rol(uid, "estilista")
                nombre = " ".join([p for p in partes if not re.match(r'^\d', p)]) or "Estilista"
                agregados.append(f"  • {nombre.title()} ({uid}) → estilista")

        if not agregados:
            return "No reconocí números de Telegram. Manda el número de 9+ dígitos. O escribe *listo*."

        return (
            "✅ Registradas:\n" + "\n".join(agregados) + "\n\n"
            "¿Hay más estilistas? Manda más números o escribe *listo*."
        )

    # ── HISTORIAL ────────────────────────────────────────────────────────────
    if fase == "HISTORIAL":
        t = (texto or "").strip().lower()

        if t in ("listo", "ya", "no", "n", "omitir", "saltar", "no tengo"):
            _finalizar(chat_id)
            return _mensaje_final(get_state(chat_id).get("salon", "tu salón"))

        # Foto → leer registros históricos
        if image_path:
            n = _ingest_historial_inline(image_path, db_path)
            return (
                f"✅ Leí *{n}* registros históricos de la foto.\n"
                "Manda más fotos, texto, o escribe *listo* para terminar."
            )

        # Texto: puede ser datos inline o una ruta de archivo
        if texto and len(texto.strip()) > 10:
            n = _ingest_historial_inline(texto.strip(), db_path)
            return (
                f"✅ Importé *{n}* registros históricos.\n"
                "Manda más datos o escribe *listo* para terminar."
            )

        return _preguntar_historial()

    return "Estado desconocido. Escribe /start para reiniciar."


# ── Helpers de proveedores ────────────────────────────────────────────────────

def _buscar_proveedores_web(chat_id: str, state: dict, ciudad: str, db_path=None) -> str:  # noqa: ARG001
    from host_engine.products.salon_almacen.agents.aldo_scout import buscar_proveedores, formatear_propuesta
    set_state(chat_id, {**state, "fase": "PROVEEDORES", "ciudad": ciudad})
    proveedores = buscar_proveedores(ciudad)
    set_state(chat_id, {**get_state(chat_id), "proveedores_encontrados": proveedores})
    propuesta = formatear_propuesta(proveedores)
    return f"🔍 Aldo buscó proveedores en *{ciudad}*:\n\n{propuesta}"


def _parsear_proveedor(texto: str) -> dict | None:
    nombre_m = re.search(r'nombre[:\s]+([\w\s\-\.]+)', texto, re.IGNORECASE)
    wa_m      = re.search(r'(?:whatsapp|wa|celular)[:\s]+([\d\s\-\+]+)', texto, re.IGNORECASE)
    email_m   = re.search(r'[\w\.\-]+@[\w\.\-]+\.\w+', texto)
    tel_m     = re.search(r'(?:tel[éeé]fono?|tel)[:\s]+([\d\s\-\+]+)', texto, re.IGNORECASE)
    web_m     = re.search(r'(?:web|sitio)[:\s]+([\w\.\-\/\:]+)', texto, re.IGNORECASE)

    if not nombre_m:
        return None

    return {
        "nombre":   nombre_m.group(1).strip().title(),
        "whatsapp": re.sub(r'\D', '', wa_m.group(1)) if wa_m else "",
        "email":    email_m.group(0) if email_m else "",
        "telefono": re.sub(r'\D', '', tel_m.group(1)) if tel_m else "",
        "sitio_web": web_m.group(1).strip() if web_m else "",
    }


def _guardar_proveedor_manual(prov: dict, db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    existente = db.get_proveedor(prov["nombre"].lower())
    if not existente:
        db.registrar_proveedor(
            name=prov["nombre"],
            whatsapp=prov.get("whatsapp", ""),
            email=prov.get("email", ""),
            telefono=prov.get("telefono", ""),
            sitio_web=prov.get("sitio_web", ""),
        )


def _guardar_config_campo(campo: str, valor: str):
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    config[campo] = valor
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def _preguntar_roles() -> str:
    return (
        "👥 Casi listo. ¿Quiénes van a usar el sistema?\n"
        "Manda los números de Telegram de tus estilistas, uno por línea:\n\n"
        "_Ejemplo:_\n"
        "Lupita 5512345678\n"
        "Carmen 5598765432\n\n"
        "O escribe *listo* si solo lo usas tú."
    )


def _preguntar_min(prod: dict) -> str:
    return (
        f"✅ *{prod.get('nombre')}* confirmado.\n\n"
        "¿Cuántos necesitas tener *mínimo* antes de pedir más?\n"
        "_Ejemplo: 3 (o escribe **no sé** para omitir)_\n\n"
        "Tip: puedes escribir *mín/máx* (ej: `3/10`)"
    )


def _preguntar_producto(pendientes: list, idx: int) -> str:
    if idx >= len(pendientes):
        return "✅ Todos los productos revisados."
    prod = pendientes[idx]
    total = len(pendientes)
    return (
        f"*Producto {idx+1}/{total}:*\n"
        f"  📦 *{prod.get('nombre', '?')}*\n"
        f"  Cantidad: {prod.get('cantidad', 0)} {prod.get('unidad', 'pza')}\n"
        f"  Costo: ${prod.get('costo', 0):.2f}\n\n"
        "¿Confirmas? Responde:\n"
        "  *sí* → guardar\n"
        "  *no* → saltar\n"
        "  *nombre [corrección]* → corregir nombre\n"
        "  *[número]* → corregir cantidad"
    )


def _preguntar_historial() -> str:
    return (
        "📅 *¿Tienes datos de meses anteriores?*\n\n"
        "Si me mandas tu historial, Isabel puede predecir cuándo se va a acabar cada producto "
        "desde el primer día.\n\n"
        "Puedes mandar:\n"
        "  📊 Excel/CSV con columnas _fecha, producto, cantidad_\n"
        "  📸 Foto de tu cuaderno o hoja de registro\n"
        "  📝 Texto libre: _\"en enero usé 200ml de tinte rubio\"_\n\n"
        "O escribe *listo* para omitir."
    )


def _ingest_historial_inline(fuente: str, db_path: str = None) -> int:
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    from host_engine.products.salon_almacen.ingest import ingest_historial
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return ingest_historial(fuente, db)


def _finalizar(chat_id: str):
    state = get_state(chat_id)
    set_state(chat_id, {**state, "fase": "COMPLETO"})


def _mensaje_final(salon: str) -> str:
    return (
        f"🎊 *{salon}* está lista.\n\n"
        "Desde ahora:\n"
        "  📸 Manda foto del producto que usaste → Donna lo descuenta\n"
        "  ✍️ Escribe _usé 2 tubos de tinte_ → mismo efecto\n"
        "  📋 Escribe _qué está bajo_ → alerta de stock\n"
        "  🛒 Escribe _lista de pedido_ → lo que hay que comprar\n\n"
        "_Admin puede ver reportes y registrar entradas._\n\n"
        "¡Listo! Ya no necesitas hacer nada más. 💪"
    )
