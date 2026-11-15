"""CFDI 4.0 en borrador. El timbrado está simulado: NullAdapter, sin PAC ni CSD."""

import json
import unicodedata
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from lxml import etree
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import archivos_dir, negocio, publico
from app.db import ahora_iso
from app.dinero import centavos_a_pesos

CFDI_NS = "http://www.sat.gob.mx/cfd/4"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
SCHEMA_LOCATION = "http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
LEYENDA = "BORRADOR – timbrado simulado (requiere PAC y CSD)"


class NullAdapter:
    def timbrar(self, xml: str) -> dict:
        return {"uuid": None, "xml_timbrado": xml, "fecha_timbrado": None, "estado": "borrador"}


def generar_para_cotizacion(conn, cot: dict) -> dict | None:
    ya = conn.execute("SELECT * FROM facturas WHERE cotizacion_id=?", (cot["id"],)).fetchone()
    if ya:
        return dict(ya)
    hubo_anticipo = conn.execute(
        "SELECT id FROM cobros WHERE cotizacion_id=? AND tipo='anticipo'",
        (cot["id"],),
    ).fetchone()
    venta = _venta(conn, cot, "PPD" if hubo_anticipo else "PUE")
    xml = generar_cfdi_xml(venta, venta["emisor"], venta["receptor"])
    timbrado = NullAdapter().timbrar(xml)
    pdf = generar_pdf(timbrado["xml_timbrado"])
    nombre = f"FAC-{venta['folio']}.pdf"
    (archivos_dir() / nombre).write_bytes(pdf)
    conn.execute(
        """INSERT INTO facturas (cotizacion_id, serie, folio, xml, pdf_path, estado, creado_en)
           VALUES (?, ?, ?, ?, ?, 'borrador', ?)""",
        (cot["id"], venta["serie"], venta["folio"], timbrado["xml_timbrado"], nombre, ahora_iso()),
    )
    return dict(conn.execute("SELECT * FROM facturas WHERE cotizacion_id=?", (cot["id"],)).fetchone())


def generar_cfdi_xml(venta: dict, emisor: dict, receptor: dict) -> str:
    nsmap = {None: CFDI_NS, "xsi": XSI_NS}
    comp = etree.Element(f"{{{CFDI_NS}}}Comprobante", nsmap=nsmap)
    comp.set(f"{{{XSI_NS}}}schemaLocation", SCHEMA_LOCATION)
    comp.set("Version", "4.0")
    comp.set("Serie", venta["serie"])
    comp.set("Folio", str(venta["folio"]))
    comp.set("Fecha", venta["fecha"])
    comp.set("FormaPago", "03")
    comp.set("SubTotal", f"{venta['subtotal']:.2f}")
    comp.set("Moneda", "MXN")
    comp.set("Total", f"{venta['total']:.2f}")
    comp.set("TipoDeComprobante", "I")
    comp.set("Exportacion", "01")
    comp.set("MetodoPago", venta["metodo_pago"])
    comp.set("LugarExpedicion", emisor["cp"])

    em = etree.SubElement(comp, f"{{{CFDI_NS}}}Emisor")
    em.set("Rfc", emisor["rfc"])
    em.set("Nombre", emisor["nombre"])
    em.set("RegimenFiscal", emisor["regimen_fiscal"])

    rec = etree.SubElement(comp, f"{{{CFDI_NS}}}Receptor")
    rec.set("Rfc", receptor["rfc"])
    rec.set("Nombre", receptor["nombre"])
    rec.set("DomicilioFiscalReceptor", receptor["cp"])
    rec.set("RegimenFiscalReceptor", receptor["regimen_fiscal"])
    rec.set("UsoCFDI", receptor["uso_cfdi"])

    conceptos = etree.SubElement(comp, f"{{{CFDI_NS}}}Conceptos")
    for item in venta["items"]:
        c = etree.SubElement(conceptos, f"{{{CFDI_NS}}}Concepto")
        c.set("ClaveProdServ", "01010101")
        c.set("Cantidad", f"{item['cantidad']:.4f}")
        c.set("ClaveUnidad", "E48")
        c.set("Unidad", "Servicio")
        c.set("Descripcion", item["descripcion"])
        c.set("ValorUnitario", f"{item['precio_unitario']:.2f}")
        c.set("Importe", f"{item['importe']:.2f}")
        c.set("ObjetoImp", "02")
        imp_c = etree.SubElement(c, f"{{{CFDI_NS}}}Impuestos")
        tras_c = etree.SubElement(imp_c, f"{{{CFDI_NS}}}Traslados")
        t = etree.SubElement(tras_c, f"{{{CFDI_NS}}}Traslado")
        t.set("Base", f"{item['importe']:.2f}")
        t.set("Impuesto", "002")
        t.set("TipoFactor", "Tasa")
        t.set("TasaOCuota", "0.160000")
        t.set("Importe", f"{item['iva']:.2f}")

    imp = etree.SubElement(comp, f"{{{CFDI_NS}}}Impuestos")
    imp.set("TotalImpuestosTrasladados", f"{venta['iva']:.2f}")
    tras = etree.SubElement(imp, f"{{{CFDI_NS}}}Traslados")
    tg = etree.SubElement(tras, f"{{{CFDI_NS}}}Traslado")
    tg.set("Base", f"{venta['subtotal']:.2f}")
    tg.set("Impuesto", "002")
    tg.set("TipoFactor", "Tasa")
    tg.set("TasaOCuota", "0.160000")
    tg.set("Importe", f"{venta['iva']:.2f}")
    return etree.tostring(comp, pretty_print=True, xml_declaration=True, encoding="UTF-8").decode()


def generar_pdf(xml: str) -> bytes:
    root = etree.fromstring(xml.encode() if isinstance(xml, str) else xml)
    ns = {"cfdi": CFDI_NS}
    emisor = root.find("cfdi:Emisor", ns)
    receptor = root.find("cfdi:Receptor", ns)
    conceptos = root.findall("cfdi:Conceptos/cfdi:Concepto", ns)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=0.7 * inch, leftMargin=0.7 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"<b>FACTURA {root.get('Serie', '')}{root.get('Folio', '')}</b>", styles["Title"]),
        Paragraph(f"<font color='red'><b>{LEYENDA}</b></font>", styles["Heading3"]),
        Paragraph(f"Fecha: {root.get('Fecha', '')} · Forma de pago 03 · {root.get('MetodoPago', '')}", styles["Normal"]),
        Spacer(1, 0.12 * inch),
    ]
    info = [
        ["EMISOR", "RECEPTOR"],
        [emisor.get("Nombre", "") if emisor is not None else "", receptor.get("Nombre", "") if receptor is not None else ""],
        [
            f"RFC: {emisor.get('Rfc', '') if emisor is not None else ''}",
            f"RFC: {receptor.get('Rfc', '') if receptor is not None else ''}",
        ],
    ]
    tabla_info = Table(info, colWidths=[3.5 * inch, 3.5 * inch])
    tabla_info.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14343A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(tabla_info)
    story.append(Spacer(1, 0.12 * inch))
    data = [["Descripción", "Cant.", "P.U.", "Importe"]]
    for c in conceptos:
        data.append([c.get("Descripcion", ""), c.get("Cantidad", ""), f"${float(c.get('ValorUnitario', 0)):,.2f}", f"${float(c.get('Importe', 0)):,.2f}"])
    data.append(["", "", "Subtotal", f"${float(root.get('SubTotal', 0)):,.2f}"])
    data.append(["", "", "IVA 16%", f"${float(root.find('cfdi:Impuestos', ns).get('TotalImpuestosTrasladados', 0)):,.2f}"])
    data.append(["", "", "Total", f"${float(root.get('Total', 0)):,.2f}"])
    tabla = Table(data, colWidths=[3.2 * inch, 1 * inch, 1.4 * inch, 1.4 * inch])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14343A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    )
    story.append(tabla)
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(LEYENDA, styles["Normal"]))
    doc.build(story)
    return buf.getvalue()


def url_pdf(factura: dict) -> str:
    base = publico()
    if not base or not factura.get("pdf_path"):
        return ""
    return f"{base}/archivos/{factura['pdf_path']}"


def _venta(conn, cot: dict, metodo_pago: str) -> dict:
    neg = negocio()
    tz = ZoneInfo(neg.get("zona_horaria", "America/Mexico_City"))
    partidas = json.loads(cot["partidas_json"])
    items = []
    iva_asignado = 0
    for i, p in enumerate(partidas):
        importe_c = p["cantidad"] * p["precio_unit_centavos"]
        if i == len(partidas) - 1:
            iva_c = cot["iva_centavos"] - iva_asignado
        else:
            iva_c = int(round(importe_c * float(neg.get("iva", 0.16))))
            iva_asignado += iva_c
        items.append(
            {
                "descripcion": p["descripcion"],
                "cantidad": p["cantidad"],
                "precio_unitario": centavos_a_pesos(p["precio_unit_centavos"]),
                "importe": centavos_a_pesos(importe_c),
                "iva": centavos_a_pesos(iva_c),
            }
        )
    n = conn.execute("SELECT COUNT(*) AS c FROM facturas").fetchone()["c"] + 1
    return {
        "serie": "A",
        "folio": f"{n:04d}",
        "fecha": datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S"),
        "metodo_pago": metodo_pago,
        "subtotal": centavos_a_pesos(cot["subtotal_centavos"]),
        "iva": centavos_a_pesos(cot["iva_centavos"]),
        "total": centavos_a_pesos(cot["total_centavos"]),
        "items": items,
        "emisor": {
            "rfc": neg.get("rfc", "XAXX010101000").upper(),
            "nombre": _mayus(neg.get("nombre_comercial", "PUBLICO EN GENERAL")),
            "regimen_fiscal": str(neg.get("regimen_fiscal", "616")),
            "cp": str(neg.get("cp", "06000")),
        },
        "receptor": {
            "rfc": "XAXX010101000",
            "nombre": "PUBLICO EN GENERAL",
            "regimen_fiscal": "616",
            "cp": str(neg.get("cp", "06000")),
            "uso_cfdi": "S01",
        },
    }


def _mayus(texto: str) -> str:
    plano = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return plano.upper()
