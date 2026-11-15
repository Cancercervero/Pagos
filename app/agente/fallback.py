"""Si no hay modelo, un ruteo corto cubre el recorrido de la demo."""

import re
import unicodedata

from app.agente import herramientas
from app.departamentos import citas, cotizaciones


def _plano(texto: str) -> str:
    base = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", base).strip().lower()


async def responder(texto: str, contacto: dict) -> str | None:
    t = _plano(texto)
    if not t:
        return herramientas.MENU
    if t in {"hola", "buenas", "menu", "menú", "hey"} or t.startswith("hola"):
        if "cotiz" not in t and not _servicios_en(t):
            return "Hola. Puedo cotizarte, apartar un horario y cobrarte por CoDi.\n" + herramientas.MENU
    if ("jalate" in t or "jala eso" in t or "activa el agente" in t) and "cotiz" not in t and not _servicios_en(t):
        return "Listo. Este número ya tiene el agente activo: cotizar, apartar y cobrar por CoDi.\n" + herramientas.MENU
    if "mis citas" in t or "mi agenda" in t:
        return await herramientas.ejecutar("mis_citas", {}, contacto)
    if "como gasto" in t or "mis gastos" in t or "mi consumo" in t:
        if "consumo" in t and "gasto" not in t:
            return await herramientas.ejecutar("mi_consumo", {}, contacto)
        return await herramientas.ejecutar("como_gasto", {}, contacto)
    if "ahorrar" in t or "ahorro" in t:
        m = re.search(r"(\d+(?:\.\d+)?)\s+para\s+(.+)", t)
        if not m:
            return "Dime la meta y el monto, por ejemplo: quiero ahorrar 500 para unas vacaciones."
        return await herramientas.ejecutar("meta_ahorro", {"monto": float(m.group(1)), "nombre": m.group(2).strip()}, contacto)
    if contacto.get("rol") != "dueno" and (t.startswith("gaste") or "gaste " in t):
        m = re.search(r"gaste\s+(\d+(?:\.\d+)?)\s+en\s+(.+)", t)
        if not m:
            return "Dime cuánto y en qué, por ejemplo: gasté 80 en café."
        return await herramientas.ejecutar("registrar_gasto_personal", {"monto": float(m.group(1)), "concepto": m.group(2).strip()}, contacto)
    if "catalogo" in t and "producto" in t:
        return cotizaciones.listar_tienda()
    if "catalogo" in t or t in {"1", "ver catalogo"}:
        return await herramientas.ejecutar("ver_catalogo", {}, contacto)
    if contacto.get("rol") == "dueno" and ("como voy" in t or "este mes" in t or "resumen" in t):
        fin = await herramientas.ejecutar("resumen_finanzas", {"periodo": "mes"}, contacto)
        imp = await herramientas.ejecutar("estimar_impuestos", {}, contacto)
        return fin + "\n" + imp
    if contacto.get("rol") == "dueno" and (t.startswith("gaste") or "gaste " in t):
        m = re.search(r"gaste\s+(\d+(?:\.\d+)?)\s+en\s+(.+)", t)
        if not m:
            return "Dime cuánto y en qué, por ejemplo: gasté 200 en tinte, proveedor X."
        return await herramientas.ejecutar(
            "registrar_gasto",
            {"monto": float(m.group(1)), "concepto": m.group(2).strip(), "con_factura": "factura" in t or "cfdi" in t},
            contacto,
        )
    if contacto.get("rol") == "dueno" and ("cobrale" in t or "cobra el" in t or "el resto" in t or "el saldo" in t):
        folio = _folio_en(t) or _folio_abierto()
        if not folio:
            return "Dime el folio al que le cobro el saldo."
        return await herramientas.ejecutar("cobrar_saldo", {"folio": folio, "metodo": "push"}, contacto)
    if contacto.get("rol") == "dueno" and t.startswith("factura"):
        m = re.search(r"factura\s+(\w+)\s+(\d+)\s+piezas?\s+a\s+(\d+(?:\.\d+)?)", t)
        if not m:
            return await herramientas.ejecutar("cargar_factura", {"nota": texto}, contacto)
        return await herramientas.ejecutar(
            "cargar_factura",
            {"sku": m.group(1), "nombre": m.group(1), "cantidad": int(m.group(2)), "costo": float(m.group(3))},
            contacto,
        )
    if contacto.get("rol") == "dueno" and ("existencia" in t or "almacen" in t):
        return await herramientas.ejecutar("existencias", {}, contacto)
    if contacto.get("rol") == "dueno" and "surtir" in t:
        return await herramientas.ejecutar("por_surtir", {}, contacto)
    servicios = _servicios_en(t)
    bienes = _bienes_en(t)
    if bienes and servicios:
        return "El servicio y la mercancía van en cuentas distintas. Pide uno por mensaje."
    if bienes:
        partidas = [{"servicio_id": s, "cantidad": 1} for s in bienes]
        return await herramientas.ejecutar("crear_cotizacion", {"partidas": partidas}, contacto)
    if "cotiz" in t or servicios:
        if not servicios:
            return await herramientas.ejecutar("ver_catalogo", {}, contacto)
        partidas = [{"servicio_id": s, "cantidad": 1} for s in servicios]
        return await herramientas.ejecutar("crear_cotizacion", {"partidas": partidas}, contacto)
    if any(p in t for p in ("lo quiero", "va,", " va", "acepto", "aparte", "horario", "de acuerdo")) or t in {"va", "si", "ok", "sale"}:
        cot = cotizaciones.ultima_de(contacto["id"])
        if cot and cotizaciones.es_bienes(cot):
            return await herramientas.ejecutar("cobrar_mercancia", {}, contacto)
        return await herramientas.ejecutar("ver_horarios", {}, contacto)
    hora = _hora(t)
    if hora is not None or "primero" in t or "segundo" in t or "tercero" in t:
        inicio = None
        if "primero" in t or t == "1":
            libres = citas.huecos_libres(3)
            inicio = libres[0] if libres else None
        elif "segundo" in t:
            libres = citas.huecos_libres(3)
            inicio = libres[1] if len(libres) > 1 else None
        elif "tercero" in t or "tercer" in t:
            libres = citas.huecos_libres(3)
            inicio = libres[2] if len(libres) > 2 else None
        else:
            inicio = citas.resolver_horario(hora[0], hora[1])
        if not inicio:
            return "Ese horario no está libre. " + await herramientas.ejecutar("ver_horarios", {}, contacto)
        folio = _folio_en(t) or _folio_de(contacto["id"])
        return await herramientas.ejecutar("aceptar_y_apartar", {"folio": folio or "", "horario_iso": inicio}, contacto)
    if "saldo" in t or t in {"3", "mi saldo"}:
        return await herramientas.ejecutar("mi_saldo", {}, contacto)
    if contacto.get("rol") == "dueno" and "agenda" in t:
        return await herramientas.ejecutar("agenda", {}, contacto)
    if contacto.get("rol") == "dueno" and "impuesto" in t:
        return await herramientas.ejecutar("estimar_impuestos", {}, contacto)
    return None


def _servicios_en(texto: str) -> list[str]:
    mapa = {
        "corte": "corte",
        "peluquer": "corte",
        "tinte": "tinte",
        "barba": "barba",
        "tratamiento": "tratamiento",
    }
    vistos = []
    for palabra, sid in mapa.items():
        if palabra in texto and sid not in vistos:
            vistos.append(sid)
    return vistos


def _bienes_en(texto: str) -> list[str]:
    mapa = {"jabon": "jabon", "leche": "leche", "frijol": "frijol"}
    vistos = []
    for palabra, sid in mapa.items():
        if palabra in texto and sid not in vistos:
            vistos.append(sid)
    return vistos


def _folio_en(texto: str) -> str | None:
    m = re.search(r"cot-\d{8}-\d{4}", texto)
    return m.group(0).upper() if m else None


def _folio_de(contacto_id: int) -> str | None:
    cot = cotizaciones.ultima_de(contacto_id)
    return cot["folio"] if cot else None


def _folio_abierto() -> str | None:
    from app.db import conectar

    with conectar() as conn:
        row = conn.execute(
            """SELECT folio FROM cotizaciones
               WHERE estado IN ('aceptada', 'anticipo_pagado', 'enviada') AND total_centavos > pagado_centavos
               ORDER BY id DESC LIMIT 1"""
        ).fetchone()
    return row["folio"] if row else None


def _hora(texto: str) -> tuple[int, int] | None:
    m = re.search(r"las\s+(\d{1,2})(?::(\d{2}))?", texto)
    if not m:
        return None
    hora = int(m.group(1))
    minuto = int(m.group(2) or 0)
    if 1 <= hora <= 7:
        hora += 12
    return hora, minuto
