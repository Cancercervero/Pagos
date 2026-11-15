"""Estimación informativa de IVA e ISR RESICO. No es una declaración."""

from app.config import negocio
from app.departamentos.libro import resumen
from app.dinero import centavos_a_pesos, fmt_mxn

LEYENDA = "Estimación informativa, no sustituye a tu contador ni al SAT."


def estimar(periodo: str = "mes") -> dict:
    datos = resumen(periodo)
    tasa_iva = float(negocio().get("iva", 0.16))
    ingresos = [m for m in datos["movimientos"] if m["tipo"] == "ingreso"]
    gastos_cfdi = [m for m in datos["movimientos"] if m["tipo"] == "gasto" and m["con_factura"]]
    base_ingresos = 0
    iva_trasladado = 0
    for m in ingresos:
        base, iva = _partir(m["monto_centavos"], tasa_iva)
        base_ingresos += base
        iva_trasladado += iva
    iva_acreditable = 0
    for m in gastos_cfdi:
        _, iva = _partir(m["monto_centavos"], tasa_iva)
        iva_acreditable += iva
    iva_neto = iva_trasladado - iva_acreditable
    base_pesos = centavos_a_pesos(base_ingresos)
    tasa = _tasa_resico(base_pesos)
    isr = int(round(base_ingresos * tasa))
    return {
        "periodo": periodo,
        "base_ingresos_centavos": base_ingresos,
        "iva_trasladado_centavos": iva_trasladado,
        "iva_acreditable_centavos": iva_acreditable,
        "iva_neto_centavos": iva_neto,
        "tasa_isr": tasa,
        "isr_centavos": isr,
    }


def texto_estimacion(datos: dict | None = None, periodo: str = "mes") -> str:
    datos = datos or estimar(periodo)
    return "\n".join(
        [
            f"IVA trasladado: {fmt_mxn(datos['iva_trasladado_centavos'])}",
            f"IVA acreditable (gastos con CFDI): {fmt_mxn(datos['iva_acreditable_centavos'])}",
            f"IVA neto estimado: {fmt_mxn(datos['iva_neto_centavos'])}",
            f"ISR RESICO estimado ({datos['tasa_isr'] * 100:.2f}% sobre ingresos sin IVA): {fmt_mxn(datos['isr_centavos'])}",
            LEYENDA,
        ]
    )


def _partir(total_centavos: int, tasa_iva: float) -> tuple[int, int]:
    base = int(round(total_centavos / (1 + tasa_iva)))
    return base, total_centavos - base


def _tasa_resico(base_pesos: float) -> float:
    tabla = negocio().get("isr_resico_pf_mensual") or []
    for tramo in tabla:
        if base_pesos <= float(tramo["hasta"]):
            return float(tramo["tasa"])
    if tabla:
        return float(tabla[-1]["tasa"])
    return 0.01
