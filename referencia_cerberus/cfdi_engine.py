"""
cfdi_engine.py — Motor CFDI 4.0 autónomo.
Genera XML, firma con CSD, genera PDF y timbra via PacAdapter enchufable.
Sin dependencias de servicios externos en ruta crítica.
"""
import os
import json
import logging
from datetime import datetime
from io import BytesIO

from lxml import etree

logger = logging.getLogger("CfdiEngine")

CFDI_NS = "http://www.sat.gob.mx/cfd/4"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
SCHEMA_LOCATION = (
    "http://www.sat.gob.mx/cfd/4 "
    "http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
)

_CONFIG_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cfdi_config.json")
)


def _load_config() -> dict:
    if os.path.exists(_CONFIG_PATH):
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


# ── Utilidades SAT ────────────────────────────────────────────────────────────

_CLAVES_PRODUCTO = {
    "carbón": "15101514", "carbon": "15101514",
    "azúcar": "50171906", "azucar": "50171906",
    "sal": "50171602",
    "cemento": "30111509",
    "acero": "30102705",
}

_CLAVES_UNIDAD = {
    "kg": "KGM", "kilogramo": "KGM", "kilogramos": "KGM",
    "pcs": "H87", "pieza": "H87", "piezas": "H87",
    "litro": "LTR", "litros": "LTR",
    "ton": "TNE", "tonelada": "TNE",
    "saco": "XBG", "sacos": "XBG",
}


def get_clave_sat_producto(descripcion: str) -> str:
    key = descripcion.lower().strip()
    return _CLAVES_PRODUCTO.get(key, "01010101")


def get_clave_sat_unidad(unidad: str) -> str:
    key = unidad.lower().strip()
    return _CLAVES_UNIDAD.get(key, "H87")


def calcular_iva(subtotal: float, tasa: float = 0.16) -> float:
    return round(subtotal * tasa, 2)


# ── Generación XML ────────────────────────────────────────────────────────────

def generar_cfdi_xml(venta: dict, emisor: dict, receptor: dict) -> str:
    """
    Genera XML CFDI 4.0 válido (sin timbrar).
    venta: {serie, folio, forma_pago, metodo_pago, subtotal, iva, total, items}
    emisor: {rfc, nombre, regimen_fiscal, cp}
    receptor: {rfc, nombre, regimen_fiscal, cp, uso_cfdi}
    items: [{descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, unidad, descuento_pct}]
    """
    nsmap = {None: CFDI_NS, "xsi": XSI_NS}
    comp = etree.Element(f"{{{CFDI_NS}}}Comprobante", nsmap=nsmap)
    comp.set(f"{{{XSI_NS}}}schemaLocation", SCHEMA_LOCATION)
    comp.set("Version", "4.0")
    comp.set("Serie", venta.get("serie", "A"))
    comp.set("Folio", str(venta.get("folio", "1")))
    comp.set("Fecha", datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
    comp.set("FormaPago", venta.get("forma_pago", "01"))
    comp.set("SubTotal", f"{float(venta['subtotal']):.2f}")
    comp.set("Moneda", "MXN")
    comp.set("Total", f"{float(venta['total']):.2f}")
    comp.set("TipoDeComprobante", "I")
    comp.set("Exportacion", "01")
    comp.set("MetodoPago", venta.get("metodo_pago", "PUE"))
    comp.set("LugarExpedicion", emisor.get("cp", "00000"))

    em = etree.SubElement(comp, f"{{{CFDI_NS}}}Emisor")
    em.set("Rfc", emisor["rfc"].upper())
    em.set("Nombre", emisor["nombre"])
    em.set("RegimenFiscal", emisor["regimen_fiscal"])

    rec = etree.SubElement(comp, f"{{{CFDI_NS}}}Receptor")
    rec.set("Rfc", receptor["rfc"].upper())
    rec.set("Nombre", receptor["nombre"])
    rec.set("DomicilioFiscalReceptor", receptor["cp"])
    rec.set("RegimenFiscalReceptor", receptor["regimen_fiscal"])
    rec.set("UsoCFDI", receptor.get("uso_cfdi", "G03"))

    conceptos = etree.SubElement(comp, f"{{{CFDI_NS}}}Conceptos")
    total_base_iva = 0.0
    total_iva_acum = 0.0

    for item in venta["items"]:
        desc_pct = item.get("descuento_pct", 0)
        importe = round(item["cantidad"] * item["precio_unitario"] * (1 - desc_pct / 100), 2)
        iva_item = round(importe * 0.16, 2)
        total_base_iva += importe
        total_iva_acum += iva_item

        c = etree.SubElement(conceptos, f"{{{CFDI_NS}}}Concepto")
        c.set("ClaveProdServ", item.get("clave_sat", get_clave_sat_producto(item["descripcion"])))
        c.set("Cantidad", f"{float(item['cantidad']):.4f}")
        c.set("ClaveUnidad", item.get("clave_unidad", get_clave_sat_unidad(item.get("unidad", "pcs"))))
        c.set("Unidad", item.get("unidad", "pcs"))
        c.set("Descripcion", item["descripcion"])
        c.set("ValorUnitario", f"{float(item['precio_unitario']):.2f}")
        c.set("Importe", f"{importe:.2f}")
        c.set("ObjetoImp", "02")
        if desc_pct > 0:
            descuento = round(item["cantidad"] * item["precio_unitario"] * desc_pct / 100, 2)
            c.set("Descuento", f"{descuento:.2f}")

        imp_c = etree.SubElement(c, f"{{{CFDI_NS}}}Impuestos")
        tras_c = etree.SubElement(imp_c, f"{{{CFDI_NS}}}Traslados")
        t = etree.SubElement(tras_c, f"{{{CFDI_NS}}}Traslado")
        t.set("Base", f"{importe:.2f}")
        t.set("Impuesto", "002")
        t.set("TipoFactor", "Tasa")
        t.set("TasaOCuota", "0.160000")
        t.set("Importe", f"{iva_item:.2f}")

    imp = etree.SubElement(comp, f"{{{CFDI_NS}}}Impuestos")
    imp.set("TotalImpuestosTrasladados", f"{total_iva_acum:.2f}")
    tras = etree.SubElement(imp, f"{{{CFDI_NS}}}Traslados")
    t_g = etree.SubElement(tras, f"{{{CFDI_NS}}}Traslado")
    t_g.set("Base", f"{total_base_iva:.2f}")
    t_g.set("Impuesto", "002")
    t_g.set("TipoFactor", "Tasa")
    t_g.set("TasaOCuota", "0.160000")
    t_g.set("Importe", f"{total_iva_acum:.2f}")

    return etree.tostring(
        comp, pretty_print=True, xml_declaration=True, encoding="UTF-8"
    ).decode()


def firmar_cfdi(xml: str, cer_path: str, key_path: str, password: str) -> str:
    """Firma el XML con el CSD del SAT. Activo cuando llegue el CSD."""
    logger.warning("[CFDI] firmar_cfdi: CSD no configurado. Retornando sin firma.")
    return xml


# ── PDF ───────────────────────────────────────────────────────────────────────

def generar_pdf(xml: str, logo_path: str = None) -> bytes:
    """Genera PDF legible de la factura a partir del XML CFDI."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

    root = etree.fromstring(xml.encode() if isinstance(xml, str) else xml)
    ns = {"cfdi": CFDI_NS}

    emisor = root.find("cfdi:Emisor", ns)
    receptor = root.find("cfdi:Receptor", ns)
    conceptos = root.findall("cfdi:Conceptos/cfdi:Concepto", ns)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
                            rightMargin=0.75*inch, leftMargin=0.75*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(
        f"<b>FACTURA {root.get('Serie','')}{root.get('Folio','')}</b>",
        styles["Title"]
    ))
    story.append(Paragraph(f"Fecha: {root.get('Fecha','')}", styles["Normal"]))
    story.append(Spacer(1, 0.15*inch))

    info_data = [
        ["EMISOR", "RECEPTOR"],
        [emisor.get("Nombre","") if emisor is not None else "",
         receptor.get("Nombre","") if receptor is not None else ""],
        [f"RFC: {emisor.get('Rfc','') if emisor is not None else ''}",
         f"RFC: {receptor.get('Rfc','') if receptor is not None else ''}"],
    ]
    info_table = Table(info_data, colWidths=[3.5*inch, 3.5*inch])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.15*inch))

    data = [["Descripción", "Cant.", "P.U.", "Importe"]]
    for c in conceptos:
        data.append([
            c.get("Descripcion", ""),
            c.get("Cantidad", ""),
            f"${float(c.get('ValorUnitario', 0)):,.2f}",
            f"${float(c.get('Importe', 0)):,.2f}",
        ])

    subtotal = float(root.get("SubTotal", 0))
    iva_total = round(subtotal * 0.16, 2)
    total = float(root.get("Total", 0))

    data.extend([
        ["", "", "Subtotal:", f"${subtotal:,.2f}"],
        ["", "", "IVA 16%:", f"${iva_total:,.2f}"],
        ["", "", "TOTAL:", f"${total:,.2f}"],
    ])

    t = Table(data, colWidths=[3*inch, 0.8*inch, 1.5*inch, 1.7*inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, len(data)-4), 0.3, colors.grey),
        ("FONTNAME", (-2, -3), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (-2, -1), (-1, -1), colors.HexColor("#ECF0F1")),
        ("LINEABOVE", (-2, -3), (-1, -3), 1, colors.grey),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.15*inch))

    uuid = root.get("NoCertificado", "BORRADOR - No timbrado")
    story.append(Paragraph(f"<font size=7>UUID: {uuid}</font>", styles["Normal"]))

    doc.build(story)
    return buf.getvalue()


# ── PacAdapter ────────────────────────────────────────────────────────────────

class PacAdapter:
    def timbrar(self, xml: str) -> dict:
        raise NotImplementedError


class NullAdapter(PacAdapter):
    """Modo borrador. Retorna el XML sin timbrar. Para usar hasta tener CSD."""
    def timbrar(self, xml: str) -> dict:
        return {
            "uuid": None,
            "xml_timbrado": xml,
            "fecha_timbrado": None,
            "estado": "borrador",
        }


class SWAdapter(PacAdapter):
    """sw.com.mx — enchufar token cuando llegue el CSD."""
    def __init__(self, token: str):
        self.token = token

    def timbrar(self, xml: str) -> dict:
        import requests
        resp = requests.post(
            "https://services.sw.com.mx/cfdi33/stamp/v3/b64",
            headers={"Authorization": f"bearer {self.token}",
                     "Content-Type": "application/json"},
            json={"xml": xml},
            timeout=30
        )
        data = resp.json()
        if data.get("status") == "success":
            return {
                "uuid": data["data"]["uuid"],
                "xml_timbrado": data["data"]["cfdi"],
                "fecha_timbrado": datetime.now().isoformat(),
                "estado": "timbrada",
            }
        raise RuntimeError(f"SW error: {data.get('message', resp.text)}")


def get_adapter() -> PacAdapter:
    """Carga el PacAdapter configurado en cfdi_config.json."""
    cfg = _load_config()
    pac = cfg.get("pac", {})
    adapter_name = pac.get("adapter", "null")
    if adapter_name == "sw" and pac.get("sw_token"):
        return SWAdapter(token=pac["sw_token"])
    return NullAdapter()
