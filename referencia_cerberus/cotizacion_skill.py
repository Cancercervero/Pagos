"""
COTIZACION SKILL — Generador de Cotizaciones Premium PDF (V2.0)
==================================================================
Annie detecta cuando un cliente pide una cotización. Este skill:
  1. Carga el catálogo de servicios (catalogo.json)
  2. Identifica qué servicios quiere el cliente
  3. Genera un PDF profesional con diseño Cerberus (reportlab)
  4. Guarda en Cerberus_Data/Reports/Cotizaciones/YYYY/MM/DD/
  5. Retorna [ACTION_SEND_FILE:path] para entrega vía Telegram/WhatsApp
  6. Registra el deal en deal_tracker

Uso desde grpc_server (arm "cotizacion"):
    from skills.cotizacion_skill import generar_cotizacion
    res = generar_cotizacion(query, client_id, client_name, profile)
"""
import os
import json
import time
import re
from datetime import datetime, timedelta

# ── Rutas ─────────────────────────────────────────────────────────────────
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_BIZ_DIR     = os.path.join(_ROOT, "Cerberus_Data", "Business")
_CATALOG_PATH = os.path.join(_BIZ_DIR, "catalogo.json")
_EMPRESA_PATH = os.path.join(_BIZ_DIR, "empresa_info.json")
_OUT_DIR_BASE = os.path.join(_ROOT, "Cerberus_Data", "Reports", "Cotizaciones")


def _load_json(path: str, default) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _match_services(query: str, catalogo: dict) -> list:
    """
    Devuelve lista de (servicio_dict, cantidad) que coinciden con el query.
    Detecta también cantidades: "3 logos", "dos videos", etc.
    """
    q = query.lower()
    num_words = {"un":1,"una":1,"uno":1,"dos":2,"tres":3,"cuatro":4,"cinco":5,
                 "seis":6,"siete":7,"ocho":8,"nueve":9,"diez":10}
    matched = []

    all_items = catalogo.get("servicios", []) + catalogo.get("paquetes", [])
    for item in all_items:
        if any(kw in q for kw in item.get("keywords", [])):
            # Detectar cantidad
            cantidad = 1
            for word, val in num_words.items():
                if word in q:
                    cantidad = val
                    break
            m = re.search(r'(\d+)\s+(?:' + '|'.join(item.get("keywords", [])) + r')', q)
            if m:
                cantidad = int(m.group(1))
            matched.append((item, cantidad))

    return matched


# ── PDF PREMIUM CON REPORTLAB (Diseño Cerberus) ──────────────────────────
def _build_premium_pdf(folio: str, client_name: str, items: list,
                       empresa: dict, output_path: str) -> str:
    """
    Genera un PDF de cotización con diseño premium usando reportlab.
    Estilo: fondo oscuro en header, acentos dorados, tipografía limpia.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, cm
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

    # ── PALETA CERBERUS ──
    OBSIDIAN   = HexColor("#0A0E14")
    HAIRLINE   = HexColor("#1F2937")
    STEEL      = HexColor("#4A5568")
    SILVER     = HexColor("#8A94A6")
    FROST      = HexColor("#E8ECF1")
    PURE       = HexColor("#FAFBFC")
    ION        = HexColor("#6FB5FF")
    ION_DEEP   = HexColor("#3A7FD6")
    AMBER      = HexColor("#F4A23C")
    WHITE      = HexColor("#FFFFFF")
    BLACK      = HexColor("#000000")

    iva_rate = empresa.get("iva", 0.16)
    moneda   = empresa.get("moneda", "MXN")
    now      = datetime.now()
    vigencia = now + timedelta(days=15)

    # Calcular totales
    subtotal = sum(i["cantidad"] * i["precio_unit"] for i in items)
    iva_monto = subtotal * iva_rate
    total = subtotal + iva_monto

    # Estilos
    s_title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22,
                             textColor=OBSIDIAN, leading=26, spaceAfter=4)
    s_subtitle = ParagraphStyle("subtitle", fontName="Helvetica", fontSize=9,
                                textColor=STEEL, leading=12, spaceAfter=2)
    s_eyebrow = ParagraphStyle("eyebrow", fontName="Helvetica-Bold", fontSize=8,
                               textColor=ION_DEEP, leading=10, spaceAfter=6,
                               spaceBefore=14)
    s_body = ParagraphStyle("body", fontName="Helvetica", fontSize=10,
                            textColor=STEEL, leading=14)
    s_small = ParagraphStyle("small", fontName="Helvetica", fontSize=8,
                             textColor=SILVER, leading=10)
    s_right = ParagraphStyle("right", fontName="Helvetica", fontSize=10,
                             textColor=STEEL, leading=14, alignment=TA_RIGHT)
    s_total_label = ParagraphStyle("tlabel", fontName="Helvetica-Bold", fontSize=12,
                                   textColor=OBSIDIAN, alignment=TA_RIGHT)
    s_total_val = ParagraphStyle("tval", fontName="Helvetica-Bold", fontSize=14,
                                 textColor=ION_DEEP, alignment=TA_RIGHT)
    s_header_cell = ParagraphStyle("hcell", fontName="Helvetica-Bold", fontSize=8,
                                   textColor=FROST, leading=10)
    s_cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=9,
                            textColor=OBSIDIAN, leading=12)
    s_cell_r = ParagraphStyle("cellr", fontName="Helvetica", fontSize=9,
                              textColor=OBSIDIAN, leading=12, alignment=TA_RIGHT)
    s_cell_desc = ParagraphStyle("celld", fontName="Helvetica", fontSize=7,
                                 textColor=SILVER, leading=9)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2.2*cm, rightMargin=2.2*cm,
        topMargin=1.5*cm, bottomMargin=2*cm,
    )

    story = []

    # ── HEADER BANNER (tabla oscura) ──
    empresa_nombre = empresa.get("nombre_comercial") or empresa.get("nombre_empresa", "Mi Negocio")
    banner_left = (
        f'<font color="#F4A23C" size="7">●</font>&nbsp;&nbsp;'
        f'<font color="#E8ECF1" size="13"><b>{empresa_nombre}</b></font><br/>'
        f'<font color="#8A94A6" size="7">{empresa.get("direccion", "")}</font><br/>'
        f'<font color="#8A94A6" size="7">{empresa.get("email_contacto", "")} · {empresa.get("telefono", "")}</font>'
    )
    banner_right = (
        f'<font color="#6FB5FF" size="9"><b>COTIZACIÓN</b></font><br/>'
        f'<font color="#8A94A6" size="7">FOLIO: {folio}</font><br/>'
        f'<font color="#8A94A6" size="7">FECHA: {now.strftime("%d/%m/%Y")}</font><br/>'
        f'<font color="#8A94A6" size="7">VIGENCIA: {vigencia.strftime("%d/%m/%Y")}</font>'
    )
    s_banner_l = ParagraphStyle("bl", fontName="Helvetica", fontSize=9, textColor=FROST, leading=13)
    s_banner_r = ParagraphStyle("br", fontName="Helvetica", fontSize=9, textColor=FROST, leading=13, alignment=TA_RIGHT)

    banner = Table(
        [[Paragraph(banner_left, s_banner_l), Paragraph(banner_right, s_banner_r)]],
        colWidths=["60%", "40%"],
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), OBSIDIAN),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (0, 0), 16),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 16),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(banner)
    story.append(Spacer(1, 18))

    # ── DATOS DEL CLIENTE ──
    story.append(Paragraph("· PREPARADO PARA", s_eyebrow))
    story.append(Paragraph(f"<b>{client_name}</b>", s_title))
    story.append(Spacer(1, 4))

    # ── LÍNEA DIVISORA ──
    divider = Table([[""]], colWidths=["100%"], rowHeights=[1])
    divider.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FROST),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 14))

    # ── TABLA DE SERVICIOS ──
    story.append(Paragraph("· DESGLOSE DE SERVICIOS", s_eyebrow))

    # Encabezados
    header_row = [
        Paragraph("#", s_header_cell),
        Paragraph("SERVICIO", s_header_cell),
        Paragraph("CANT.", s_header_cell),
        Paragraph(f"P. UNIT ({moneda})", ParagraphStyle("hr", fontName="Helvetica-Bold",
                  fontSize=8, textColor=FROST, leading=10, alignment=TA_RIGHT)),
        Paragraph(f"TOTAL ({moneda})", ParagraphStyle("hr2", fontName="Helvetica-Bold",
                  fontSize=8, textColor=FROST, leading=10, alignment=TA_RIGHT)),
    ]

    table_data = [header_row]
    for idx, item in enumerate(items, 1):
        total_item = item["cantidad"] * item["precio_unit"]
        nombre = item["descripcion"].split("—")[0].strip()
        detalle = item["descripcion"].split("—")[1].strip() if "—" in item["descripcion"] else ""
        desc_block = f"<b>{nombre}</b>"
        if detalle:
            desc_block += f"<br/><font color='#8A94A6' size='7'>{detalle[:60]}</font>"

        table_data.append([
            Paragraph(f"<font color='#3A7FD6'><b>{idx:02d}</b></font>", s_cell),
            Paragraph(desc_block, s_cell),
            Paragraph(str(item["cantidad"]), s_cell),
            Paragraph(f"${item['precio_unit']:,.0f}", s_cell_r),
            Paragraph(f"<b>${total_item:,.0f}</b>", s_cell_r),
        ])

    col_w = [30, 220, 40, 80, 80]
    svc_table = Table(table_data, colWidths=col_w, repeatRows=1)
    svc_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), OBSIDIAN),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        # Rows
        ("TOPPADDING", (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, FROST),
        ("LINEBELOW", (0, -1), (-1, -1), 1, HAIRLINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        # Alternate row shading
        *[("BACKGROUND", (0, i), (-1, i), HexColor("#F7F8FA"))
          for i in range(2, len(table_data), 2)],
    ]))
    story.append(svc_table)
    story.append(Spacer(1, 10))

    # ── TOTALES ──
    totals_data = [
        [Paragraph("Subtotal:", s_right), Paragraph(f"${subtotal:,.0f} {moneda}", s_right)],
        [Paragraph(f"IVA ({int(iva_rate*100)}%):", s_right), Paragraph(f"${iva_monto:,.0f} {moneda}", s_right)],
        [Paragraph("<b>TOTAL:</b>", s_total_label), Paragraph(f"<b>${total:,.0f} {moneda}</b>", s_total_val)],
    ]
    totals_table = Table(totals_data, colWidths=[120, 120])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, ION_DEEP),
    ]))
    # Alinear a la derecha con tabla wrapper
    totals_wrapper = Table([[Spacer(1, 1), totals_table]], colWidths=["55%", "45%"])
    story.append(totals_wrapper)
    story.append(Spacer(1, 20))

    # ── QUÉ INCLUYE + CONDICIONES ──
    incluye = [
        "✓ Instancia Cloud privada 24/7",
        "✓ Agentes configurados con tus datos",
        "✓ HQ Dashboard en tiempo real",
        "✓ Soporte directo",
        "✓ Mejoras continuas incluidas",
        "✓ Sin aguinaldo · sin IMSS · sin faltas",
    ]
    condiciones = [
        f"✓ Términos: {empresa.get('terminos_pago', '50% anticipo')}",
        f"✓ Entrega: {empresa.get('tiempo_entrega_default', '5-10 días')}",
        "✓ Moneda: MXN",
        "✓ Facturación CFDI 4.0",
        "✓ Duración mínima 3 meses",
        "✓ NDA mutuo obligatorio",
    ]

    s_check = ParagraphStyle("check", fontName="Helvetica", fontSize=8,
                             textColor=STEEL, leading=13)

    inc_block = [Paragraph("· QUÉ INCLUYE", s_eyebrow)]
    inc_block += [Paragraph(line, s_check) for line in incluye]

    cond_block = [Paragraph("· CONDICIONES", s_eyebrow)]
    cond_block += [Paragraph(line, s_check) for line in condiciones]

    two_col = Table([[inc_block, cond_block]], colWidths=["50%", "50%"])
    two_col.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(two_col)
    story.append(Spacer(1, 24))

    # ── FIRMAS ──
    story.append(divider)
    story.append(Spacer(1, 14))

    firma_prov = (
        f'<font size="7" color="#3A7FD6"><b>POR EL PROVEEDOR</b></font><br/><br/><br/><br/>'
        f'<font size="7" color="#8A94A6">_________________________________</font><br/>'
        f'<font size="10"><b>{empresa.get("responsable", "Responsable")}</b></font><br/>'
        f'<font size="7" color="#8A94A6">{empresa.get("nombre_comercial", "")}</font><br/>'
        f'<font size="7" color="#4A5568">{empresa.get("email_contacto", "")}</font>'
    )
    firma_cli = (
        f'<font size="7" color="#3A7FD6"><b>POR EL CLIENTE</b></font><br/><br/><br/><br/>'
        f'<font size="7" color="#8A94A6">_________________________________</font><br/>'
        f'<font size="10"><b>{client_name}</b></font><br/>'
        f'<font size="7" color="#8A94A6">[ CARGO / EMPRESA ]</font><br/>'
        f'<font size="7" color="#4A5568">[ correo · fecha ]</font>'
    )
    s_firma = ParagraphStyle("firma", fontName="Helvetica", fontSize=9, textColor=OBSIDIAN, leading=13)
    firmas = Table(
        [[Paragraph(firma_prov, s_firma), Paragraph(firma_cli, s_firma)]],
        colWidths=["50%", "50%"]
    )
    firmas.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(firmas)
    story.append(Spacer(1, 20))

    # ── PIE ──
    footer_text = (
        f'<font color="#8A94A6" size="7">'
        f'{empresa.get("email_contacto", "")} · {empresa_nombre} · CONFIDENCIAL · NDA APLICA'
        f'</font>'
    )
    s_footer = ParagraphStyle("footer", fontName="Helvetica", fontSize=7,
                              textColor=SILVER, alignment=TA_CENTER, leading=10)
    story.append(Paragraph(footer_text, s_footer))

    doc.build(story)
    return output_path


# ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────

def generar_cotizacion(query: str, client_id: str, client_name: str,
                       monto_override: float = 0.0) -> dict:
    """
    Genera la cotización completa en PDF premium.
    Retorna:
        {
          "status": "ok" | "sin_items" | "error",
          "message": str,          # texto para el cliente
          "path": str | None,      # ruta del PDF
          "deal_id": str | None,   # deal creado en el tracker
          "total": float,
        }
    """
    empresa  = _load_json(_EMPRESA_PATH, {})
    catalogo = _load_json(_CATALOG_PATH, {"servicios": [], "paquetes": []})

    matched = _match_services(query, catalogo)

    if not matched:
        return {
            "status": "sin_items",
            "message": (
                "No identifiqué qué servicios necesitas. "
                "¿Podrías ser más específico? Por ejemplo: 'quiero el tier 1 y el módulo OSINT'."
            ),
            "path": None,
            "deal_id": None,
            "total": 0.0,
        }

    # Construir partidas
    items = []
    for (svc, qty) in matched:
        items.append({
            "descripcion": svc["nombre"] + (f" — {svc['descripcion']}" if svc.get("descripcion") else ""),
            "cantidad":    qty,
            "precio_unit": svc["precio"],
        })

    # Calcular total para el deal
    iva_rate = empresa.get("iva", 0.16)
    subtotal = sum(i["cantidad"] * i["precio_unit"] for i in items)
    total    = subtotal * (1 + iva_rate)

    # Folio único
    folio = f"COT-{datetime.now().strftime('%Y%m%d')}-{int(time.time()) % 10000:04d}"

    # Ruta de salida
    now = datetime.now()
    out_dir  = os.path.join(_OUT_DIR_BASE, now.strftime("%Y"), now.strftime("%m"), now.strftime("%d"))
    out_path = os.path.join(out_dir, f"{folio}.pdf")

    try:
        _build_premium_pdf(folio, client_name, items, empresa, out_path)
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error generando el PDF: {e}",
            "path": None,
            "deal_id": None,
            "total": total,
        }

    # Registrar deal en tracker
    deal_id = None
    try:
        from cerberus_core.deal_tracker import crear_deal, set_cotizacion_path
        asunto = ", ".join(i["descripcion"].split("—")[0].strip() for i in items[:3])
        deal_id = crear_deal(client_id, client_name, asunto, monto=total)
        set_cotizacion_path(deal_id, out_path)
    except Exception:
        pass

    nombre_empresa = empresa.get("nombre_comercial") or empresa.get("nombre_empresa", "")
    servicios_lista = "\n".join(
        f"  • {i['descripcion'].split('—')[0].strip()} x{i['cantidad']} — ${i['cantidad']*i['precio_unit']:,.0f}"
        for i in items
    )
    moneda = empresa.get("moneda", "MXN")

    message = (
        f"¡Hola {client_name}! Aquí está tu cotización ({folio}):\n\n"
        f"{servicios_lista}\n\n"
        f"Subtotal: ${subtotal:,.0f} {moneda}\n"
        f"IVA ({int(iva_rate*100)}%): ${subtotal*iva_rate:,.0f} {moneda}\n"
        f"**Total: ${total:,.0f} {moneda}**\n\n"
        f"Términos de pago: {empresa.get('terminos_pago','')}\n"
        f"Tiempo de entrega: {empresa.get('tiempo_entrega_default','')}\n\n"
        f"Te adjunto el PDF con todos los detalles. ¿Tienes alguna pregunta?"
    )

    return {
        "status": "ok",
        "message": message,
        "path": out_path,
        "deal_id": deal_id,
        "total": total,
    }


def procesar_query(query: str, client_id: str = "UNKNOWN",
                   client_name: str = "Cliente") -> str:
    """Entry point compatible con el sistema de brazos de C3."""
    result = generar_cotizacion(query, client_id, client_name)
    if result["status"] == "ok" and result["path"]:
        return result["message"] + f"\n[ACTION_SEND_FILE:{result['path']}]"
    return result["message"]
