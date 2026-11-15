"""
ventas_skill.py — Procesador NLP para Ventas Imperial.
Detecta intención → ventas_db → texto formateado para Telegram.
Mismo patrón que almacen_skill.py.
"""
import re
import os
import json
import logging
from cerberus_core.ventas_db import VentasDB
from cerberus_core.cfdi_engine import generar_cfdi_xml, generar_pdf, get_adapter

logger = logging.getLogger("VentasSkill")

_FACTURAS_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "facturas")
)
_CONFIG_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data", "cfdi_config.json")
)


def _load_emisor() -> dict:
    if os.path.exists(_CONFIG_PATH):
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f).get("emisor", {})
    return {}


def procesar_ventas(prompt: str, db_path: str = None,
                    pending_order_id: int = None) -> dict:
    """
    Procesa un prompt de ventas. Retorna dict con:
      text: str        — respuesta para Telegram
      pdf_path: str    — ruta al PDF generado (o None)
      pending_order: int — order_id esperando confirmación (o None)
    """
    db = VentasDB(db_path=db_path) if db_path else VentasDB()
    db.migrate()
    p = prompt.lower().strip()
    result = {"text": "", "pdf_path": None, "pending_order": None}

    # ── Confirmar venta pendiente ──────────────────────────────────────────────
    if pending_order_id and any(kw in p for kw in ["sí", "si", "confirma", "ok", "dale", "yes"]):
        try:
            order = db.confirmar_venta(pending_order_id)
            result["text"] = (
                f"✅ *Venta #{pending_order_id} confirmada*\n"
                f"  Total: ${order['total']:,.2f}\n\n"
                f"¿Genero la factura? Responde *'factura {pending_order_id}'*"
            )
        except Exception as e:
            result["text"] = f"⚠️ Error confirmando venta: {e}"
        return result

    # ── Registrar cliente ──────────────────────────────────────────────────────
    if any(kw in p for kw in ["registra cliente", "nuevo cliente", "agrega cliente"]):
        nombre_m = re.search(r'cliente\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)(?:\s+rfc|\s*$)', p)
        rfc_m = re.search(r'rfc\s+([\w]+)', p)
        tipo_m = re.search(r'\b(fisica|moral|físic[ao])\b', p)
        if not nombre_m or not rfc_m:
            result["text"] = (
                "⚠️ Usa: *registra cliente [nombre] rfc [RFC] tipo [fisica/moral] "
                "regimen [clave] cp [código postal]*\n\n"
                "Ejemplo: *registra cliente Ferretera López rfc FLO900101AAA tipo moral "
                "regimen 601 cp 64000*"
            )
            return result
        tipo = "moral" if tipo_m and "moral" in tipo_m.group(1) else "fisica"
        reg_m = re.search(r'regimen\s+(\d+)', p)
        cp_m = re.search(r'cp\s+(\d{5})', p)
        try:
            cid = db.registrar_cliente(
                nombre=nombre_m.group(1).strip().title(),
                rfc=rfc_m.group(1).upper(),
                tipo=tipo,
                regimen_fiscal=reg_m.group(1) if reg_m else "601",
                cp=cp_m.group(1) if cp_m else "00000",
            )
            result["text"] = f"✅ Cliente *{nombre_m.group(1).strip().title()}* registrado (ID: {cid})"
        except Exception as e:
            result["text"] = f"⚠️ Error: {e}"
        return result

    # ── Historial de cliente ───────────────────────────────────────────────────
    if any(kw in p for kw in ["historial de", "historial del"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p or c["rfc"].lower() in p:
                cliente_found = c
                break
        if not cliente_found:
            result["text"] = "⚠️ No encontré ese cliente."
            return result
        h = db.get_historial_cliente(cliente_found["id"])
        prods = ", ".join(h["productos_preferidos"][:3]) or "ninguno"
        freq = f"cada {h['frecuencia_dias']:.0f} días" if h["frecuencia_dias"] else "sin patrón"
        result["text"] = (
            f"👤 *{cliente_found['nombre']}*\n\n"
            f"  Total comprado: ${h['total_comprado']:,.2f}\n"
            f"  Número de compras: {len(h['compras'])}\n"
            f"  Última compra: {h['ultima_compra'] or 'nunca'}\n"
            f"  Frecuencia: {freq}\n"
            f"  Productos favoritos: {prods}"
        )
        return result

    # ── Ranking de clientes ────────────────────────────────────────────────────
    if any(kw in p for kw in ["ranking de clientes", "quién compra más", "quien compra mas",
                               "mejores clientes"]):
        ranking = db.get_ranking_clientes(dias=30)
        if not ranking:
            result["text"] = "📊 No hay clientes registrados."
            return result
        lines = ["🏆 *Ranking de clientes (últimos 30 días):*\n"]
        for i, c in enumerate(ranking[:8], 1):
            lines.append(f"  {i}. {c['nombre']}: ${float(c['total']):,.2f} ({c['compras']} compras)")
        result["text"] = "\n".join(lines)
        return result

    # ── Clientes inactivos ────────────────────────────────────────────────────
    if any(kw in p for kw in ["clientes inactivos", "no han comprado", "sin compras"]):
        dias_m = re.search(r'(\d+)\s*días?', p)
        dias = int(dias_m.group(1)) if dias_m else 30
        inactivos = db.get_clientes_inactivos(dias=dias)
        if not inactivos:
            result["text"] = f"✅ Todos los clientes han comprado en los últimos {dias} días."
            return result
        lines = [f"😴 *Clientes sin compras en {dias} días:*\n"]
        for c in inactivos[:10]:
            ultima = c.get("ultima_compra") or "nunca"
            lines.append(f"  • {c['nombre']} — última: {ultima}")
        result["text"] = "\n".join(lines)
        return result

    # ── Venta nueva ───────────────────────────────────────────────────────────
    if any(kw in p for kw in ["venta a", "despachamos a", "vendemos a"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        if not cliente_found:
            result["text"] = (
                "⚠️ No reconocí el cliente. Primero regístralo con:\n"
                "*registra cliente [nombre] rfc [RFC] tipo [fisica/moral]*"
            )
            return result
        from cerberus_core.almacen_db import AlmacenDB
        adb = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
        productos = adb.listar_productos()
        prod_found = None
        for prod in productos:
            if prod["name"].lower() in p:
                prod_found = prod
                break
        qty_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|pcs|piezas|litros|ton)?', p)
        price_m = re.search(r'\$\s*([\d.]+)|a\s+([\d.]+)\s*(?:pesos)?', p)
        if not prod_found or not qty_m:
            result["text"] = (
                "⚠️ Usa: *venta a [cliente] [cantidad] [producto] a $[precio]*\n"
                "Ejemplo: *venta a Ferretera López 500 kg carbón a $8*"
            )
            return result
        cantidad = float(qty_m.group(1))
        precio = float(price_m.group(1) or price_m.group(2)) if price_m else float(prod_found.get("sale_price", 0))
        subtotal = round(cantidad * precio, 2)
        iva = round(subtotal * 0.16, 2)
        total = round(subtotal + iva, 2)
        oid = db.crear_venta(
            cliente_found["id"],
            [{"part_id": prod_found["id"], "cantidad": cantidad, "precio_unitario": precio}]
        )
        result["text"] = (
            f"🛒 *Nueva venta #{oid}*\n\n"
            f"  Cliente: {cliente_found['nombre']}\n"
            f"  Producto: {prod_found['name']}\n"
            f"  Cantidad: {cantidad:.1f} {prod_found['unit']}\n"
            f"  Precio: ${precio:.2f}/unidad\n"
            f"  Subtotal: ${subtotal:,.2f}\n"
            f"  IVA 16%: ${iva:,.2f}\n"
            f"  *Total: ${total:,.2f}*\n\n"
            f"¿Confirmas? Responde *'confirmar'* o *'cancelar'*"
        )
        result["pending_order"] = oid
        return result

    # ── Generar factura ───────────────────────────────────────────────────────
    if any(kw in p for kw in ["factura", "genera factura", "manda factura"]):
        order_m = re.search(r'(?:factura|invoice)\s+(\d+)', p)
        if not order_m:
            result["text"] = "⚠️ Especifica el número de venta: *factura [número]*"
            return result
        order_id = int(order_m.group(1))
        try:
            inv_id = db.crear_invoice(order_id)
        except Exception as e:
            result["text"] = f"⚠️ Error creando factura: {e}"
            return result
        inv = db.get_invoice(inv_id)
        if not inv:
            result["text"] = "⚠️ No pude recuperar la factura."
            return result

        import sqlite3
        conn = sqlite3.connect(db.db_path)
        conn.row_factory = sqlite3.Row
        items_rows = conn.execute(
            """SELECT si.*, p.name as prod_name, p.unit
               FROM sale_items si JOIN parts p ON p.id=si.part_id
               WHERE si.sale_order_id=?""", (order_id,)
        ).fetchall()
        cliente_row = conn.execute(
            "SELECT * FROM clients WHERE id=?", (inv["client_id"],)
        ).fetchone()
        order_row = conn.execute(
            "SELECT * FROM sales_orders WHERE id=?", (order_id,)
        ).fetchone()
        conn.close()

        emisor = _load_emisor()
        receptor = {
            "rfc": cliente_row["rfc"],
            "nombre": cliente_row["razon_social"] or cliente_row["nombre"],
            "regimen_fiscal": cliente_row["regimen_fiscal"] or "601",
            "cp": cliente_row["cp"] or "00000",
            "uso_cfdi": cliente_row["uso_cfdi"] or "G03",
        }
        venta_cfdi = {
            "serie": inv["serie"],
            "folio": inv["folio"].split("-")[-1],
            "forma_pago": "01",
            "metodo_pago": "PUE",
            "subtotal": order_row["subtotal"],
            "iva": order_row["iva"],
            "total": order_row["total"],
            "items": [
                {
                    "descripcion": row["prod_name"],
                    "cantidad": row["cantidad"],
                    "precio_unitario": row["precio_unitario"],
                    "descuento_pct": row["descuento_pct"],
                    "clave_sat": "15101514",
                    "clave_unidad": "KGM",
                    "unidad": row["unit"],
                }
                for row in items_rows
            ]
        }

        xml = generar_cfdi_xml(venta_cfdi, emisor, receptor)
        adapter = get_adapter()
        timbrado = adapter.timbrar(xml)

        from datetime import datetime as dt
        mes_dir = os.path.join(_FACTURAS_DIR, dt.now().strftime("%Y-%m"))
        os.makedirs(mes_dir, exist_ok=True)
        folio_safe = inv["folio"].replace("/", "-")
        xml_path = os.path.join(mes_dir, f"{folio_safe}.xml")
        pdf_path = os.path.join(mes_dir, f"{folio_safe}.pdf")

        with open(xml_path, "w", encoding="utf-8") as f:
            f.write(timbrado["xml_timbrado"])
        pdf_bytes = generar_pdf(timbrado["xml_timbrado"])
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        db.marcar_timbrada(inv_id, timbrado["uuid"] or "BORRADOR", xml_path, pdf_path)
        estado_txt = "✅ Timbrada" if timbrado["estado"] == "timbrada" else "📝 Borrador (sin CSD)"
        result["text"] = (
            f"🧾 *Factura {inv['folio']}*\n\n"
            f"  Estado: {estado_txt}\n"
            f"  Total: ${float(order_row['total']):,.2f}\n"
            f"  UUID: {timbrado['uuid'] or 'pendiente de timbrado'}\n\n"
            f"PDF generado y listo."
        )
        result["pdf_path"] = pdf_path
        return result

    # ── Cuentas por cobrar ────────────────────────────────────────────────────
    if any(kw in p for kw in ["cuentas por cobrar", "nos deben", "saldo pendiente", "cobrar"]):
        cxc = db.get_cuentas_por_cobrar()
        if not cxc:
            result["text"] = "✅ No hay cuentas pendientes de cobro."
            return result
        total_pendiente = sum(float(c["saldo"]) for c in cxc)
        lines = [f"💰 *Cuentas por cobrar — Total: ${total_pendiente:,.2f}*\n"]
        for c in cxc[:10]:
            lines.append(f"  • {c['cliente']}: ${float(c['saldo']):,.2f} ({c['folio']})")
        result["text"] = "\n".join(lines)
        return result

    # ── Cuánto nos debe un cliente ────────────────────────────────────────────
    if any(kw in p for kw in ["cuánto nos debe", "cuanto nos debe", "debe "]):
        clientes = db.listar_clientes()
        for c in clientes:
            if c["nombre"].lower() in p:
                cxc = db.get_cuentas_por_cobrar()
                total_cliente = sum(float(x["saldo"]) for x in cxc if x["cliente"] == c["nombre"])
                result["text"] = (
                    f"💰 *{c['nombre']}*\n"
                    f"  Saldo pendiente: ${total_cliente:,.2f}"
                )
                return result
        result["text"] = "⚠️ No encontré ese cliente."
        return result

    # ── Registrar pago ────────────────────────────────────────────────────────
    if any(kw in p for kw in ["pago de", "pagó", "registra pago"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        monto_m = re.search(r'\$\s*([\d,]+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*pesos?', p)
        metodo = "transferencia" if "transferencia" in p else ("cheque" if "cheque" in p else "efectivo")
        ref_m = re.search(r'ref(?:erencia)?[:\s]+([\w-]+)', p)
        if not cliente_found or not monto_m:
            result["text"] = "⚠️ Usa: *pago de [cliente] $[monto] [efectivo/transferencia/cheque]*"
            return result
        monto_str = (monto_m.group(1) or monto_m.group(2)).replace(",", "")
        monto = float(monto_str)
        cxc = db.get_cuentas_por_cobrar()
        inv_cliente = [x for x in cxc if x["cliente"] == cliente_found["nombre"]]
        if not inv_cliente:
            result["text"] = f"✅ {cliente_found['nombre']} no tiene saldo pendiente."
            return result
        db.registrar_pago(
            inv_cliente[0]["invoice_id"], monto, metodo,
            referencia=ref_m.group(1) if ref_m else ""
        )
        nuevo_saldo = db.get_saldo_pendiente(inv_cliente[0]["invoice_id"])
        result["text"] = (
            f"✅ *Pago registrado*\n"
            f"  Cliente: {cliente_found['nombre']}\n"
            f"  Monto: ${monto:,.2f} ({metodo})\n"
            f"  Saldo restante: ${nuevo_saldo:,.2f}"
        )
        return result

    # ── Resumen de ventas ─────────────────────────────────────────────────────
    if any(kw in p for kw in ["resumen de ventas", "ventas del mes", "ventas hoy",
                               "ventas de la semana"]):
        dias = 1 if "hoy" in p else (7 if "semana" in p else 30)
        v = db.get_ventas_periodo(dias=dias)
        periodo = "hoy" if dias == 1 else f"últimos {dias} días"
        result["text"] = (
            f"📊 *Ventas — {periodo}:*\n\n"
            f"  Número de ventas: {v['count']}\n"
            f"  Total facturado: ${v['total_ventas']:,.2f}\n"
            f"  Subtotal (sin IVA): ${v['subtotal_ventas']:,.2f}"
        )
        return result

    # ── Listado de clientes ───────────────────────────────────────────────────
    if any(kw in p for kw in ["lista de clientes", "mis clientes", "clientes registrados"]):
        clientes = db.listar_clientes()
        if not clientes:
            result["text"] = "📋 No hay clientes registrados."
            return result
        lines = [f"👥 *Clientes ({len(clientes)}):*\n"]
        for c in clientes:
            lines.append(f"  • {c['nombre']} ({c['rfc']}) — {c['tipo']}")
        result["text"] = "\n".join(lines)
        return result

    # ── Ayuda ─────────────────────────────────────────────────────────────────
    result["text"] = (
        "💼 *Ventas Imperial* — comandos:\n\n"
        "• *registra cliente* [nombre] rfc [RFC] tipo [fisica/moral]\n"
        "• *venta a* [cliente] [cantidad] [producto] a $[precio]\n"
        "• *factura* [número de venta]\n"
        "• *pago de* [cliente] $[monto]\n"
        "• *historial de* [cliente]\n"
        "• *ranking de clientes*\n"
        "• *clientes inactivos*\n"
        "• *cuentas por cobrar*\n"
        "• *resumen de ventas* / *ventas del mes*"
    )
    return result
