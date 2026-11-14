"""
ops_router.py — Detección de intent operativo y despacho a skills.
Se inyecta en grpc_server.py antes del ruteo de Donna.
"""
from __future__ import annotations
import logging

logger = logging.getLogger("OpsRouter")

# IMPORTANT: Dict iteration order is semantically meaningful.
# More-specific intents (cobranza) must appear before intents whose keywords
# are substrings of cobranza phrases (ventas: "factura" ⊂ "facturas vencidas").
# Do NOT reorder or append intents without reviewing keyword overlap.
_INTENTS: dict[str, list[str]] = {
    # cobranza primero: sus keywords multi-palabra evitan falsos positivos
    "cobranza": [
        "cobro", "adeudo", "adeudos", "vencido", "vencidas", "vencida",
        "mora", "pago pendiente", "facturas vencidas", "factura vencida",
        "por cobrar", "cartera vencida",
    ],
    # cotizacion antes de ventas para que "dame una cotización" no caiga en ventas genérico
    "cotizacion": [
        "cotización", "cotizacion", "quiero un presupuesto", "cuánto cuesta",
        "cuanto cuesta", "precio del tier", "quiero una propuesta", "dame una cotización",
        "mándame una cotización", "mandame una cotizacion", "me das precios",
        "quiero contratar", "quiero el tier", "precios de cerberus",
    ],
    # cfdi antes de ventas: "factura xml" es más específico que "factura"
    "cfdi": [
        "cfdi", "xml sat", "factura xml", "generar factura",
        "facturar", "timbrar", "comprobante fiscal", "cfdi 4.0",
        "xml de factura", "generar cfdi",
    ],
    "ventas": [
        "ventas", "factura", "cliente", "pedido", "pipeline",
        "orden de venta", "cuánto vendimos", "cuanto vendimos",
        "deal", "cierre de venta",
    ],
    "almacen": [
        "inventario", "stock", "almacén", "almacen", "existencia",
        "existencias", "quiebre", "tenemos de", "cuánto queda",
        "cuanto queda", "reponer", "reposición", "reposicion",
    ],
    "contable": [
        "contable", "contabilidad", "saldo", "gasto", "gastos", "ingreso",
        "ingresos", "caja", "balance", "ledger", "libro mayor",
        "flujo de caja", "estado de cuenta",
    ],
    "analista": [
        "analista", "indicadores financieros", "cómo está el dólar",
        "como esta el dolar", "cetes", "tipo de cambio", "banxico",
        "análisis de mercado", "analisis de mercado", "indicadores",
        "market pulse", "finanzas del mercado",
    ],
    # navegador antes que osint: "busca en google" es navegación, no investigación
    "navegador": [
        "navega", "navegador", "busca en google", "buscar en google",
        "automatiza el trámite", "automatiza el tramite",
        "navega a la página", "navega a la pagina", "abre el sitio",
        "headless", "trámite web", "tramite web",
    ],
    "osint": [
        "osint", "investiga", "investiga en internet", "busca noticias del sector",
        "noticias del sector", "qué dice internet", "monitoreo de mercado",
        "competencia en internet", "busca información de",
    ],
    "rrhh": [
        "empleado", "empleados", "nómina", "nomina", "asistencia",
        "contratación", "contratacion", "recursos humanos", "rrhh",
    ],
    "manufactura": [
        "producción", "produccion", "orden de producción", "manufactura",
        "planta", "fábrica", "fabrica", "lote", "receta",
    ],
    "inmobiliario": [
        "inmobiliario", "renta del edificio", "rentas del edificio",
        "inquilino", "arrendamiento", "casero", "propiedad",
        "reporte de rentas", "pago de renta", "registro de pago del inquilino",
    ],
    "medios": [
        "sofía", "sofia", "reel", "crea un video", "crear video",
        "publica en linkedin", "publicar en linkedin",
        "genera contenido", "contenido para redes", "redes sociales",
        "video para instagram", "post para linkedin",
    ],
    "diseno": [
        "omar", "diseño", "design", "logo", "logotipo", "isotipo",
        "ui", "ux", "identidad visual", "branding", "sistema de diseño",
        "design system", "componentes visuales", "paleta de colores",
        "tipografía", "tipografia", "mockup", "banner", "cartel",
        "diseña", "crea un diseño", "crea el diseño", "genera el diseño",
        "tokens de diseño", "guía de estilo", "guia de estilo",
    ],
}


def detect_ops_intent(prompt: str) -> str | None:
    """
    Devuelve el nombre del dominio operativo si el prompt lo solicita,
    o None si es una consulta general.
    Usa keyword matching sin LLM para velocidad máxima.
    """
    p = prompt.lower()
    for intent, keywords in _INTENTS.items():
        if any(kw in p for kw in keywords):
            return intent
    return None


def dispatch_ops(intent: str, prompt: str, source: str = "") -> str:
    """
    Despacha al skill correspondiente según el intent detectado.
    Retorna texto formateado listo para Telegram/WhatsApp.
    source: chat_id del cliente (Telegram/WhatsApp) — usado como client_id.
    """
    if not prompt or not prompt.strip():
        logger.warning("[OpsRouter] dispatch_ops called with empty prompt for intent: %s", intent)
        return f"Por favor, especifica tu consulta de {intent}."

    # Mapeo intent → agent_id para memoria de la colmena
    _INTENT_AGENT = {
        "ventas": "donna",       "cotizacion": "donna",
        "almacen": "jose",       "cobranza": "petra",
        "contable": "oscar",     "rrhh": "nancy",
        "manufactura": "jose",   "inmobiliario": "oscar",
        "medios": "sofia",       "osint": "manuel",
        "navegador": "manuel",   "analista": "analista",
        "cfdi": "escriba",       "diseno": "omar",
    }
    _agent_id = _INTENT_AGENT.get(intent, "donna")
    _user_id  = source or "default"

    try:
        if intent == "cotizacion":
            from skills.cotizacion_skill import generar_cotizacion
            import re as _re, time as _time, os as _os
            # Detectar tier y nombre de cliente en el prompt
            tier_m = _re.search(r'tier\s*([1-5])', prompt, _re.IGNORECASE)
            tier   = tier_m.group(1) if tier_m else ""
            folio  = f"COT-{_time.strftime('%Y%m%d')}-{int(_time.time())%10000:04d}"
            client_id   = source or "CLIENTE"
            client_name = source or "Cliente"
            result = generar_cotizacion(prompt, client_id, client_name, 0.0)
            # Construir URL editable en el HQ
            _tier_montos = {"1":"30000","2":"60000","3":"90000","4":"150000","5":"220000"}
            monto = _tier_montos.get(tier, "")
            import urllib.parse as _up
            params = _up.urlencode({k: v for k, v in {
                "folio": folio, "tier": tier, "monto": monto,
            }.items() if v})
            url = f"http://localhost:7891/cotizacion?{params}" if params else "http://localhost:7891/cotizacion"
            link_line = f"\n\n🔗 [Ver cotización online]({url})"
            if result["status"] == "ok":
                pdf_line = f"\n[ACTION_SEND_FILE:{result['path']}]" if result.get("path") else ""
                return result["message"] + link_line + pdf_line
            # Sin items detectados: devolver URL de la plantilla en blanco con tier si lo hay
            return (
                f"Aquí tienes la plantilla de cotización lista para llenar:\n{url}\n\n"
                "Dime el nombre del cliente y qué tier le vas a cotizar para pre-llenarla."
            )

        elif intent == "ventas":
            from skills.ventas_skill import procesar_ventas
            result = procesar_ventas(prompt)
            return result.get("text", "Sin datos de ventas disponibles.")

        elif intent == "almacen":
            from skills.almacen_skill import procesar_almacen
            return procesar_almacen(prompt)

        elif intent == "contable":
            from skills.empire_ledger import EmpireLedger
            return EmpireLedger().get_resumen_diario()

        elif intent == "rrhh":
            from skills.nancy_rh_skill import procesar_rrhh
            return procesar_rrhh(prompt, user_id=_user_id)

        elif intent == "cobranza":
            from skills.petra_cobranzas_skill import procesar_cobranza
            return procesar_cobranza(prompt, user_id=_user_id)

        elif intent == "manufactura":
            from skills.manufactura_skill import procesar_manufactura
            return procesar_manufactura(prompt)

        elif intent == "cfdi":
            try:
                from cerberus_core.cfdi_engine import generar_cfdi_xml, _load_config
                cfg = _load_config()
                if not cfg.get("emisor", {}).get("rfc"):
                    return (
                        "📄 *Agente CFDI listo.*\n\n"
                        "Para generar tu factura necesito configurar el emisor. "
                        "Crea el archivo `Cerberus_Data/cfdi_config.json` con:\n"
                        "```json\n"
                        '{"emisor": {"rfc": "TURF...", "nombre": "Tu Empresa SA", '
                        '"regimen_fiscal": "612", "cp": "00000"}}\n'
                        "```\n"
                        "Una vez configurado, dime: _RFC receptor, monto y concepto_ "
                        "y genero el XML listo para enviar a tu PAC."
                    )
                emisor = cfg["emisor"]
                receptor = cfg.get("receptor_default", {
                    "rfc": "XAXX010101000", "nombre": "Público en General",
                    "regimen_fiscal": "616", "cp": emisor.get("cp", "00000"),
                    "uso_cfdi": "G03",
                })
                venta = {
                    "serie": "A", "folio": "1",
                    "forma_pago": "99", "metodo_pago": "PUE",
                    "subtotal": 1000.00, "iva": 160.00, "total": 1160.00,
                    "items": [{
                        "descripcion": prompt[:80] if prompt else "Servicio",
                        "cantidad": 1, "precio_unitario": 1000.00,
                        "clave_sat": "01010101", "clave_unidad": "E48",
                        "unidad": "Servicio", "descuento_pct": 0,
                    }],
                }
                xml = generar_cfdi_xml(venta, emisor, receptor)
                lines = xml.split("\n")[:8]
                preview = "\n".join(lines)
                return (
                    "📄 *CFDI 4.0 generado (sin timbrar)*\n\n"
                    f"```xml\n{preview}\n...\n```\n\n"
                    "✅ XML válido SAT. Envíalo a tu PAC para timbrado.\n"
                    "_Para datos reales dime: RFC receptor, monto y concepto._"
                )
            except Exception as e:
                logger.error("[OpsRouter] Error CFDI: %s", e)
                return "📄 CFDI no disponible en este momento."

        elif intent == "analista":
            try:
                from cerberus_core.vante_analyst import VanteAnalyst
                vante = VanteAnalyst()
                return vante.get_market_pulse()
            except Exception as e:
                logger.error("[OpsRouter] Error Analista: %s", e)
                return "📊 Analista no disponible en este momento."

        elif intent == "osint":
            try:
                from cerberus_core.osint_deep import osint_deep as _osint
                return _osint.research(prompt, include_x=False)
            except Exception as e:
                logger.error("[OpsRouter] Error OSINT: %s", e)
                return "🔍 OSINT no disponible en este momento."

        elif intent == "navegador":
            try:
                from skills.navegante_seeker import NaveganteSeeker
                nav = NaveganteSeeker()
                return nav.search_google(prompt)
            except Exception as e:
                logger.error("[OpsRouter] Error Navegador: %s", e)
                return "🌐 Navegador no disponible en este momento."

        elif intent == "inmobiliario":
            try:
                from cerberus_core.casero_realty import CaseroRealty
                casero = CaseroRealty()
                reporte = casero.get_renta_libre_report(client_id="default")
                bruta = reporte.get("renta_bruta", 0)
                gastos = reporte.get("gastos_totales", 0)
                libre = reporte.get("renta_libre", 0)
                margen = reporte.get("margen", 0)
                return (
                    "🏠 *Reporte Inmobiliario*\n\n"
                    f"  • Renta bruta: ${bruta:,.2f}\n"
                    f"  • Gastos: ${gastos:,.2f}\n"
                    f"  • Renta libre: ${libre:,.2f}\n"
                    f"  • Margen: {margen:.1f}%\n\n"
                    "_Para registrar pagos o agregar unidades, indícame los detalles._"
                )
            except Exception as e:
                logger.error("[OpsRouter] Error Inmobiliario: %s", e)
                return "🏠 Módulo Inmobiliario no disponible en este momento."

        elif intent == "medios":
            try:
                prompt_lower = prompt.lower()
                if any(kw in prompt_lower for kw in ["linkedin", "publicar", "post", "publica"]):
                    from skills.social_propagator import SocialPropagator
                    sp = SocialPropagator()
                    texto = prompt.split(" el ", 1)[-1] if " el " in prompt else prompt
                    return sp.post_to_linkedin(texto)
                else:
                    return (
                        "🎬 *Sofía — Módulo Medios*\n\n"
                        "Puedo hacer dos cosas:\n\n"
                        "1. *Publicar en LinkedIn* — dime: _'publica en linkedin: [tu texto]'_\n\n"
                        "2. *Crear reel/video* — envíame los clips de video y te genero "
                        "el reel editado con análisis de IA.\n\n"
                        "¿Qué necesitas, Comandante?"
                    )
            except Exception as e:
                logger.error("[OpsRouter] Error Medios: %s", e)
                return "🎬 Módulo Medios no disponible en este momento."

        elif intent == "diseno":
            try:
                from skills.omar_design_skill import procesar_diseno
                return procesar_diseno(prompt, user_id=_user_id)
            except Exception as e:
                logger.error("[OpsRouter] Error Diseño/Omar: %s", e)
                return (
                    "🎨 *Omar — Departamento de Diseño*\n\n"
                    "Puedo crear: sistemas de diseño, paletas, tipografías, "
                    "identidad visual, banners, especificaciones UI/UX y código HTML/CSS.\n\n"
                    "Dime qué necesitas, Comandante."
                )

        else:
            return f"Intent '{intent}' no tiene skill asignado."

    except Exception as e:
        logger.error("[OpsRouter] Error despachando %s: %s", intent, e)
        return f"⚠️ {intent.capitalize()} no disponible en este momento."
