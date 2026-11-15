"""
angelica.py — Recetas y Costeos del Salón.

Angélica es la formulista. Conoce cada receta de memoria,
sabe qué productos van en cada servicio y cuánto cuesta.

Flujo estilista:
  "hice una keratina" → Angélica detecta → busca receta → dice a Enzo qué descontar

Flujo cotización:
  "cuánto cuesta un tinte" → Angélica calcula ingredientes + costo → precio sugerido

Angélica habla con Enzo. Nunca toca el almacén directamente.
"""
import logging
import re

logger = logging.getLogger("Angelica")

_PERSONALIDAD = (
    "Soy Angélica. Conozco cada receta de memoria. "
    "Cuando me dices qué servicio hiciste, yo sé exactamente qué va y en qué cantidad. "
    "Le digo a Enzo lo que descuenta. Los números no los invento — los tengo escritos."
)

_PROMPT_DETECTAR = """Detecta si este mensaje menciona un servicio de salón de belleza.
Responde SOLO con JSON:
{"es_servicio": true/false, "servicio": "nombre", "es_cotizacion": true/false, "cliente": "nombre o null"}
es_cotizacion=true si preguntan precio ("quiero", "cuánto cuesta", "precio de", "cuánto cobra").
es_cotizacion=false si reportan que ya hicieron el servicio ("hice", "apliqué", "terminé", "le puse").
cliente: nombre de la clienta si se menciona ("para la señora Martínez", "a Lupita"), null si no.
Servicios típicos: keratina, tinte, coloración, decoloración, corte, baño de color, alisado, tratamiento.
Mensaje: """

_PROMPT_FORMULA_VISION = """Eres Angélica, formulista experta en colorimetría.
Analiza esta imagen: puede ser una fórmula escrita a mano, una nota, productos mezclados, o una receta.
Lee los ingredientes y cantidades que aparecen.
Notación común: "7.1" = tinte tono 7.1, "20vol" = oxidante 20 volúmenes, "1:2" = proporción mezcla.
Responde SOLO con JSON:
{
  "es_formula": true/false,
  "servicio_detectado": "keratina|tinte|decoloración|tratamiento|otro|null",
  "ingredientes": [
    {"nombre": "descripcion del ingrediente", "cantidad": N_o_null, "unidad": "ml|g|pza|null", "nota": "ej: tono 7.1, 20vol"}
  ],
  "notas_adicionales": "instrucciones o notas visibles"
}
Si la imagen no es una fórmula (es una foto de producto), pon es_formula: false."""

_PROMPT_CREAR = """Eres Angélica, formulista de un salón de belleza.
El admin quiere registrar una receta de servicio.
Extrae nombre del servicio y productos con cantidades.
Responde SOLO con JSON:
{
  "nombre": "nombre del servicio",
  "productos": [{"nombre": "...", "cantidad": N, "unidad": "ml|g|pza|tubo|sobre"}],
  "precio_sugerido": N_o_0
}
Mensaje del admin: """


def _db(db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


# ── Detección ─────────────────────────────────────────────────────────────────

def leer_formula_foto(image_path: str) -> dict:
    """
    Vision LLM lee una foto de fórmula manuscrita.
    Retorna {"es_formula": bool, "servicio_detectado": str, "ingredientes": [...], "notas": str}
    """
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_vision
        import json
        raw = ask_llm_vision(_PROMPT_FORMULA_VISION, image_path)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return data
    except Exception as e:
        logger.error(f"[Angélica] leer_formula_foto falló: {e}")
    return {"es_formula": False, "ingredientes": []}


def foto_formula_a_servicio(image_path: str, nombre_cliente: str,
                             estilista_id: str, config: dict,
                             db_path=None) -> str:
    """
    Flujo completo: foto de fórmula manuscrita → leer → matchear inventario
    → calcular costo → descontar vía Enzo → guardar en Valentina.
    """
    from host_engine.products.salon_almacen.agents.enzo import registrar_uso
    from host_engine.products.salon_almacen.agents import valentina as _valentina

    moneda = config.get("moneda", "$")

    # 1. Leer fórmula de la foto
    lectura = leer_formula_foto(image_path)
    if not lectura.get("es_formula") or not lectura.get("ingredientes"):
        return (
            "🤔 No pude leer una fórmula en esa imagen.\n"
            "Asegúrate de que la foto muestre la fórmula escrita claramente.\n"
            "O escríbela: _keratina para [nombre]: 200ml keratina, 80ml oxidante_"
        )

    ingredientes_raw = lectura.get("ingredientes", [])
    servicio         = lectura.get("servicio_detectado") or "servicio"
    notas_foto       = lectura.get("notas_adicionales", "")

    # 2. Matchear cada ingrediente con productos del inventario
    db = _db(db_path)
    todos_productos = db.listar_productos()
    items_confirmados = []
    no_matcheados = []
    costo_total = 0.0

    for ing in ingredientes_raw:
        nombre_ing = ing.get("nombre", "")
        cantidad   = float(ing.get("cantidad") or 0)
        unidad     = ing.get("unidad") or "u"
        nota_ing   = ing.get("nota", "")

        # Fuzzy match
        prod = None
        nombre_lower = nombre_ing.lower()
        for p in todos_productos:
            if nombre_lower in p["name"].lower() or p["name"].lower() in nombre_lower:
                prod = p
                break

        if prod:
            margen = db.get_margen_producto(prod["id"])
            costo_u = margen.get("costo_total", 0.0)
            subtotal = costo_u * cantidad if cantidad else 0.0
            costo_total += subtotal
            items_confirmados.append({
                "part_id":  prod["id"],
                "nombre":   prod["name"],
                "cantidad": cantidad,
                "unidad":   unidad,
                "nota":     nota_ing,
                "subtotal": round(subtotal, 2),
            })
        else:
            no_matcheados.append(f"{nombre_ing} ({nota_ing})" if nota_ing else nombre_ing)

    if not items_confirmados:
        return (
            f"⚠️ Leí la fórmula pero ningún ingrediente coincide con el inventario.\n"
            f"Leído: {', '.join([i.get('nombre','?') for i in ingredientes_raw])}\n"
            f"¿Están registrados esos productos?"
        )

    # 3. Calcular precio sugerido
    precio_s = round(costo_total / 0.60) if costo_total > 0 else 0  # 40% margen

    # 4. Mostrar resumen y pedir confirmación
    cliente_obj = _valentina.buscar_cliente(nombre_cliente, db_path) if nombre_cliente else None
    cliente_str = f" para *{cliente_obj['nombre']}*" if cliente_obj else (f" para *{nombre_cliente}*" if nombre_cliente else "")

    rol = config.get("roles", {}).get(str(estilista_id), "estilista")
    ver_precios = rol in ("admin", "duena")

    lines = [f"📋 *Angélica leyó fórmula{cliente_str}:*\n"]
    for it in items_confirmados:
        cant_str = f"{it['cantidad']:.0f} {it['unidad']}" if it["cantidad"] else it["unidad"]
        nota_str = f" _{it['nota']}_" if it.get("nota") else ""
        # Estilista: solo ingredientes y cantidades, sin costos
        costo_str = f" · {moneda}{it['subtotal']:.2f}" if (it["subtotal"] and ver_precios) else ""
        lines.append(f"  • {cant_str} *{it['nombre']}*{nota_str}{costo_str}")

    if no_matcheados:
        lines.append(f"\n⚠️ No encontré en inventario: {', '.join(no_matcheados)}")

    if ver_precios:
        lines.append(f"\n💰 Costo insumos: *{moneda}{costo_total:.2f}*")
        if precio_s:
            lines.append(f"💇 Precio sugerido (40% margen): *{moneda}{precio_s:.0f}*")
    if notas_foto:
        lines.append(f"\n📝 _{notas_foto}_")

    lines.append("\n¿Confirmas y descuento del inventario? ✅ /si  ❌ /no")

    # Guardar pending para confirmación
    # Retornamos el dict en banda lateral — bot lo captura
    _pending_formula[estilista_id] = {
        "tipo": "formula",
        "items": items_confirmados,
        "servicio": servicio,
        "nombre_cliente": nombre_cliente,
        "cliente_obj": cliente_obj,
        "notas": notas_foto,
    }

    return "\n".join(lines)


# Estado pendiente de fórmulas (por estilista_id hasta confirmación)
_pending_formula: dict = {}


def confirmar_formula(estilista_id: str, db_path=None) -> str:
    """
    Usuario dijo /si después de leer fórmula.
    Enzo descuenta, Valentina guarda fórmula del cliente.
    """
    from host_engine.products.salon_almacen.agents.enzo import registrar_uso
    from host_engine.products.salon_almacen.agents import valentina as _valentina

    pending = _pending_formula.pop(estilista_id, None)
    if not pending:
        return ""  # no había pending de fórmula

    servicio       = pending["servicio"]
    nombre_cliente = pending.get("nombre_cliente")
    cliente_obj    = pending.get("cliente_obj")
    items          = pending["items"]
    notas          = pending.get("notas", "")

    resultados = []
    errores = []

    for item in items:
        if not item["cantidad"]:
            continue
        nota = f"Servicio: {servicio} — estilista {estilista_id}"
        if cliente_obj:
            nota += f" — {cliente_obj['nombre']}"
        if notas:
            nota += f" | {notas}"
        result = registrar_uso(item["part_id"], item["cantidad"], nota=nota, db_path=db_path)
        if result["ok"]:
            badge = " ⚠️" if result.get("bajo_minimo") else ""
            resultados.append(f"  ✅ -{item['cantidad']:.0f} {item['unidad']} {item['nombre']}{badge}")
        else:
            errores.append(f"  ⚠️ Sin stock: {item['nombre']}")

    # Valentina guarda fórmula si hay clienta
    if nombre_cliente:
        formula_para_guardar = [
            {"part_id": i["part_id"], "nombre": i["nombre"],
             "cantidad": i["cantidad"], "unidad": i["unidad"]}
            for i in items if i["cantidad"]
        ]
        if not cliente_obj:
            cliente_obj = _valentina.get_o_crear(nombre_cliente, db_path=db_path)
        _valentina.registrar_visita(cliente_obj["id"], servicio, formula_para_guardar, db_path)
        logger.info(f"[Angélica] Fórmula guardada en Valentina: {cliente_obj['nombre']} — {servicio}")

    cliente_str = f" de *{cliente_obj['nombre']}*" if cliente_obj else ""
    lines = [f"✅ *{servicio}*{cliente_str} descontado:\n"] + resultados
    if errores:
        lines += [""] + errores
    if nombre_cliente and cliente_obj:
        lines.append(f"\n🗂️ _Valentina guardó la fórmula para la próxima visita._")
    return "\n".join(lines)


def detectar(texto: str) -> dict:
    """
    Retorna {"es_servicio": bool, "servicio": str, "es_cotizacion": bool}
    es_cotizacion=True → quieren precio.
    es_cotizacion=False → reportan servicio realizado.
    """
    try:
        from host_engine.cerberus_core.llm_router import ask_llm_lite
        import json
        raw = ask_llm_lite(_PROMPT_DETECTAR + texto)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.warning(f"[Angélica] detectar falló: {e}")
    return {"es_servicio": False, "servicio": "", "es_cotizacion": False}


# ── Aplicar receta → Enzo descuenta ──────────────────────────────────────────

def interpretar_y_aplicar(texto: str, estilista_id: str, db_path=None) -> str:
    """
    Estilista reportó un servicio.
    Angélica detecta servicio + clienta → aplica fórmula correcta → Enzo descuenta.
    """
    det = detectar(texto)
    if not det.get("es_servicio"):
        return ""  # no es un servicio — Donna decide qué hacer

    nombre_cliente = det.get("cliente") or None
    return aplicar_servicio(det["servicio"], estilista_id, nombre_cliente, db_path)


def aplicar_servicio(nombre_servicio: str, estilista_id: str,
                     nombre_cliente: str = None, db_path=None) -> str:
    """
    Busca receta (o fórmula personal si hay clienta) → Enzo descuenta.
    nombre_cliente: si viene del mensaje, Valentina busca su fórmula primero.
    """
    from host_engine.products.salon_almacen.agents.enzo import registrar_uso
    from host_engine.products.salon_almacen.agents import valentina as _valentina

    db = _db(db_path)

    # Valentina consulta primero si hay clienta
    cliente_info  = None
    items_a_usar  = None
    formula_propia = False

    if nombre_cliente:
        resultado_v = _valentina.consultar_formula(nombre_cliente, nombre_servicio, db_path)
        formula_propia = resultado_v["encontrada"]
        if formula_propia:
            items_a_usar = resultado_v["formula"]
            cliente_info = resultado_v["cliente"]
            logger.info(f"[Angélica] Usando fórmula de Valentina para {cliente_info['nombre']}")
        elif resultado_v["cliente"]:
            cliente_info = resultado_v["cliente"]

    # Sin fórmula personal → receta genérica del salón
    if not items_a_usar:
        receta = db.buscar_receta_fuzzy(nombre_servicio)
        if not receta:
            return (
                f"📋 No tengo receta para *{nombre_servicio}*.\n"
                f"Admin puede crearla: _nueva receta {nombre_servicio}: [cantidad] [producto]_"
            )
        items_a_usar = receta["items"]
        nombre_servicio = receta["nombre"]

    resultados = []
    errores = []

    for item in items_a_usar:
        part_id  = item.get("part_id")
        cantidad = float(item.get("cantidad", 1))

        if not part_id:
            prod = db.get_producto(item.get("nombre", ""))
            if prod:
                part_id = prod["id"]
            else:
                errores.append(f"⚠️ No encontré: {item.get('nombre')}")
                continue

        cliente_tag = f" — {cliente_info['nombre']}" if cliente_info else ""
        nota = f"Servicio: {nombre_servicio} — estilista {estilista_id}{cliente_tag}"
        result = registrar_uso(part_id, cantidad, nota=nota, db_path=db_path)

        if result["ok"]:
            prod = db.get_producto(str(part_id))
            nombre_p = prod["name"] if prod else f"ID:{part_id}"
            badge = " ⚠️" if result.get("bajo_minimo") else ""
            resultados.append(f"  ✅ -{cantidad:.0f} {item.get('unidad','u')} {nombre_p}{badge}")
        else:
            errores.append(f"  ⚠️ Sin stock: {item.get('nombre', part_id)}")

    # Valentina actualiza fecha de visita
    if cliente_info:
        _valentina.registrar_visita(cliente_info["id"], nombre_servicio, items_a_usar, db_path)

    cliente_str = f" ({cliente_info['nombre']})" if cliente_info else ""
    formula_str = " 🗂️" if formula_propia else ""
    lines = [f"💇 *{nombre_servicio}*{cliente_str}{formula_str} — ingredientes descontados:\n"] + resultados
    if errores:
        lines += [""] + errores
    if any("⚠️" in r for r in resultados):
        lines.append("\n_Aldo revisará el stock bajo mínimo._")

    # Clienta conocida pero sin fórmula → invitar a guardar
    if nombre_cliente and cliente_info and not formula_propia:
        lines.append(f"\n_¿Guardo esta fórmula para {cliente_info['nombre']}? Escribe: guardar fórmula_")

    return "\n".join(lines)


# ── Costeo ────────────────────────────────────────────────────────────────────

def costear(nombre_servicio: str, db_path=None) -> dict:
    """
    Calcula costo real de la receta con precios actuales.
    Retorna {"ok": bool, "nombre": str, "costo_total": float,
             "precio_sugerido": float, "items": [...]}
    """
    db = _db(db_path)
    receta = db.buscar_receta_fuzzy(nombre_servicio)
    if not receta:
        return {"ok": False, "costo_total": 0.0, "items": []}

    items_costeo = []
    costo_total = 0.0

    for item in receta["items"]:
        part_id  = item.get("part_id")
        cantidad = float(item.get("cantidad", 1))
        margen   = db.get_margen_producto(part_id) if part_id else {}
        costo_u  = margen.get("costo_total", 0.0)
        subtotal = costo_u * cantidad
        costo_total += subtotal
        items_costeo.append({
            "nombre":         item.get("nombre", margen.get("name", f"ID:{part_id}")),
            "cantidad":       cantidad,
            "unidad":         item.get("unidad", "u"),
            "costo_unitario": round(costo_u, 2),
            "subtotal":       round(subtotal, 2),
        })

    return {
        "ok":              True,
        "nombre":          receta["nombre"],
        "precio_sugerido": float(receta.get("precio_sugerido") or 0),
        "costo_total":     round(costo_total, 2),
        "items":           items_costeo,
    }


def cotizar(nombre_servicio: str, config: dict, db_path=None,
            user_id: str = None) -> str:
    """
    Cotización de servicio.
    Estilista: ingredientes + precio al cliente.
    Admin/dueña: además costo de insumos y margen.
    """
    moneda     = config.get("moneda", "$")
    rol        = config.get("roles", {}).get(str(user_id or ""), "estilista")
    ver_costos = rol in ("admin", "duena")
    costeo     = costear(nombre_servicio, db_path)

    if not costeo["ok"]:
        return (
            f"📋 No tengo receta para *{nombre_servicio}* aún.\n"
            f"Admin puede crearla: _nueva receta {nombre_servicio}: [productos]_"
        )

    precio_s       = costeo["precio_sugerido"]
    costo          = costeo["costo_total"]
    precio_display = precio_s if precio_s > 0 else (round(costo / 0.60) if costo > 0 else 0)

    lines = [f"💇 *Cotización — {costeo['nombre']}*\n", "Incluye:"]
    for i in costeo["items"]:
        lines.append(f"  • {i['cantidad']:.0f} {i['unidad']} de {i['nombre']}")

    if precio_display:
        lines.append(f"\n💰 *Precio al cliente: {moneda}{precio_display:.0f}*")
        if not precio_s:
            lines.append("_Precio estimado. Admin puede ajustar._")
    else:
        lines.append("\n_Admin aún no configuró precio._")

    if ver_costos and costo:
        margen = precio_display - costo if precio_display else 0
        margen_pct = (margen / precio_display * 100) if precio_display else 0
        lines.append(f"\n_Costo insumos: {moneda}{costo:.2f} · Margen: {margen_pct:.0f}%_")

    return "\n".join(lines)


# ── Gestión de recetas ────────────────────────────────────────────────────────

def crear(texto: str, db_path=None, moneda: str = "$") -> str:
    """Admin escribe: 'nueva receta keratina: 200ml keratina, 2 guantes, 1 toalla'"""
    try:
        from host_engine.cerberus_core.llm_router import ask_llm
        import json

        raw = ask_llm(_PROMPT_CREAR + texto, max_tokens=400)
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            return "⚠️ No pude entender la receta. Usa: _nueva receta [servicio]: [cantidad] [producto], ..._"

        data     = json.loads(m.group())
        nombre   = data.get("nombre", "").strip()
        prods_r  = data.get("productos", [])
        precio   = float(data.get("precio_sugerido") or 0)

        if not nombre or not prods_r:
            return "⚠️ Falta nombre o productos."

        db = _db(db_path)
        items = []
        no_encontrados = []

        for p in prods_r:
            prod = db.get_producto(p["nombre"])
            if not prod:
                todos = db.listar_productos()
                prod = next((x for x in todos if p["nombre"].lower() in x["name"].lower()), None)
            if prod:
                items.append({
                    "part_id":  prod["id"],
                    "nombre":   prod["name"],
                    "cantidad": float(p.get("cantidad", 1)),
                    "unidad":   p.get("unidad", prod["unit"]),
                })
            else:
                no_encontrados.append(p["nombre"])

        if not items:
            return f"⚠️ Ningún producto de la receta está en el inventario: {', '.join(no_encontrados)}"

        rid = db.guardar_receta(nombre, items, precio)
        lines = [f"✅ *Angélica registró receta '{nombre}'* (ID: {rid})\n"]
        for i in items:
            lines.append(f"  • {i['cantidad']:.0f} {i['unidad']} de {i['nombre']}")
        if no_encontrados:
            lines.append(f"\n⚠️ No encontré en inventario: {', '.join(no_encontrados)}")
        if precio:
            lines.append(f"\n💰 Precio sugerido: {moneda}{precio:.0f}")
        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[Angélica] crear falló: {e}")
        return f"⚠️ Error creando receta: {e}"


def listar(db_path=None, moneda: str = "$") -> str:
    db = _db(db_path)
    recetas = db.listar_recetas()
    if not recetas:
        return "📋 No hay recetas.\nAdmin: _nueva receta [servicio]: [productos]_"

    lines = ["📋 *Angélica — Recetas de servicio:*\n"]
    for r in recetas:
        c = costear(r["nombre"], db_path)
        precio_s = float(r.get("precio_sugerido") or 0)
        costo    = c["costo_total"] if c["ok"] else 0.0
        precio_str = f" · {moneda}{precio_s:.0f}" if precio_s else ""
        costo_str  = f" · costo {moneda}{costo:.2f}" if costo else ""
        lines.append(f"  • *{r['nombre']}* ({len(r['items'])} ingredientes{precio_str}{costo_str})")
    return "\n".join(lines)


def reporte_angelica(db_path=None) -> str:
    """Resumen rápido para Donna."""
    db = _db(db_path)
    recetas = db.listar_recetas()
    if not recetas:
        return "📋 Angélica: sin recetas configuradas aún."
    sin_precio = [r for r in recetas if not r.get("precio_sugerido")]
    lines = [f"📋 *Angélica:* {len(recetas)} recetas configuradas"]
    if sin_precio:
        lines.append(f"  ⚠️ Sin precio: {', '.join([r['nombre'] for r in sin_precio[:3]])}")
    return "\n".join(lines)
