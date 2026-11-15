"""Normaliza números de México: WhatsApp manda 521… o 52…, pey pide 10 dígitos."""

import re


def solo_digitos(valor: str) -> str:
    return re.sub(r"\D", "", valor or "")


def a_telefono10(valor: str) -> str:
    digitos = solo_digitos(valor)
    if len(digitos) < 10:
        raise ValueError("El teléfono necesita 10 dígitos.")
    return digitos[-10:]


def wa_id_desde(telefono10: str, preferido: str | None = None) -> str:
    if preferido and solo_digitos(preferido).endswith(telefono10):
        return solo_digitos(preferido)
    return "521" + telefono10
