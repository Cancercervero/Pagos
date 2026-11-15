"""Al cobrar, aparta IVA e ISR. Es una estimación: el dueño no calcula y el SAT no se entera solo."""

import json

from app.departamentos.impuestos import LEYENDA, _tasa_resico
from app.db import ahora_iso
from app.dinero import centavos_a_pesos, fmt_mxn


def apartar_en_tx(conn, pago_id: int, monto_centavos: int, cot: dict | None) -> str:
    from app.departamentos.almacen import costo_de_salida
    from app.departamentos.cotizaciones import es_bienes

    costo_lotes = costo_de_salida(conn, cot["id"]) if cot and es_bienes(cot) else 0
    plan = calcular(monto_centavos, cot, costo_lotes or None)
    for tipo, centavos in (("apartado_iva", plan["iva"]), ("apartado_isr", plan["isr"])):
        if centavos <= 0:
            continue
        conn.execute(
            """INSERT INTO movimientos (tipo, monto_centavos, concepto, categoria, pago_id, con_factura, fecha)
               VALUES (?, ?, ?, 'apartado', ?, 0, ?)""",
            (tipo, centavos, plan["concepto"], pago_id, ahora_iso()),
        )
    return plan["texto"]


def calcular(monto_centavos: int, cot: dict | None, costo_lotes: int | None = None) -> dict:
    monto = max(int(monto_centavos), 0)
    iva = 0
    costo = 0
    base_servicios = 0
    base_bienes = 0
    if cot and monto:
        total = max(int(cot["total_centavos"]), 1)
        fraccion = min(monto / total, 1)
        for p in json.loads(cot["partidas_json"]):
            base = int(p["precio_unit_centavos"]) * int(p["cantidad"])
            tasa = float(p.get("tasa_iva", 0.16))
            giro = p.get("giro") or "servicios"
            porcion = int(round(base * fraccion))
            iva += int(round(base * tasa * fraccion))
            if costo_lotes is None:
                costo += int(round(int(p.get("costo_centavos") or 0) * fraccion))
            if giro == "bienes":
                base_bienes += porcion
            else:
                base_servicios += porcion
        if costo_lotes is not None:
            costo = int(round(costo_lotes * fraccion))
    elif monto:
        base_servicios, iva = _con_iva(monto, 0.16)
    tasa = _tasa_resico(centavos_a_pesos(base_servicios + max(base_bienes - costo, 0)))
    isr_servicios = int(round(base_servicios * tasa))
    isr_bienes = int(round(max(base_bienes - costo, 0) * tasa))
    isr = isr_servicios + isr_bienes
    disponible = monto - iva - isr
    lineas = [
        f"Apartado para el SAT, estimación: IVA {fmt_mxn(iva)}, ISR {fmt_mxn(isr)}.",
        f"Puedes usar {fmt_mxn(disponible)}.",
    ]
    if base_bienes:
        margen = base_bienes - costo - isr_bienes
        lineas.insert(1, f"Costo {fmt_mxn(costo)}. Margen {fmt_mxn(margen)}.")
    lineas.append(LEYENDA)
    return {
        "iva": iva,
        "isr": isr,
        "disponible": disponible,
        "concepto": "Apartado de impuestos",
        "texto": " ".join(lineas),
    }


def _con_iva(total: int, tasa: float) -> tuple[int, int]:
    base = int(round(total / (1 + tasa)))
    return base, total - base
