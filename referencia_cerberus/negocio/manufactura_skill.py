# host_engine/skills/manufactura_skill.py
"""
manufactura_skill.py — NLP para el módulo de Manufactura Imperial.
Detecta intención y delega a ManufacturaDB.
Devuelve texto formateado para Telegram.
"""
import re
import logging

logger = logging.getLogger("ManufacturaSkill")


def procesar_manufactura(prompt: str, db_path: str = None) -> str:
    try:
        from cerberus_core.manufactura_db import ManufacturaDB
    except ModuleNotFoundError:
        from host_engine.cerberus_core.manufactura_db import ManufacturaDB

    db = ManufacturaDB(db_path=db_path) if db_path else ManufacturaDB()
    db.migrate()
    p = prompt.lower().strip()

    # ── Listar recetas ───────────────────────────────────────────────────────
    if any(kw in p for kw in ["listar recetas", "recetas disponibles", "qué recetas", "que recetas"]):
        recetas = db.listar_recetas()
        if not recetas:
            return "📋 No hay recetas registradas. Usa *nueva receta [nombre]*."
        lines = ["📋 *Recetas disponibles:*\n"]
        for r in recetas:
            ings = len(r["ingredientes"])
            lines.append(f"  • *{r['name']}* — {ings} ingrediente(s) | yield: {r.get('yield_pct', 1)*100:.0f}%")
        return "\n".join(lines)

    # ── Costo de receta ──────────────────────────────────────────────────────
    if any(kw in p for kw in ["costo de receta", "cuánto cuesta hacer", "cuanto cuesta hacer", "presupuesto"]):
        recetas = db.listar_recetas()
        receta_found = None
        for r in recetas:
            if r["name"].lower() in p:
                receta_found = r
                break
        if not receta_found:
            return "⚠️ No reconocí la receta. Usa: *costo de receta [nombre]*"

        lotes_m = re.search(r'(\d+(?:\.\d+)?)\s*lote', p)
        lotes = float(lotes_m.group(1)) if lotes_m else 1.0

        c = db.calcular_costo_receta(receta_found["id"], lotes=lotes)
        badge = "✅" if c["stock_suficiente"] else "⚠️ STOCK INSUFICIENTE"
        margen_str = f"{c['margen_pct']:.1f}%" if c["margen_pct"] is not None else "N/D"
        lines = [
            f"📊 *{c['recipe_name']}* — {lotes} lote(s) {badge}\n",
            f"  Output estimado: {c['output_qty_est']:.1f} unidades",
            f"  Costo total est.: ${c['costo_total_est']:.2f}",
            f"  Precio venta: ${c['precio_venta']:.2f}/u",
            f"  Margen est.: {margen_str}\n",
            "  *Ingredientes:*",
        ]
        for ing in c["ingredientes"]:
            suficiente = "✅" if ing["stock_actual"] >= ing["qty_necesaria"] else "⚠️"
            lines.append(
                f"  {suficiente} {ing['name']}: {ing['qty_necesaria']:.1f} {ing['unit']} "
                f"(stock: {ing['stock_actual']:.1f}) × ${ing['precio_est']:.2f} = ${ing['costo_est']:.2f}"
            )
        return "\n".join(lines)

    # ── Producir ─────────────────────────────────────────────────────────────
    if any(kw in p for kw in ["producir receta", "fabricar", "producir", "hacer receta"]):
        recetas = db.listar_recetas()
        receta_found = None
        for r in recetas:
            if r["name"].lower() in p:
                receta_found = r
                break
        if not receta_found:
            return "⚠️ No reconocí la receta. Usa: *producir receta [nombre] [N lotes]*"

        lotes_m = re.search(r'(\d+(?:\.\d+)?)\s*lote', p)
        lotes = float(lotes_m.group(1)) if lotes_m else 1.0

        c = db.calcular_costo_receta(receta_found["id"], lotes=lotes)
        if not c["stock_suficiente"]:
            lines = [f"⚠️ *Stock insuficiente para {lotes} lote(s) de {receta_found['name']}:*\n"]
            for ing in c["ingredientes"]:
                if ing["stock_actual"] < ing["qty_necesaria"]:
                    falta = ing["qty_necesaria"] - ing["stock_actual"]
                    lines.append(f"  • {ing['name']}: faltan {falta:.1f} {ing['unit']}")
            return "\n".join(lines)

        try:
            resultado = db.producir(receta_found["id"], cantidad_lotes=lotes)
            lines = [
                f"✅ *Producción completada — {resultado['recipe_name']}*\n",
                f"  Lotes producidos: {resultado['lotes']}",
                f"  Output generado: {resultado['output_qty']:.1f} unidades",
                f"  COGS real: ${resultado['costo_real']:.2f}",
                f"  Orden #{resultado['order_id']}\n",
                "  *Ingredientes consumidos:*",
            ]
            for ing in resultado["ingredientes_consumidos"]:
                lines.append(
                    f"  • {ing['name']}: {ing['cantidad']:.1f} u "
                    f"@ ${ing['costo_unitario']:.4f} = ${ing['costo_total']:.2f}"
                )
            return "\n".join(lines)
        except ValueError as e:
            return f"⚠️ {str(e)}"

    # ── COGS del período ─────────────────────────────────────────────────────
    if any(kw in p for kw in ["cogs", "costo de producción", "costo de produccion"]):
        dias = 7 if "semana" in p else 30
        cogs = db.get_cogs_periodo(dias=dias)
        if cogs["lotes_totales"] == 0:
            return f"📊 Sin producción registrada en los últimos {dias} días."
        lines = [
            f"🏭 *COGS — últimos {dias} días:*\n",
            f"  Lotes totales: {cogs['lotes_totales']:.1f}",
            f"  Costo total: ${cogs['costo_total']:.2f}\n",
            "  *Por receta:*",
        ]
        for r in cogs["por_receta"]:
            lines.append(f"  • {r['name']}: {r['lotes']:.1f} lotes — ${r['costo']:.2f}")
        return "\n".join(lines)

    # ── Historial ────────────────────────────────────────────────────────────
    if any(kw in p for kw in ["historial de producción", "historial de produccion", "últimas producciones", "ultimas producciones", "qué produjimos", "que produjimos"]):
        historial = db.get_historial_produccion(dias=30)
        if not historial:
            return "📋 Sin historial de producción en los últimos 30 días."
        lines = ["🏭 *Historial de producción (30 días):*\n"]
        for o in historial[:10]:
            lines.append(
                f"  • [{o['fecha'][:10]}] {o['recipe_name']} × {o['cantidad_lotes']:.1f} lotes "
                f"— COGS: ${o['costo_total_real']:.2f} | Output: {o['output_qty']:.1f} u"
            )
        return "\n".join(lines)

    # ── Help ─────────────────────────────────────────────────────────────────
    return (
        "🏭 *Manufactura Imperial* — comandos disponibles:\n\n"
        "• *listar recetas*\n"
        "• *costo de receta [nombre] [N lotes]*\n"
        "• *producir receta [nombre] [N lotes]*\n"
        "• *cogs del mes* / *cogs de la semana*\n"
        "• *historial de producción*"
    )
