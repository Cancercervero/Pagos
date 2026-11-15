"""Montos: centavos en la base, pesos solo al hablar con pey o con la persona."""


def pesos_a_centavos(pesos) -> int:
    return int(round(float(pesos) * 100))


def centavos_a_pesos(centavos: int) -> float:
    return round(int(centavos) / 100, 2)


def fmt_mxn(centavos: int) -> str:
    return f"${centavos_a_pesos(centavos):,.2f}"
