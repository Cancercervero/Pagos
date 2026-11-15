"""
Isabel — Analista de Datos del Salón.

No solo cuenta. Explica. Predice. Advierte.
Convierte los números de Enzo, Tomás y Verónica en reportes que la dueña entiende
sin necesidad de saber de contabilidad ni de inventarios.

Sus respuestas tienen narrativa: no "stock: 3", sino
"el tinte rojo se acaba en 2 días al ritmo actual — Aldo debería pedir hoy."
"""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("Isabel")

_PERSONALIDAD = (
    "Soy Isabel. Me especializo en convertir datos en decisiones. "
    "No te doy tablas, te digo qué está pasando, por qué importa y qué hacer. "
    "Los números son mi idioma, pero te hablo en el tuyo."
)

_PROMPT_NARRATIVA = """Eres Isabel, analista de datos de un salón de belleza.
Tienes datos de inventario, consumo y finanzas del salón.
Tu trabajo es explicar en lenguaje simple y directo qué está pasando,
qué tendencias hay y qué debería hacer la dueña.
NO uses tablas ni listas. Escribe como si hablaras con ella en persona.
Máximo 6 oraciones. En español. Sé específica con números."""

_PROMPT_PREDICCION = """Eres Isabel, analista predictiva de inventario de salón.
Con base en el historial de consumo, calcula cuántos días le quedan a cada producto.
Si un producto se acaba en menos de 7 días, marca como URGENTE.
Si en menos de 14 días, marca como PRONTO.
Responde en español, directo, solo los productos en riesgo."""

_PROMPT_SALUD = """Eres Isabel, analista financiera de un salón de belleza.
Evalúa la salud financiera del negocio con estos datos.
Dame un diagnóstico en 3 partes:
1. Estado actual (una oración)
2. Riesgo principal (una oración)
3. Recomendación concreta (una oración)
Usa lenguaje de dueña de negocio, no de contador."""


def _db(db_path=None):
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def _llm(prompt: str, system: str, tokens: int = 400) -> str:
    try:
        from host_engine.cerberus_core.llm_router import ask_llm
        return ask_llm(prompt, system=system, max_tokens=tokens)
    except Exception as e:
        return f"[Isabel] No pude analizar: {e}"


# ── Velocidad de rotación ─────────────────────────────────────────────────────

def dias_de_stock(db_path=None) -> list[dict]:
    """
    Para cada producto, calcula cuántos días de stock quedan
    al ritmo de consumo actual (últimos 14 días).
    """
    db = _db(db_path)
    productos = db.listar_productos()
    desde_14 = (datetime.now() - timedelta(days=14)).isoformat()
    resultado = []

    conn = db._conn()
    for prod in productos:
        stock_actual = db.get_stock_actual(prod["id"])

        # Consumo promedio diario últimos 14 días
        row = conn.execute("""
            SELECT COALESCE(SUM(tx.quantity), 0) as total_salida
            FROM inventory_tx tx
            JOIN stock_items si ON si.id = tx.stock_item_id
            WHERE si.part_id = ? AND tx.tx_type = 'SALIDA' AND tx.tx_date >= ?
        """, (prod["id"], desde_14)).fetchone()

        total_salida = float(row["total_salida"])
        consumo_diario = total_salida / 14.0 if total_salida > 0 else 0

        dias = None
        urgencia = "ok"
        if consumo_diario > 0:
            dias = stock_actual / consumo_diario
            if dias < 7:
                urgencia = "urgente"
            elif dias < 14:
                urgencia = "pronto"

        resultado.append({
            "id": prod["id"],
            "nombre": prod["name"],
            "unidad": prod["unit"],
            "stock_actual": stock_actual,
            "consumo_diario": round(consumo_diario, 2),
            "dias_restantes": round(dias, 1) if dias is not None else None,
            "urgencia": urgencia,
        })

    conn.close()
    return sorted(resultado, key=lambda x: x["dias_restantes"] if x["dias_restantes"] is not None else 9999)


def productos_en_riesgo(db_path=None) -> list[dict]:
    """Solo los que tienen menos de 14 días de stock."""
    return [p for p in dias_de_stock(db_path) if p["urgencia"] in ("urgente", "pronto")]


# ── Tendencias ────────────────────────────────────────────────────────────────

def tendencias(db_path=None) -> dict:
    """
    Compara consumo semana actual vs semana anterior por producto.
    Detecta qué sube, qué baja, qué es dead stock.
    """
    db = _db(db_path)
    ahora = datetime.now()
    sem_actual_desde = (ahora - timedelta(days=7)).isoformat()
    sem_ant_desde = (ahora - timedelta(days=14)).isoformat()
    sem_ant_hasta = (ahora - timedelta(days=7)).isoformat()

    conn = db._conn()

    def _consumo_periodo(desde, hasta=None):
        q = """
            SELECT si.part_id, COALESCE(SUM(tx.quantity),0) as qty
            FROM inventory_tx tx
            JOIN stock_items si ON si.id = tx.stock_item_id
            WHERE tx.tx_type='SALIDA' AND tx.tx_date >= ?
        """
        params = [desde]
        if hasta:
            q += " AND tx.tx_date < ?"
            params.append(hasta)
        q += " GROUP BY si.part_id"
        rows = conn.execute(q, params).fetchall()
        return {r["part_id"]: float(r["qty"]) for r in rows}

    actual = _consumo_periodo(sem_actual_desde)
    anterior = _consumo_periodo(sem_ant_desde, sem_ant_hasta)
    conn.close()

    todos_ids = set(actual.keys()) | set(anterior.keys())
    productos = {p["id"]: p["name"] for p in db.listar_productos()}

    subiendo, bajando, sin_movimiento, nuevo_consumo = [], [], [], []

    for pid in todos_ids:
        nombre = productos.get(pid, f"ID:{pid}")
        a = actual.get(pid, 0)
        ant = anterior.get(pid, 0)
        if ant == 0 and a > 0:
            nuevo_consumo.append({"nombre": nombre, "qty": a})
        elif a == 0 and ant > 0:
            sin_movimiento.append({"nombre": nombre, "qty_ant": ant})
        elif a > ant * 1.2:
            subiendo.append({"nombre": nombre, "actual": a, "anterior": ant, "pct": round((a-ant)/ant*100)})
        elif a < ant * 0.8 and ant > 0:
            bajando.append({"nombre": nombre, "actual": a, "anterior": ant, "pct": round((ant-a)/ant*100)})

    return {
        "subiendo": sorted(subiendo, key=lambda x: -x["pct"]),
        "bajando": sorted(bajando, key=lambda x: -x["pct"]),
        "sin_movimiento": sin_movimiento,
        "nuevo_consumo": nuevo_consumo,
    }


# ── Salud financiera ──────────────────────────────────────────────────────────

def salud_financiera(db_path=None, moneda: str = "$") -> str:
    """Isabel evalúa la salud del negocio y da diagnóstico narrativo."""
    db = _db(db_path)
    flujo_30 = db.get_flujo_periodo(dias=30)
    flujo_7  = db.get_flujo_periodo(dias=7)
    ranking  = db.get_ranking_productos()
    alertas  = db.get_alertas_stock_bajo()

    datos = (
        f"Últimos 30 días:\n"
        f"  Compras (costo): {moneda}{flujo_30['costo_compras']:.2f}\n"
        f"  Salidas (unidades): {flujo_30['salidas_qty']:.0f}\n"
        f"  Ganancia bruta estimada: {moneda}{flujo_30['ganancia_bruta']:.2f}\n"
        f"Última semana:\n"
        f"  Compras: {moneda}{flujo_7['costo_compras']:.2f}\n"
        f"  Salidas: {flujo_7['salidas_qty']:.0f} u\n"
        f"Márgenes:\n"
        f"  Mejor: {ranking[0]['name']} {ranking[0]['margen_pct']:.1f}%\n" if ranking else ""
        f"  Peor: {ranking[-1]['name']} {ranking[-1]['margen_pct']:.1f}%\n" if ranking else ""
        f"Productos bajo mínimo: {len(alertas)}"
    )

    return _llm(datos, system=_PROMPT_SALUD, tokens=300)


# ── Reportes narrativos ───────────────────────────────────────────────────────

def reporte_semanal(db_path=None, moneda: str = "$") -> str:
    """Reporte completo de la semana en lenguaje de dueña."""
    db = _db(db_path)
    flujo = db.get_flujo_periodo(dias=7)
    riesgo = productos_en_riesgo(db_path)
    tend = tendencias(db_path)
    ranking = db.get_ranking_productos()

    datos = (
        f"Semana actual:\n"
        f"  Costo de compras: {moneda}{flujo['costo_compras']:.2f}\n"
        f"  Unidades salidas: {flujo['salidas_qty']:.0f}\n"
        f"  Ganancia bruta: {moneda}{flujo['ganancia_bruta']:.2f}\n\n"
        f"Productos en riesgo de agotarse ({len(riesgo)}): "
        + ", ".join([f"{p['nombre']} ({p['dias_restantes']:.0f}d)" for p in riesgo[:4]]) + "\n\n"
        f"Más consumidos esta semana: "
        + ", ".join([f"{p['nombre']}" for p in tend['subiendo'][:3]]) + "\n"
        f"Sin movimiento: "
        + ", ".join([p['nombre'] for p in tend['sin_movimiento'][:3]]) + "\n\n"
        f"Mejor margen: {ranking[0]['name']} {ranking[0]['margen_pct']:.1f}%" if ranking else ""
    )

    narrativa = _llm(datos, system=_PROMPT_NARRATIVA, tokens=500)

    # Sección predicciones
    pred_lines = []
    urgentes = [p for p in riesgo if p["urgencia"] == "urgente"]
    prontos  = [p for p in riesgo if p["urgencia"] == "pronto"]
    if urgentes:
        pred_lines.append("🔴 *URGENTE — menos de 7 días:*")
        for p in urgentes:
            pred_lines.append(f"  • {p['nombre']}: ~{p['dias_restantes']:.0f} días ({p['consumo_diario']:.1f} {p['unidad']}/día)")
    if prontos:
        pred_lines.append("🟡 *Pronto — menos de 14 días:*")
        for p in prontos:
            pred_lines.append(f"  • {p['nombre']}: ~{p['dias_restantes']:.0f} días")

    partes = [
        f"📊 *Isabel — Reporte Semanal:*\n",
        narrativa,
    ]
    if pred_lines:
        partes.append("\n" + "\n".join(pred_lines))

    return "\n".join(partes)


def reporte_isabel(db_path=None) -> str:
    """Versión corta para el reporte matutino de Donna."""
    riesgo = productos_en_riesgo(db_path)
    tend = tendencias(db_path)

    lines = ["📊 *Isabel:*"]
    if riesgo:
        urgentes = [p for p in riesgo if p["urgencia"] == "urgente"]
        if urgentes:
            lines.append(f"  🔴 Urgente: {', '.join([p['nombre'] for p in urgentes[:2]])}")
        prontos = [p for p in riesgo if p["urgencia"] == "pronto"]
        if prontos:
            lines.append(f"  🟡 Pronto: {', '.join([p['nombre'] for p in prontos[:2]])}")
    else:
        lines.append("  ✅ Sin riesgo de quiebre esta semana")

    if tend["subiendo"]:
        top = tend["subiendo"][0]
        lines.append(f"  📈 Sube: {top['nombre']} +{top['pct']}% vs semana pasada")
    if tend["sin_movimiento"]:
        lines.append(f"  💤 Sin movimiento: {', '.join([p['nombre'] for p in tend['sin_movimiento'][:2]])}")

    return "\n".join(lines)


# ── Predicciones y estacionalidad ─────────────────────────────────────────────

def fechas_agotamiento(db_path=None) -> list[dict]:
    """
    Fecha concreta en que se agota cada producto al ritmo actual.
    Solo los que tienen menos de 30 días de stock.
    """
    dias = dias_de_stock(db_path)
    resultado = []
    hoy = datetime.now()
    for p in dias:
        if p["dias_restantes"] is None:
            continue
        if p["dias_restantes"] > 30:
            continue
        fecha_agotamiento = hoy + timedelta(days=p["dias_restantes"])
        resultado.append({
            **p,
            "fecha_agotamiento": fecha_agotamiento.strftime("%d %b"),
            "fecha_iso":         fecha_agotamiento.strftime("%Y-%m-%d"),
        })
    return sorted(resultado, key=lambda x: x["dias_restantes"])


def consumo_mensual(db_path=None, meses: int = 6) -> list[dict]:
    """
    Consumo de cada producto mes a mes, últimos N meses.
    Base para detectar tendencias estacionales.
    """
    import sqlite3
    db = _db(db_path)
    conn = sqlite3.connect(db.db_path)
    conn.row_factory = sqlite3.Row

    hoy = datetime.now()
    resultado = []

    for i in range(meses):
        mes_dt  = hoy.replace(day=1) - timedelta(days=i * 30)
        desde   = mes_dt.strftime("%Y-%m-01")
        # último día del mes siguiente
        if mes_dt.month == 12:
            hasta_dt = mes_dt.replace(year=mes_dt.year + 1, month=1, day=1)
        else:
            hasta_dt = mes_dt.replace(month=mes_dt.month + 1, day=1)
        hasta = hasta_dt.strftime("%Y-%m-%d")

        rows = conn.execute("""
            SELECT p.name, p.unit, COALESCE(SUM(tx.quantity), 0) as qty
            FROM inventory_tx tx
            JOIN stock_items si ON si.id = tx.stock_item_id
            JOIN parts p ON p.id = si.part_id
            WHERE tx.tx_type = 'SALIDA' AND tx.tx_date >= ? AND tx.tx_date < ?
            GROUP BY p.id
            ORDER BY qty DESC
        """, (desde, hasta)).fetchall()

        resultado.append({
            "mes":      mes_dt.strftime("%b %Y"),
            "mes_num":  mes_dt.month,
            "productos": [{"nombre": r["name"], "unidad": r["unit"], "cantidad": float(r["qty"])} for r in rows],
        })

    conn.close()
    return list(reversed(resultado))  # cronológico


def reporte_predictivo(db_path=None) -> str:
    """
    Isabel predice: cuándo se acota qué, qué sube/baja por temporada.
    Este es el reporte que Peso necesita para planear compras del mes.
    """
    agotamiento = fechas_agotamiento(db_path)
    historico   = consumo_mensual(db_path, meses=4)

    lines = ["🔮 *Isabel — Predicciones del mes:*\n"]

    # Fechas de agotamiento
    if agotamiento:
        urgentes = [p for p in agotamiento if p["urgencia"] == "urgente"]
        prontos  = [p for p in agotamiento if p["urgencia"] == "pronto"]
        otros    = [p for p in agotamiento if p["urgencia"] == "ok"]

        if urgentes:
            lines.append("🔴 *Se acaban esta semana:*")
            for p in urgentes:
                lines.append(f"  • {p['nombre']}: {p['fecha_agotamiento']} ({p['consumo_diario']:.1f} {p['unidad']}/día)")
        if prontos:
            lines.append("🟡 *Se acaban en 2 semanas:*")
            for p in prontos:
                lines.append(f"  • {p['nombre']}: {p['fecha_agotamiento']}")
        if otros:
            lines.append("🟢 *Este mes (pedir pronto):*")
            for p in otros[:4]:
                lines.append(f"  • {p['nombre']}: ~{p['fecha_agotamiento']}")
    else:
        lines.append("✅ Todos los productos tienen stock para más de 30 días.")

    # Tendencia mensual — qué se está moviendo más/menos vs mes anterior
    if len(historico) >= 2:
        mes_actual  = {p["nombre"]: p["cantidad"] for p in historico[-1]["productos"]}
        mes_anterior = {p["nombre"]: p["cantidad"] for p in historico[-2]["productos"]}

        subiendo = []
        bajando  = []
        for nombre, qty_actual in mes_actual.items():
            qty_ant = mes_anterior.get(nombre, 0)
            if qty_ant > 0:
                delta_pct = (qty_actual - qty_ant) / qty_ant * 100
                if delta_pct > 20:
                    subiendo.append((nombre, delta_pct, qty_actual))
                elif delta_pct < -20:
                    bajando.append((nombre, delta_pct, qty_actual))

        if subiendo or bajando:
            lines.append(f"\n📊 *Tendencia vs {historico[-2]['mes']}:*")
            for nombre, pct, qty in sorted(subiendo, key=lambda x: -x[1])[:3]:
                lines.append(f"  📈 {nombre}: +{pct:.0f}% ({qty:.0f} u)")
            for nombre, pct, qty in sorted(bajando, key=lambda x: x[1])[:3]:
                lines.append(f"  📉 {nombre}: {pct:.0f}% ({qty:.0f} u)")

    # Contexto estacional — comparar con mismo mes año anterior si hay datos
    if len(historico) >= 4:
        meses_altos = {}
        for entrada in historico:
            for p in entrada["productos"]:
                if p["cantidad"] > 0:
                    key = (p["nombre"], entrada["mes_num"])
                    meses_altos[key] = meses_altos.get(key, 0) + p["cantidad"]

        # Top productos que tienen un mes pico claro
        picos = []
        productos_vistos = set(p["nombre"] for e in historico for p in e["productos"])
        for prod in productos_vistos:
            consumos_por_mes = {
                e["mes_num"]: next((p["cantidad"] for p in e["productos"] if p["nombre"] == prod), 0)
                for e in historico
            }
            if not consumos_por_mes:
                continue
            mes_pico = max(consumos_por_mes, key=lambda m: consumos_por_mes[m])
            max_qty  = consumos_por_mes[mes_pico]
            avg_qty  = sum(consumos_por_mes.values()) / len(consumos_por_mes)
            if max_qty > avg_qty * 1.5 and max_qty > 0:
                picos.append((prod, mes_pico, max_qty))

        if picos:
            lines.append("\n🌸 *Productos estacionales detectados:*")
            mes_nombres = {1:"Ene",2:"Feb",3:"Mar",4:"Abr",5:"May",6:"Jun",
                          7:"Jul",8:"Ago",9:"Sep",10:"Oct",11:"Nov",12:"Dic"}
            for prod, mes_num, qty in sorted(picos, key=lambda x: -x[2])[:3]:
                lines.append(f"  • {prod}: pico en {mes_nombres.get(mes_num,'?')} ({qty:.0f} u)")

    return "\n".join(lines)
