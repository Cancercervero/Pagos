import json
import os
import re

# Palabras que indican que un cliente quiere agendar una cita
_CITA_KW = ["cita", "reunion", "reunión", "junta", "asesoría", "asesoria",
             "charla", "platicar", "hablar contigo", "vernos", "verlos",
             "cuando puedo", "disponibilidad", "agendar"]

# Palabras que indican que un cliente quiere una cotización
_COTIZ_KW = ["cotizacion", "cotización", "cotiza", "presupuesto", "cuanto cuesta",
             "cuánto cuesta", "precio de", "cuanto cobras", "cuánto cobras",
             "cuanto vale", "cuánto vale", "que me cobras", "qué me cobras",
             "cuanto me sale", "cuánto me sale", "precio del tier",
             "cuanto cuesta el tier", "cuánto cuesta el tier",
             "quiero contratar", "contratar cerberus", "contratar el servicio",
             "caas", "cerberus as a service"]

# ── PLAYBOOK CORPORATIVO (cargado una vez al importar el módulo) ──────────────
_PLAYBOOK: dict = {}
_PLAYBOOK_SUMMARY: str = ""
try:
    _pb_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cc_ia_playbook.json"
    )
    with open(os.path.abspath(_pb_path), "r", encoding="utf-8") as _f:
        _PLAYBOOK = json.load(_f)
    _pilares = "\n".join(
        f"  • {p['nombre']}: {p['guion_cliente']}"
        for p in _PLAYBOOK.get("pilares_de_servicio", [])
    )
    _catalogo = "\n".join(
        f"  • [{s['id']}] {s['nombre']} — Para: {s['para_quien']} — Guión: {s['guion_cliente']}"
        for s in _PLAYBOOK.get("catalogo_de_soluciones", [])
    )
    _reglas = "\n".join(
        f"  • {r['regla']}: {r['aplicacion']}"
        for r in _PLAYBOOK.get("reglas_de_comunicacion", [])
    )
    _speech = _PLAYBOOK.get("speech_simple", {})
    _speech_lines = "\n".join(
        f"  [{k}]: {v}" for k, v in _speech.items() if k != "descripcion"
    )
    _PLAYBOOK_SUMMARY = (
        f"EMPRESA: {_PLAYBOOK.get('empresa', 'Mi Negocio')}\n"
        f"PITCH: {_PLAYBOOK.get('elevator_pitch', '')}\n"
        f"MISIÓN: {_PLAYBOOK.get('mision', '')}\n"
        f"LIDERAZGO: {_PLAYBOOK.get('liderazgo', {}).get('filosofia', '')}\n"
        f"PILARES DE SERVICIO:\n{_pilares}\n"
        f"CATÁLOGO DE SOLUCIONES (ofrecer SOLO el relevante al problema del cliente, nunca todo de golpe):\n{_catalogo}\n"
        f"FRASES SIMPLES PARA VENDER (úsalas, no uses lenguaje técnico):\n{_speech_lines}\n"
        f"REGLAS DE COMUNICACIÓN:\n{_reglas}\n"
        f"PREGUNTA DIAGNÓSTICO MÁGICA: {_PLAYBOOK.get('pregunta_diagnostico_estrella', '')}"
    )
except Exception as _pb_err:
    _PLAYBOOK_SUMMARY = "Mi Negocio — Atención a clientes."


class AnnieAmbassador:
    """
    Cabeza 1 (C1): La Embajadora.
    Escucha, conoce a fondo a los clientes y los reconforta.
    Maneja la inteligencia CRM, métricas de negocio y Protocolo de Citas.
    """
    def __init__(self, llm_fn, vault=None):
        self.llm_ask = llm_fn
        self.vault = vault

    def _detect_appointment_intent(self, q: str) -> bool:
        """Detecta si un cliente externo está solicitando una cita/reunión."""
        return any(kw in q for kw in _CITA_KW)

    def escuchar(self, prompt, profile, context_summary="", source_id=None, shadow=None):
        """Procesa el mensaje del cliente con inteligencia CRM y Protocolo de Citas."""
        clean_prompt = prompt.strip()
        q_lower = clean_prompt.lower()

        # ── DETECCIÓN DE IDIOMA ──
        # Se hace aquí una vez y se reutiliza en todo el método.
        try:
            from cerberus_core.lingua_detector import detect_language, get_annie_phrase, get_sys_prompt_language_note
            # Pasamos think_lite como fallback solo si el fingerprint no es concluyente
            lang = detect_language(clean_prompt, fallback_llm=lambda p: self.llm_ask(p, source="LINGUA"))
        except Exception:
            lang = "es"
            def get_annie_phrase(_l, _k, _n=""): return ""  # noqa
            def get_sys_prompt_language_note(_l): return ""  # noqa

        # Guardar idioma detectado en el perfil para reportes
        profile["lang"] = lang

        # ── HISTORIAL DE CONVERSACIÓN (contexto de las últimas N interacciones) ──
        conv_history = ""
        if shadow and source_id:
            try:
                conv_history = shadow.get_conversation_history(source_id, n=5)
            except Exception:
                pass

        # ── PROTOCOLO DE COTIZACIÓN (Detección Prioritaria) ──
        if any(kw in q_lower for kw in _COTIZ_KW):
            cliente = profile.get("name", profile.get("username", ""))
            nombre_cliente = cliente or ""
            ack = get_annie_phrase(lang, "quote_ack", nombre_cliente)
            if not ack:
                ack = f"Sure{', ' + nombre_cliente if nombre_cliente else ''}! Give me a moment to prepare your quote."
            return {
                "respuesta_usuario": ack,
                "accion": "cotizacion",
                "prioridad": "Alta",
                "updated_profile": profile,
                "_cotizacion_query": clean_prompt,
            }

        # ── PROTOCOLO DE CITAS (Detección Prioritaria) ──
        if self._detect_appointment_intent(q_lower):
            try:
                from skills.google_services.calendar_skill import buscar_huecos_libres
                from cerberus_core.appointment_bridge import crear_ticket, generar_alerta_comandante

                cliente = profile.get("name", profile.get("username", "Cliente"))
                # Extraer asunto limpio — buscar patrón explícito primero
                m_nombre = re.search(
                    r'(?:que\s+se\s+llam[ea]|llamad[oa]|titulad[oa]|con\s+(?:el\s+)?nombre(?:\s+de)?)\s+["\']?(.+?)["\']?\s*$',
                    clean_prompt, flags=re.IGNORECASE
                )
                if m_nombre:
                    asunto = m_nombre.group(1).strip(" ,.!¡¿?\"'").title()
                else:
                    asunto_raw = re.sub(
                        r'\b(cita|reunion|reunión|junta|asesoría|asesoria|charla|quiero|quisiera|necesito|'
                        r'hola|por favor|appointment|meeting|schedule|'
                        r'un|una|el|la|para|que|se|llam[ea]|con|hoy|mañana|'
                        r'a\s+las?|las?\s+\d{1,2}|am|pm)\b',
                        "", clean_prompt, flags=re.IGNORECASE
                    ).strip(" ,.:!¡¿?-")
                    asunto_raw = re.sub(r'(?:^|\s)\d{1,2}(?:\s|$)', ' ', asunto_raw)
                    asunto_raw = re.sub(r'\s+', ' ', asunto_raw).strip()
                    asunto = asunto_raw[:80].title() if asunto_raw else "Reunion general"

                huecos = buscar_huecos_libres(
                    dias=5,
                    jornada_inicio=int(os.getenv("ANNIE_HORA_INICIO", 9)),
                    jornada_fin=int(os.getenv("ANNIE_HORA_FIN", 14))
                )

                if not huecos:
                    respuesta = get_annie_phrase(lang, "no_answer", cliente)
                    if not respuesta:
                        respuesta = "Let me check availability and get back to you shortly."
                    return {
                        "respuesta_usuario": respuesta,
                        "accion": "general",
                        "prioridad": "Media",
                        "updated_profile": profile
                    }

                ticket_id = crear_ticket(
                    cliente=cliente,
                    asunto=asunto,
                    source_id=source_id or profile.get("user_id", "desconocido"),
                    huecos=huecos
                )

                respuesta_cliente = (
                    f"¡Hola {cliente}! Revisé la agenda y tengo algunos huecos disponibles. "
                    f"En un momento te confirmo la fecha exacta, estoy coordinando con el Comandante."
                )
                return {
                    "respuesta_usuario": respuesta_cliente,
                    "accion": "CITA_PENDIENTE",
                    "ticket_id": ticket_id,
                    "prioridad": "Alta",
                    "updated_profile": profile
                }
            except Exception as exc:
                print(f"[ANNIE] Fallo en Protocolo de Citas: {exc}. Continuando flujo normal.")

        # 1. Obtener contexto de clientes/proveedores
        client_context = ""
        if self.vault:
            client_context = self.vault.search(clean_prompt)

        # 2. Preparar métricas del perfil para inyección
        metrics = {
            "is_new": profile.get("is_new", False),
            "total_spent": profile.get("total_spent", 0.0),
            "avg_ticket": profile.get("avg_ticket", 0.0),
            "order_count": profile.get("order_count", 0),
            "birthday": profile.get("birthday", "Desconocido"),
            "interests": profile.get("interests", "Sin registrar")
        }

        user_response = get_annie_phrase(lang, "fallback") or "Con gusto le atiendo en un momento."

        try:
            lang_note = get_sys_prompt_language_note(lang)
            cliente_nombre = profile.get("name", profile.get("username", ""))
            cliente_apellido = cliente_nombre.split()[-1] if cliente_nombre else ""

            # Bloque de reconocimiento según si es cliente nuevo o recurrente
            if metrics["is_new"]:
                reconocimiento = (
                    "El cliente es NUEVO. Preséntate con elegancia: "
                    "'Muy buenas [tardes/días], bienvenido a Mi Negocio. Mi nombre es Annie, "
                    "Recepcionista Ejecutiva. Es un placer atenderle. ¿Con quién tengo el gusto y en qué le puedo asistir?'"
                )
            else:
                hist_ref = ""
                if metrics["order_count"] > 0:
                    hist_ref = f"Ha realizado {metrics['order_count']} pedido(s) con nosotros"
                    if metrics["total_spent"] > 0:
                        hist_ref += f" por un total de ${metrics['total_spent']:.2f}"
                    hist_ref += "."
                intereses = metrics["interests"] if metrics["interests"] != "Sin registrar" else ""
                reconocimiento = (
                    f"El cliente es RECURRENTE. Su nombre: {cliente_nombre}. {hist_ref} "
                    f"{'Intereses previos: ' + intereses + '.' if intereses else ''} "
                    f"Salúdale por apellido de forma personalizada y cálida: "
                    f"'Muy buenas [tardes/días], {'Señor/Señora ' + cliente_apellido if cliente_apellido else 'estimado cliente'}. "
                    f"Es un placer saludarle de nuevo. ¿En qué le puedo asistir el día de hoy?'"
                )

            sys_msg = (
                "# BASE DE CONOCIMIENTO CORPORATIVO\n"
                f"{_PLAYBOOK_SUMMARY}\n\n"
                "# ROL Y PROPÓSITO\n"
                "Eres Annie, la Recepcionista Ejecutiva y Enlace de Relaciones Públicas de Mi Negocio. "
                "Eres la primera línea de contacto para clientes, prospectos y proveedores. "
                "Tu objetivo es representar a la empresa con formalidad absoluta, elegancia, cortesía impecable y eficiencia resolutiva. "
                "Eres experta en psicología de ventas, atención al cliente y perfilado de usuarios.\n\n"

                "# TONO Y PERSONALIDAD\n"
                "- Formal, educada, diplomática y sumamente profesional.\n"
                "- Cálida pero no coloquial. Usa SIEMPRE el trato de 'usted', 'Señor' o 'Señora'.\n"
                "- Perspicaz: lees entre líneas para entender qué busca realmente el cliente.\n"
                f"- {lang_note}\n\n"

                "# CONTEXTO DEL CLIENTE\n"
                f"{reconocimiento}\n"
                f"Pedidos: {metrics['order_count']} | Total gastado: ${metrics['total_spent']:.2f} | Intereses: {metrics['interests']}\n"
                + (f"Historial de conversación reciente:\n{conv_history}\n" if conv_history else "")
                + (f"Contexto de base de conocimiento:\n{client_context}\n" if client_context else "")
                + (f"Contexto del día:\n{context_summary}\n" if context_summary else "")
                + "\n"

                "# REGLAS DE OPERACIÓN\n\n"

                "## REGLA 1 — RECONOCIMIENTO Y PERSONALIZACIÓN\n"
                "Aplica el saludo indicado en CONTEXTO DEL CLIENTE según sea nuevo o recurrente.\n\n"

                "## REGLA 2 — EXTRACCIÓN DE DATOS (MODO ANALISTA)\n"
                "Durante la conversación identifica sutilmente (sin que el cliente lo note): "
                "nombre/empresa, intención principal, nivel de urgencia, tono emocional, intereses.\n\n"

                "## REGLA 3 — PROTOCOLO DONNA (ESCALAMIENTO DIPLOMÁTICO)\n"
                "Este protocolo es de ALTO NIVEL. Solo se activa en estos casos específicos:\n"
                "  a) El cliente o proveedor reporta un PROBLEMA GRAVE (conflicto, queja seria, incumplimiento, disputa de pago).\n"
                "  b) La pregunta es MUY TÉCNICA Y ESPECÍFICA (métricas exactas, datos contractuales, detalles de ingeniería, información confidencial de proyectos).\n"
                "  c) El cliente exige información que Annie genuinamente NO posee y que no debe inventar.\n"
                "Para conversación general, saludos, dudas simples, información básica de la empresa: Annie responde sola con accion='general'.\n"
                "Cuando SÍ aplique el protocolo:\n"
                "- NUNCA digas 'no sé' ni inventes información.\n"
                "- Usa esta frase diplomática exacta: 'Esa es una excelente pregunta, "
                f"{'Señor/Señora ' + cliente_apellido if cliente_apellido else 'estimado cliente'}. "
                "Para brindarle la información más precisa y detallada, permítame que nuestro equipo "
                "técnico especializado lo revise. En breve nos comunicaremos con la respuesta exacta.'\n"
                "- Usa accion='donna_protocol' y en donna_reason explica brevemente qué no puedes resolver.\n\n"

                "## REGLA 4 — CIERRE\n"
                "Asegúrate de que cada interacción termine con el cliente sintiéndose escuchado y valorado.\n\n"

                "# FORMATO DE RESPUESTA (JSON con comillas dobles, sin texto extra):\n"
                '{"respuesta": "...", "prioridad": "Alta|Media|Baja", '
                '"accion": "general|cotizacion|cita|donna_protocol|archivista", '
                '"categoria": "Nuevo Prospecto|Duda de Facturación|Soporte Técnico|Consulta de Proveedor|Pedido|Otro", '
                '"update_spent": 0.0, "update_interests": "", "donna_reason": ""}'
            )

            res_raw = self.llm_ask(clean_prompt, system=sys_msg, source="ANNIE_CRM")
            meta = {}
            try:
                match = re.search(r'(\{[^{}]*\})', res_raw, re.DOTALL)
                if match:
                    json_str = match.group(1)
                    try:
                        meta = json.loads(json_str)
                    except json.JSONDecodeError:
                        json_str2 = json_str.replace("'", '"')
                        try:
                            meta = json.loads(json_str2)
                        except json.JSONDecodeError:
                            meta = {"respuesta": res_raw, "accion": "archivista"}
                else:
                    meta = {"respuesta": res_raw, "accion": "archivista"}
            except Exception:
                meta = {"respuesta": res_raw, "accion": "archivista"}

            user_response = meta.get("respuesta", user_response)

            # 3. Actualización de métricas CRM
            if meta.get("update_spent", 0) > 0:
                profile["total_spent"] = profile.get("total_spent", 0.0) + meta["update_spent"]
                profile["order_count"] = profile.get("order_count", 0) + 1
                count = profile["order_count"]
                profile["avg_ticket"] = profile["total_spent"] / count if count > 0 else 0.0

            if meta.get("update_interests"):
                existing = (profile.get("interests") or "").strip(", ")
                new_interest = meta["update_interests"].strip(", ")
                profile["interests"] = f"{existing}, {new_interest}".strip(", ") if existing else new_interest

            return {
                "respuesta_usuario": user_response,
                "accion": meta.get("accion", "archivista"),
                "prioridad": meta.get("prioridad", "Media"),
                "categoria": meta.get("categoria", "Otro"),
                "donna_reason": meta.get("donna_reason", ""),
                "updated_profile": profile
            }

        except Exception as e:
            print(f"[⚠️ ANNIE ERROR] {e}")
            return {"respuesta_usuario": user_response, "accion": "archivista", "prioridad": "Media", "updated_profile": profile}
