"""Memoria de gasto de la persona. No se mezcla con el libro del negocio."""

from app.db import ahora_iso, conectar, filas, transaccion
from app.dinero import fmt_mxn, pesos_a_centavos

LEYENDA = "Esto es una guía para ver tus hábitos. No es asesoría de inversión ni una recomendación de comprar un instrumento."


def registrar(contacto_id: int, monto_pesos: float, concepto: str, categoria: str | None = None) -> str:
    centavos = pesos_a_centavos(monto_pesos)
    if centavos <= 0:
        raise ValueError("El gasto tiene que ser mayor a cero.")
    concepto = concepto.strip()
    categoria = (categoria or _categoria(concepto)).strip()
    with transaccion() as conn:
        conn.execute(
            """INSERT INTO gastos_personales (contacto_id, monto_centavos, concepto, categoria, creado_en)
               VALUES (?, ?, ?, ?, ?)""",
            (contacto_id, centavos, concepto, categoria, ahora_iso()),
        )
    return f"Anoté {fmt_mxn(centavos)} en {concepto}. Es tu memoria, no entra al libro del negocio."


def poner_meta(contacto_id: int, nombre: str, meta_pesos: float) -> str:
    meta = pesos_a_centavos(meta_pesos)
    if meta <= 0:
        raise ValueError("La meta tiene que ser mayor a cero.")
    nombre = nombre.strip() or "mi meta"
    with transaccion() as conn:
        conn.execute(
            """INSERT INTO metas_ahorro (contacto_id, nombre, meta_centavos, creado_en)
               VALUES (?, ?, ?, ?)""",
            (contacto_id, nombre, meta, ahora_iso()),
        )
    semanal = max(meta // 8, 1)
    return (
        f"Meta: {nombre}, {fmt_mxn(meta)}.\n"
        f"Si apartas {fmt_mxn(semanal)} a la semana, en 8 semanas llegas sin tocar el resto."
    )


def consumo(contacto_id: int) -> str:
    with conectar() as conn:
        rows = filas(
            conn.execute(
                """SELECT folio, total_centavos, pagado_centavos, estado, partidas_json
                   FROM cotizaciones WHERE contacto_id=? ORDER BY id DESC LIMIT 8""",
                (contacto_id,),
            ).fetchall()
        )
    if not rows:
        return "Todavía no tienes consumos con este negocio."
    lineas = ["Tu consumo aquí:"]
    for r in rows:
        lineas.append(f"• {r['folio']} — {r['estado']} — pagado {fmt_mxn(r['pagado_centavos'])} de {fmt_mxn(r['total_centavos'])}")
    return "\n".join(lineas)


def como_gasto(contacto_id: int) -> str:
    with conectar() as conn:
        gastos = filas(
            conn.execute(
                "SELECT monto_centavos, categoria FROM gastos_personales WHERE contacto_id=?",
                (contacto_id,),
            ).fetchall()
        )
        meta = conn.execute(
            "SELECT * FROM metas_ahorro WHERE contacto_id=? ORDER BY id DESC LIMIT 1",
            (contacto_id,),
        ).fetchone()
    if not gastos and not meta:
        return "Todavía no anoto gastos tuyos. Dime, por ejemplo: gasté 80 en café.\n" + LEYENDA
    total = sum(g["monto_centavos"] for g in gastos)
    por_cat: dict[str, int] = {}
    for g in gastos:
        clave = g["categoria"] or "otros"
        por_cat[clave] = por_cat.get(clave, 0) + g["monto_centavos"]
    lineas = [f"Llevas {fmt_mxn(total)} anotados."]
    if por_cat:
        top = max(por_cat, key=por_cat.get)
        lineas.append(f"Donde más se va: {top}, {fmt_mxn(por_cat[top])}.")
        if total and por_cat[top] * 100 >= total * 40:
            tope = max(por_cat[top] // 4, 1)
            lineas.append(f"Esa categoría se está comiendo el mes. Un tope de {fmt_mxn(tope)} por semana te deja aire para lo demás.")
    if meta:
        falta = max(int(meta["meta_centavos"]) - int(meta["apartado_centavos"]), 0)
        semanal = max(falta // 8, 1)
        lineas.append(f"Tu meta «{meta['nombre']}» pide {fmt_mxn(falta)} más.")
        lineas.append(f"Apartar {fmt_mxn(semanal)} a la semana la acerca sin pedir un préstamo ni un producto de inversión.")
    else:
        lineas.append("Si tienes algo que quieras comprar después, dime: quiero ahorrar 500 para unas vacaciones.")
    lineas.append(LEYENDA)
    return "\n".join(lineas)


def _categoria(concepto: str) -> str:
    t = concepto.lower()
    if any(p in t for p in ("cafe", "café", "comida", "uber", "antojo", "cine")):
        return "antojos"
    if any(p in t for p in ("renta", "luz", "agua", "gas")):
        return "fijos"
    return "otros"
