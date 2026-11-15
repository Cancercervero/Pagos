"""
almacen_skill.py — Procesador de lenguaje natural para el Almacén Imperial.
Recibe el texto del usuario, detecta la intención y delega a almacen_db.
Devuelve texto formateado listo para Telegram.
"""
import re
import logging
from cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("AlmacenSkill")


def procesar_almacen(prompt: str, db_path: str = None) -> str:
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    p = prompt.lower().strip()

    # ── Alertas de stock bajo ────────────────────────────────────────────────
    if any(kw in p for kw in ["alerta", "bajo", "qué está bajo", "que esta bajo", "falta"]):
        alertas = db.get_alertas_stock_bajo()
        if not alertas:
            return "✅ Todo el stock está en niveles normales."
        lines = ["⚠️ *Stock bajo — requiere reposición:*\n"]
        for a in alertas:
            lines.append(f"  • {a['name']} ({a['sku']}): {a['stock_actual']:.1f} {a['unit']} (mín: {a['min_stock']:.1f})")
        return "\n".join(lines)

    # ── Ranking de productos ─────────────────────────────────────────────────
    if any(kw in p for kw in ["ranking", "mejor margen", "más rentable", "mas rentable", "qué vende"]):
        ranking = db.get_ranking_productos()
        if not ranking:
            return "📦 No hay productos registrados aún."
        lines = ["🏆 *Ranking por margen:*\n"]
        for i, r in enumerate(ranking[:8], 1):
            lines.append(f"  {i}. {r['name']}: {r['margen_pct']}% (${r['margen_pesos']}/unidad)")
        return "\n".join(lines)

    # ── Flujo del período ────────────────────────────────────────────────────
    if any(kw in p for kw in ["flujo", "resumen", "mes", "semana", "período", "periodo"]):
        dias = 7 if "semana" in p else 30
        f = db.get_flujo_periodo(dias=dias)
        return (
            f"📊 *Flujo últimos {dias} días:*\n\n"
            f"  📥 Entradas: {f['entradas_qty']:.1f} unidades (${f['costo_compras']:.2f})\n"
            f"  📤 Salidas: {f['salidas_qty']:.1f} unidades\n"
            f"  💰 Ingresos: ${f['ingresos_brutos']:.2f}\n"
            f"  🏭 Costo mercancía: ${f['costo_mercancia']:.2f}\n"
            f"  ✅ Ganancia bruta: ${f['ganancia_bruta']:.2f}\n"
            f"  ⏱️ Horas trabajadas: {f['horas_labor']:.1f}h"
        )

    # ── Margen de un producto ────────────────────────────────────────────────
    if any(kw in p for kw in ["margen", "rentabilidad", "ganancia de"]):
        productos = db.listar_productos()
        for prod in productos:
            if prod["name"].lower() in p or (prod["sku"] or "").lower() in p:
                m = db.get_margen_producto(prod["id"])
                stock = db.get_stock_actual(prod["id"])
                return (
                    f"📦 *{m['name']}*\n\n"
                    f"  Costo bruto: ${m['costo_bruto']:.2f}/unidad\n"
                    f"  Costo proceso: ${m['costo_proceso']:.2f}/unidad\n"
                    f"  Costo total: ${m['costo_total']:.2f}/unidad\n"
                    f"  Precio venta: ${m['precio_venta']:.2f}/unidad\n"
                    f"  *Margen: ${m['margen_pesos']:.2f} ({m['margen_pct']}%)*\n"
                    f"  Stock actual: {stock:.1f} unidades"
                )
        return "⚠️ No encontré ese producto. Dime el nombre exacto."

    # ── Stock actual ─────────────────────────────────────────────────────────
    if any(kw in p for kw in ["stock", "cuánto hay", "cuanto hay", "inventario de", "existencia"]):
        productos = db.listar_productos()
        for prod in productos:
            if prod["name"].lower() in p or (prod["sku"] or "").lower() in p:
                stock = db.get_stock_actual(prod["id"])
                alerta = " ⚠️ *BAJO MÍNIMO*" if stock < prod["min_stock"] else ""
                return f"📦 *{prod['name']}*: {stock:.1f} {prod['unit']}{alerta}\n(Mínimo recomendado: {prod['min_stock']:.1f})"
        todos = db.listar_productos()
        if not todos:
            return "📦 No hay productos registrados."
        lines = ["📦 *Inventario completo:*\n"]
        for prod in todos:
            stock = db.get_stock_actual(prod["id"])
            badge = " ⚠️" if stock < prod["min_stock"] else ""
            lines.append(f"  • {prod['name']}: {stock:.1f} {prod['unit']}{badge}")
        return "\n".join(lines)

    # ── Registrar producto ───────────────────────────────────────────────────
    if any(kw in p for kw in ["registra producto", "nuevo producto", "agrega producto"]):
        name_m    = re.search(r'producto\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)(?:\s+sku|\s+unidad|\s*$)', p)
        sku_m     = re.search(r'sku\s+([\w-]+)', p)
        unit_m    = re.search(r'unidad[:\s]+([\w]+)', p)
        cat_m     = re.search(r'categor[íi]a[:\s]+([\w\sáéíóúüñ]+?)(?:\s+min|\s+costo|\s*$)', p)
        min_m     = re.search(r'min(?:imo)?[:\s]+([\d.]+)', p)
        costo_m   = re.search(r'costo[:\s]+([\d.]+)', p)
        proceso_m = re.search(r'proceso[:\s]+([\d.]+)', p)
        venta_m   = re.search(r'venta[:\s]+([\d.]+)', p)

        if not name_m:
            return "⚠️ No entendí el nombre del producto. Usa: *registra producto [nombre] sku [SKU] unidad [kg/pcs] categoría [cat] min [N] costo [N] proceso [N] venta [N]*"

        pid = db.registrar_producto(
            name=name_m.group(1).strip().title(),
            sku=(sku_m.group(1) if sku_m else "AUTO").upper(),
            unit=unit_m.group(1) if unit_m else "pcs",
            categoria=cat_m.group(1).strip() if cat_m else "general",
            min_stock=float(min_m.group(1)) if min_m else 0.0,
            costo_bruto=float(costo_m.group(1)) if costo_m else 0.0,
            costo_proceso=float(proceso_m.group(1)) if proceso_m else 0.0,
            precio_venta=float(venta_m.group(1)) if venta_m else 0.0,
        )
        return f"✅ Producto *{name_m.group(1).strip().title()}* registrado (ID: {pid})"

    # ── Registrar proveedor ──────────────────────────────────────────────────
    if any(kw in p for kw in ["registra proveedor", "nuevo proveedor", "agrega proveedor"]):
        name_m = re.search(r'proveedor\s+([\w\sáéíóúüñ]+?)(?:\s+tel|\s+contacto|\s*$)', p, re.IGNORECASE)
        tel_m  = re.search(r'(?:tel|contacto)[:\s]+([\d\w\s-]+)', p)
        if not name_m:
            return "⚠️ Usa: *registra proveedor [nombre] contacto [teléfono]*"
        sid = db.registrar_proveedor(
            name=name_m.group(1).strip().title(),
            contacto=tel_m.group(1).strip() if tel_m else "",
        )
        return f"✅ Proveedor *{name_m.group(1).strip().title()}* registrado (ID: {sid})"

    # ── Entrada de stock ─────────────────────────────────────────────────────
    if any(kw in p for kw in ["entrada", "recibí", "recibi", "compramos", "ingresamos"]):
        qty_m   = re.search(r'(\d+(?:\.\d+)?)', p)
        price_m = re.search(r'\$\s*([\d.]+)|a\s+([\d.]+)\s*(?:pesos|cada)?', p)
        horas_m = re.search(r'(\d+(?:\.\d+)?)\s*h(?:oras?)?', p)

        if not qty_m:
            return "⚠️ Usa: *entrada [cantidad] [producto] de [proveedor] a $[precio]*"

        cantidad = float(qty_m.group(1))
        precio   = float(price_m.group(1) or price_m.group(2)) if price_m else 0.0
        horas    = float(horas_m.group(1)) if horas_m else 0.0

        productos = db.listar_productos()
        prod_found = None
        for prod in productos:
            if prod["name"].lower() in p:
                prod_found = prod
                break
        if not prod_found:
            return "⚠️ No reconocí el producto. Asegúrate de que esté registrado primero."

        proveedores = db.listar_proveedores()
        prov_found = proveedores[0] if proveedores else None
        for prov in proveedores:
            if prov["name"].lower() in p:
                prov_found = prov
                break

        if not prov_found:
            return "⚠️ No reconocí el proveedor. Regístralo primero con: *registra proveedor [nombre]*"

        db.entrada_stock(prod_found["id"], prov_found["id"], cantidad, precio, horas_labor=horas)
        stock_nuevo = db.get_stock_actual(prod_found["id"])
        return (
            f"✅ Entrada registrada\n"
            f"  Producto: {prod_found['name']}\n"
            f"  Cantidad: {cantidad:.1f} {prod_found['unit']}\n"
            f"  Precio: ${precio:.2f}/unidad\n"
            f"  Stock actual: {stock_nuevo:.1f} {prod_found['unit']}"
        )

    # ── Salida de stock ──────────────────────────────────────────────────────
    if any(kw in p for kw in ["salida", "vendimos", "despachamos", "entregamos"]):
        qty_m   = re.search(r'(\d+(?:\.\d+)?)', p)
        price_m = re.search(r'\$\s*([\d.]+)|a\s+([\d.]+)', p)

        if not qty_m:
            return "⚠️ Usa: *salida [cantidad] [producto] a $[precio]*"

        cantidad = float(qty_m.group(1))
        precio   = float(price_m.group(1) or price_m.group(2)) if price_m else 0.0

        productos = db.listar_productos()
        prod_found = None
        for prod in productos:
            if prod["name"].lower() in p:
                prod_found = prod
                break

        if not prod_found:
            return "⚠️ No reconocí el producto."

        stock_antes = db.get_stock_actual(prod_found["id"])
        if cantidad > stock_antes:
            return f"⚠️ Stock insuficiente. Disponible: {stock_antes:.1f} {prod_found['unit']}"

        db.salida_stock(prod_found["id"], cantidad, precio)
        stock_nuevo = db.get_stock_actual(prod_found["id"])
        m = db.get_margen_producto(prod_found["id"])
        ganancia = (precio - m.get("costo_total", 0)) * cantidad if m else 0

        return (
            f"✅ Salida registrada\n"
            f"  Producto: {prod_found['name']}\n"
            f"  Vendido: {cantidad:.1f} {prod_found['unit']} a ${precio:.2f}\n"
            f"  Ganancia esta venta: ${ganancia:.2f}\n"
            f"  Stock restante: {stock_nuevo:.1f} {prod_found['unit']}"
        )

    # ── Listar todo ──────────────────────────────────────────────────────────
    if any(kw in p for kw in ["lista", "productos", "proveedores", "todo", "qué tienes"]):
        if "proveedor" in p:
            provs = db.listar_proveedores()
            if not provs:
                return "No hay proveedores registrados."
            lines = ["🏭 *Proveedores:*\n"]
            for pv in provs:
                lines.append(f"  • {pv['name']} ⭐{pv['rating']}")
            return "\n".join(lines)
        prods = db.listar_productos()
        if not prods:
            return "No hay productos registrados."
        lines = ["📦 *Productos:*\n"]
        for pr in prods:
            stock = db.get_stock_actual(pr["id"])
            lines.append(f"  • {pr['name']} ({pr['sku']}) — Stock: {stock:.1f} {pr['unit']}")
        return "\n".join(lines)

    return (
        "🏪 *Almacén Imperial* — comandos disponibles:\n\n"
        "• *registra producto* [nombre] sku [SKU] ...\n"
        "• *registra proveedor* [nombre]\n"
        "• *entrada* [N] [producto] de [proveedor] a $[precio]\n"
        "• *salida* [N] [producto] a $[precio]\n"
        "• *margen del* [producto]\n"
        "• *stock* de [producto] / *inventario*\n"
        "• *resumen del mes* / *flujo*\n"
        "• *alertas* / *qué está bajo*\n"
        "• *ranking*"
    )
