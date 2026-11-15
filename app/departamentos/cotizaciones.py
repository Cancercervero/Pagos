"""Cotizaciones desde el catálogo. El total lo calcula este módulo, no el modelo."""

import json
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import archivos_dir, catalogo, catalogo_bienes, negocio, publico
from app.db import ahora_iso, conectar, fila, transaccion
from app.dinero import fmt_mxn, pesos_a_centavos


def listar_catalogo() -> str:
    lineas = ["Servicios de la estética:"]
    for s in catalogo().get("servicios", []):
        lineas.append(f"• {s['nombre']} — {fmt_mxn(pesos_a_centavos(s['precio']))} ({s['duracion_min']} min)")
    return "\n".join(lineas)


def listar_tienda() -> str:
    lineas = ["Productos de la estética:"]
    for s in catalogo_bienes().get("productos", []):
        tasa = "IVA 0" if float(s.get("iva", 0)) == 0 else "IVA 16%"
        lineas.append(f"• {s['nombre']} — {fmt_mxn(pesos_a_centavos(s['precio']))} ({tasa})")
    return "\n".join(lineas)


def es_bienes(cot: dict) -> bool:
    partidas = cot.get("partidas") or json.loads(cot["partidas_json"])
    return any(p.get("giro") == "bienes" for p in partidas)


def crear_cotizacion(contacto_id: int, partidas: list[dict]) -> dict:
    servicios = {s["id"]: s for s in catalogo().get("servicios", [])}
    bienes = {s["id"]: s for s in catalogo_bienes().get("productos", [])}
    if not partidas:
        raise ValueError("La cotización no tiene partidas.")
    armadas = []
    subtotal = 0
    iva = 0
    giros = set()
    for p in partidas:
        sid = p.get("servicio_id")
        cantidad = int(p.get("cantidad") or 1)
        if cantidad < 1:
            raise ValueError("La cantidad tiene que ser al menos 1.")
        if sid in servicios and sid in bienes:
            raise ValueError(f"'{sid}' está en las dos cuentas.")
        if sid in servicios:
            srv = servicios[sid]
            precio = pesos_a_centavos(srv["precio"])
            tasa = float(negocio().get("iva", 0.16))
            costo = 0
            giro = "servicios"
            extra = srv["duracion_min"]
        elif sid in bienes:
            srv = bienes[sid]
            precio = pesos_a_centavos(srv["precio"])
            tasa = float(srv.get("iva", 0.16))
            costo = pesos_a_centavos(srv["costo"]) * cantidad
            giro = "bienes"
            extra = 0
        else:
            raise ValueError(f"No tengo '{sid}'.")
        giros.add(giro)
        subtotal += precio * cantidad
        iva += int(round(precio * cantidad * tasa))
        armadas.append(
            {
                "servicio_id": sid,
                "descripcion": srv["nombre"],
                "cantidad": cantidad,
                "precio_unit_centavos": precio,
                "duracion_min": extra,
                "giro": giro,
                "tasa_iva": tasa,
                "costo_centavos": costo,
            }
        )
    if len(giros) > 1:
        raise ValueError("El servicio y la mercancía van en cuentas distintas.")
    total = subtotal + iva
    with transaccion() as conn:
        folio = _folio(conn)
        conn.execute(
            """INSERT INTO cotizaciones
               (folio, contacto_id, partidas_json, subtotal_centavos, iva_centavos, total_centavos, estado, creado_en)
               VALUES (?, ?, ?, ?, ?, ?, 'enviada', ?)""",
            (folio, contacto_id, json.dumps(armadas, ensure_ascii=False), subtotal, iva, total, ahora_iso()),
        )
        cot = fila(conn.execute("SELECT * FROM cotizaciones WHERE folio=?", (folio,)).fetchone())
    ruta = archivos_dir() / f"{cot['folio']}.pdf"
    ruta.write_bytes(_pdf(cot, armadas))
    with transaccion() as conn:
        conn.execute("UPDATE cotizaciones SET pdf_path=? WHERE id=?", (str(ruta), cot["id"]))
        return fila(conn.execute("SELECT * FROM cotizaciones WHERE id=?", (cot["id"],)).fetchone())


def texto_cotizacion(cot: dict) -> str:
    partidas = json.loads(cot["partidas_json"])
    lineas = [f"Cotización {cot['folio']}"]
    for p in partidas:
        lineas.append(f"• {p['descripcion']} x{p['cantidad']} — {fmt_mxn(p['precio_unit_centavos'] * p['cantidad'])}")
    lineas.append(f"Subtotal {fmt_mxn(cot['subtotal_centavos'])}")
    lineas.append(f"IVA {fmt_mxn(cot['iva_centavos'])}")
    lineas.append(f"Total {fmt_mxn(cot['total_centavos'])}")
    lineas.append("Cobro de esta etapa: $0.01.")
    if es_bienes(cot):
        costo = sum(int(p.get("costo_centavos") or 0) for p in partidas)
        margen = cot["subtotal_centavos"] - costo
        lineas.append(f"Costo de la mercancía {fmt_mxn(costo)}. Margen antes de impuestos {fmt_mxn(margen)}.")
        lineas.append('Si te late, dime "va". No aparta horario.')
    else:
        lineas.append('Si te late, dime "va" y te paso horarios.')
    base = publico()
    if base:
        lineas.append(f"PDF: {base}/archivos/{cot['folio']}.pdf")
    return "\n".join(lineas)


def ultima_de(contacto_id: int) -> dict | None:
    with conectar() as conn:
        return fila(
            conn.execute(
                "SELECT * FROM cotizaciones WHERE contacto_id=? ORDER BY id DESC LIMIT 1",
                (contacto_id,),
            ).fetchone()
        )


def por_folio(folio: str) -> dict | None:
    with conectar() as conn:
        return fila(conn.execute("SELECT * FROM cotizaciones WHERE folio=?", (folio.strip(),)).fetchone())


def saldo_de(contacto_id: int) -> str:
    with conectar() as conn:
        rows = conn.execute(
            """SELECT folio, total_centavos, pagado_centavos, estado FROM cotizaciones
               WHERE contacto_id=? AND estado!='cancelada' ORDER BY id DESC LIMIT 5""",
            (contacto_id,),
        ).fetchall()
    if not rows:
        return "No tienes cotizaciones abiertas."
    lineas = ["Tus cotizaciones:"]
    for r in rows:
        resta = r["total_centavos"] - r["pagado_centavos"]
        lineas.append(f"• {r['folio']} — {r['estado']} — saldo {fmt_mxn(max(resta, 0))}")
    return "\n".join(lineas)


def _folio(conn) -> str:
    tz = ZoneInfo(negocio().get("zona_horaria", "America/Mexico_City"))
    dia = datetime.now(tz).strftime("%Y%m%d")
    prefijo = f"COT-{dia}-"
    row = conn.execute("SELECT COUNT(*) AS c FROM cotizaciones WHERE folio LIKE ?", (prefijo + "%",)).fetchone()
    return f"{prefijo}{int(row['c']) + 1:04d}"


def _pdf(cot: dict, partidas: list[dict]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter, rightMargin=0.7 * inch, leftMargin=0.7 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch
    )
    styles = getSampleStyleSheet()
    neg = negocio()
    story = [
        Paragraph(f"<b>{neg.get('nombre_comercial', 'Negocio')}</b>", styles["Title"]),
        Paragraph(f"Cotización {cot['folio']}", styles["Heading2"]),
        Spacer(1, 0.15 * inch),
    ]
    data = [["Servicio", "Cant.", "Importe"]]
    for p in partidas:
        data.append([p["descripcion"], str(p["cantidad"]), fmt_mxn(p["precio_unit_centavos"] * p["cantidad"])])
    data.append(["", "Subtotal", fmt_mxn(cot["subtotal_centavos"])])
    data.append(["", "IVA", fmt_mxn(cot["iva_centavos"])])
    data.append(["", "Total", fmt_mxn(cot["total_centavos"])])
    tabla = Table(data, colWidths=[4.2 * inch, 1 * inch, 1.6 * inch])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14343A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("FONTNAME", (1, -3), (-1, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -4), 0.3, colors.grey),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(tabla)
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Esta cotización no es un CFDI.", styles["Normal"]))
    doc.build(story)
    return buf.getvalue()
