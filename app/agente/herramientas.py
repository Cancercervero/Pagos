"""Herramientas del agente. El rol se valida aquí, no solo en el prompt."""

import json

from app import simulacion
from app.config import negocio
from app.departamentos import almacen, citas, cobranza, cotizaciones, impuestos, libro, memoria
from app.departamentos.facturas import url_pdf
from app.db import conectar
from app.dinero import fmt_mxn

MENU = "1) Ver catálogo  2) Cotizar  3) Mi saldo"

TOOLS_CLIENTE = [
    "ver_catalogo",
    "crear_cotizacion",
    "ver_horarios",
    "aceptar_y_apartar",
    "reenviar_cobro",
    "mi_saldo",
    "mis_citas",
    "mi_consumo",
    "registrar_gasto_personal",
    "meta_ahorro",
    "como_gasto",
    "cobrar_mercancia",
]
TOOLS_DUENO = TOOLS_CLIENTE + [
    "cobrar_saldo",
    "crear_cobro_libre",
    "registrar_gasto",
    "resumen_finanzas",
    "cuentas_por_cobrar",
    "agenda",
    "estimar_impuestos",
    "generar_factura",
    "registrar_devolucion",
    "cargar_factura",
    "existencias",
    "por_surtir",
]


def esquemas(rol: str) -> list[dict]:
    nombres = TOOLS_DUENO if rol == "dueno" else TOOLS_CLIENTE
    return [ESQUEMAS[n] for n in nombres]


async def ejecutar(nombre: str, args: dict, contacto: dict) -> str:
    args = args or {}
    if nombre not in ESQUEMAS:
        return "Esa acción no existe."
    if nombre not in TOOLS_CLIENTE and contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    try:
        return await _DISPATCH[nombre](args, contacto)
    except Exception as exc:
        return f"No pude hacerlo: {exc}"


async def _ver_catalogo(args, contacto) -> str:
    return cotizaciones.listar_catalogo()


async def _crear_cotizacion(args, contacto) -> str:
    partidas = args.get("partidas") or []
    cot = cotizaciones.crear_cotizacion(contacto["id"], partidas)
    return cotizaciones.texto_cotizacion(cot)


async def _ver_horarios(args, contacto) -> str:
    return citas.texto_huecos(citas.huecos_libres(3, args.get("fecha")))


async def _aceptar_y_apartar(args, contacto) -> str:
    folio = (args.get("folio") or "").strip()
    inicio = (args.get("horario_iso") or "").strip()
    cot = cotizaciones.por_folio(folio) if folio else cotizaciones.ultima_de(contacto["id"])
    if not cot or cot["contacto_id"] != contacto["id"]:
        return "No encuentro esa cotización tuya."
    if not inicio:
        return "Me falta el horario."
    if cotizaciones.es_bienes(cot):
        return await _cobrar_mercancia({}, contacto)
    citas.apartar(contacto["id"], cot["id"], inicio)
    pct = float(negocio().get("anticipo_pct", 0.5))
    anticipo = int(round(cot["total_centavos"] * pct))
    if simulacion.activa():
        cobro = await cobranza.crear_cobro(
            "anticipo",
            "push",
            anticipo,
            contacto["id"],
            cot["id"],
            f"Anticipo {cot['folio']}",
            simular=True,
        )
        return (
            f"Aparté {inicio} para {cot['folio']}.\n"
            + cobranza.texto_cobro_cliente(cobro)
            + "\nConfírmalo en tu app bancaria. Si pide Face ID o huella, es tu banco. En cuanto el pago quede confirmado, la cita entra a tu agenda."
        )
    try:
        cobro = await cobranza.crear_cobro(
            "anticipo",
            "push",
            anticipo,
            contacto["id"],
            cot["id"],
            f"Anticipo {cot['folio']}",
        )
    except Exception:
        cobro = await cobranza.crear_cobro(
            "anticipo",
            "link",
            anticipo,
            contacto["id"],
            cot["id"],
            f"Anticipo {cot['folio']}",
        )
        return (
            f"Aparté {inicio} para {cot['folio']}. "
            "No pude avisar a tu banco, así que te dejo un link (también acepta tarjeta).\n"
            + cobranza.texto_cobro_cliente(cobro)
        )
    return (
        f"Aparté {inicio} para {cot['folio']}.\n"
        + cobranza.texto_cobro_cliente(cobro)
        + "\nConfírmalo en tu app bancaria. Si pide Face ID o huella, es tu banco. En cuanto el pago quede confirmado, la cita entra a tu agenda."
    )


async def _reenviar_cobro(args, contacto) -> str:
    cobro_id = int(args.get("cobro_id"))
    metodo = args.get("metodo") or "push"
    with conectar() as conn:
        cobro = conn.execute("SELECT * FROM cobros WHERE id=?", (cobro_id,)).fetchone()
    if not cobro or cobro["contacto_id"] != contacto["id"] and contacto.get("rol") != "dueno":
        return "Ese cobro no es tuyo."
    cobranza.cancelar(cobro_id)
    nuevo = await cobranza.crear_cobro(
        cobro["tipo"],
        metodo,
        cobro["monto_centavos"],
        cobro["contacto_id"],
        cobro["cotizacion_id"],
        cobro["concepto"],
    )
    return "Te generé un cobro nuevo.\n" + cobranza.texto_cobro_cliente(nuevo)


async def _mi_saldo(args, contacto) -> str:
    return cotizaciones.saldo_de(contacto["id"])


async def _cobrar_saldo(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    folio = (args.get("folio") or "").strip()
    cot = cotizaciones.por_folio(folio) if folio else None
    if not cot:
        return "Pásame el folio, por ejemplo COT-20261114-0001."
    resta = cot["total_centavos"] - cot["pagado_centavos"]
    if resta <= 0:
        return f"{cot['folio']} ya está liquidada."
    metodo = args.get("metodo") or "push"
    cobro = await cobranza.crear_cobro("saldo", metodo, resta, cot["contacto_id"], cot["id"], f"Saldo {cot['folio']}")
    return f"Cobro del saldo de {cot['folio']} por {fmt_mxn(resta)} enviado por {cobro['metodo']}."


async def _crear_cobro_libre(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    from app.personas import obtener_o_crear

    destino = obtener_o_crear(str(args.get("telefono10")))
    monto = int(round(float(args.get("monto")) * 100))
    concepto = (args.get("concepto") or "Cobro").strip()
    metodo = args.get("metodo") or "push"
    cobro = await cobranza.crear_cobro("libre", metodo, monto, destino["id"], None, concepto)
    return f"Cobro libre de {fmt_mxn(monto)} para {destino['telefono10']}: {cobranza.texto_cobro_cliente(cobro)}"


async def _registrar_gasto(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    mov = libro.registrar_gasto(
        float(args.get("monto")),
        args.get("concepto") or "Gasto",
        args.get("categoria"),
        bool(args.get("con_factura")),
    )
    return f"Registré el gasto de {fmt_mxn(mov['monto_centavos'])}: {mov['concepto']}."


async def _resumen(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    periodo = args.get("periodo") or "mes"
    return libro.texto_resumen(libro.resumen(periodo))


async def _cuentas(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    return libro.cuentas_por_cobrar()


async def _agenda(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    return citas.texto_agenda(citas.agenda(args.get("fecha")))


async def _impuestos(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    return impuestos.texto_estimacion(periodo="mes")


async def _generar_factura(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    from app.db import transaccion

    cot = cotizaciones.por_folio(args.get("folio") or "")
    if not cot:
        return "No encuentro ese folio."
    if cot["estado"] != "liquidada":
        return "La factura se arma cuando la cotización está liquidada."
    with transaccion() as conn:
        fac = __import__("app.departamentos.facturas", fromlist=["generar_para_cotizacion"]).generar_para_cotizacion(conn, cot)
    url = url_pdf(fac) if fac else ""
    return f"Factura borrador {fac['serie']}{fac['folio']}. Timbrado simulado (requiere PAC y CSD). {url}".strip()


async def _devolucion(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    mov = libro.registrar_devolucion(int(args["pago_id"]), float(args["monto"]), args.get("motivo") or "Devolución")
    return (
        f"Anoté la devolución de {fmt_mxn(mov['monto_centavos'])}. "
        "La API de pey no reembolsa: haz la transferencia tú y esto solo queda en el libro."
    )


async def _cobrar_mercancia(args, contacto) -> str:
    cot = cotizaciones.ultima_de(contacto["id"])
    if not cot or cot["contacto_id"] != contacto["id"]:
        return "No encuentro un pedido tuyo."
    if not cotizaciones.es_bienes(cot):
        return "Esa cotización es un servicio. Dime el horario."
    resta = int(cot["total_centavos"]) - int(cot["pagado_centavos"])
    if resta <= 0:
        return f"{cot['folio']} ya está pagada."
    if simulacion.activa():
        cobro = await cobranza.crear_cobro(
            "total", "push", resta, contacto["id"], cot["id"], f"Pedido {cot['folio']}", simular=True
        )
    else:
        try:
            cobro = await cobranza.crear_cobro(
                "total", "push", resta, contacto["id"], cot["id"], f"Pedido {cot['folio']}"
            )
        except Exception:
            cobro = await cobranza.crear_cobro(
                "total", "link", resta, contacto["id"], cot["id"], f"Pedido {cot['folio']}"
            )
    return (
        f"Pedido {cot['folio']} listo.\n"
        + cobranza.texto_cobro_cliente(cobro)
        + "\nConfírmalo en tu app bancaria. Si pide Face ID o huella, es tu banco. Al quedar pagado, bajo el almacén y aparto el impuesto."
    )


async def _mis_citas(args, contacto) -> str:
    return citas.mis_citas(contacto["id"])


async def _consumo(args, contacto) -> str:
    return memoria.consumo(contacto["id"])


async def _gasto_personal(args, contacto) -> str:
    return memoria.registrar(contacto["id"], float(args.get("monto")), args.get("concepto") or "gasto", args.get("categoria"))


async def _meta(args, contacto) -> str:
    return memoria.poner_meta(contacto["id"], args.get("nombre") or "mi meta", float(args.get("monto")))


async def _como_gasto(args, contacto) -> str:
    return memoria.como_gasto(contacto["id"])


async def _cargar_factura(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    if not args.get("cantidad"):
        return almacen.guardar_foto(args.get("nota") or "foto de factura", args.get("imagen_path"))
    return almacen.cargar_entrada(
        args.get("sku") or args.get("nombre") or "producto",
        args.get("nombre") or args.get("sku") or "producto",
        int(args.get("cantidad")),
        float(args.get("costo")),
        args.get("nota") or "",
    )


async def _existencias(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    return almacen.existencias()


async def _por_surtir(args, contacto) -> str:
    if contacto.get("rol") != "dueno":
        return "Eso solo lo puede hacer el dueño del negocio."
    return almacen.por_surtir()


def _schema(nombre: str, descripcion: str, propiedades: dict, requeridos: list[str] | None = None) -> dict:
    return {
        "type": "function",
        "function": {
            "name": nombre,
            "description": descripcion,
            "parameters": {
                "type": "object",
                "properties": propiedades,
                "required": requeridos or [],
                "additionalProperties": False,
            },
        },
    }


ESQUEMAS = {
    "ver_catalogo": _schema("ver_catalogo", "Lista servicios y precios del catálogo.", {}),
    "crear_cotizacion": _schema(
        "crear_cotizacion",
        "Crea una cotización. El servidor calcula importes. servicio_id: corte, tinte, barba, tratamiento.",
        {"partidas": {"type": "array", "items": {"type": "object", "properties": {"servicio_id": {"type": "string"}, "cantidad": {"type": "integer"}}, "required": ["servicio_id"]}}},
        ["partidas"],
    ),
    "ver_horarios": _schema("ver_horarios", "Hasta 3 horarios libres.", {"fecha": {"type": "string"}}),
    "aceptar_y_apartar": _schema(
        "aceptar_y_apartar",
        "Aparta la cita y cobra el anticipo por push CoDi. horario_iso es fecha local YYYY-MM-DDTHH:MM.",
        {"folio": {"type": "string"}, "horario_iso": {"type": "string"}},
        ["horario_iso"],
    ),
    "reenviar_cobro": _schema(
        "reenviar_cobro",
        "Cancela el cobro pendiente y crea otro. metodo: push, link o qr.",
        {"cobro_id": {"type": "integer"}, "metodo": {"type": "string"}},
        ["cobro_id"],
    ),
    "mi_saldo": _schema("mi_saldo", "Saldo de las cotizaciones de quien escribe.", {}),
    "cobrar_saldo": _schema(
        "cobrar_saldo",
        "Dueño. Cobra el saldo restante de un folio.",
        {"folio": {"type": "string"}, "metodo": {"type": "string"}},
        ["folio"],
    ),
    "crear_cobro_libre": _schema(
        "crear_cobro_libre",
        "Dueño. Cobro sin cotización. monto en pesos.",
        {"telefono10": {"type": "string"}, "monto": {"type": "number"}, "concepto": {"type": "string"}, "metodo": {"type": "string"}},
        ["telefono10", "monto", "concepto"],
    ),
    "registrar_gasto": _schema(
        "registrar_gasto",
        "Dueño. Anota un gasto. monto en pesos.",
        {"monto": {"type": "number"}, "concepto": {"type": "string"}, "categoria": {"type": "string"}, "con_factura": {"type": "boolean"}},
        ["monto", "concepto"],
    ),
    "resumen_finanzas": _schema(
        "resumen_finanzas",
        "Dueño. Cobrado, por cobrar, gastos y utilidad.",
        {"periodo": {"type": "string", "enum": ["hoy", "semana", "mes"]}},
    ),
    "cuentas_por_cobrar": _schema("cuentas_por_cobrar", "Dueño. Quién debe y cuánto.", {}),
    "agenda": _schema("agenda", "Dueño. Citas apartadas y confirmadas.", {"fecha": {"type": "string"}}),
    "estimar_impuestos": _schema("estimar_impuestos", "Dueño. Estimación de IVA e ISR RESICO. No es declaración.", {}),
    "generar_factura": _schema("generar_factura", "Dueño. Factura borrador si la cotización está liquidada.", {"folio": {"type": "string"}}, ["folio"]),
    "registrar_devolucion": _schema(
        "registrar_devolucion",
        "Dueño. Anota una devolución manual. La API no reembolsa. monto en pesos.",
        {"pago_id": {"type": "integer"}, "monto": {"type": "number"}, "motivo": {"type": "string"}},
        ["pago_id", "monto", "motivo"],
    ),
    "mis_citas": _schema("mis_citas", "Agenda de quien escribe: citas apartadas y confirmadas.", {}),
    "mi_consumo": _schema("mi_consumo", "Lo que esta persona ya cotizó y pagó en el negocio.", {}),
    "registrar_gasto_personal": _schema(
        "registrar_gasto_personal",
        "Memoria personal de gasto. No entra al libro del negocio. monto en pesos.",
        {"monto": {"type": "number"}, "concepto": {"type": "string"}, "categoria": {"type": "string"}},
        ["monto", "concepto"],
    ),
    "meta_ahorro": _schema(
        "meta_ahorro",
        "Meta de ahorro de la persona. monto en pesos. No recomienda instrumentos de inversión.",
        {"nombre": {"type": "string"}, "monto": {"type": "number"}},
        ["nombre", "monto"],
    ),
    "como_gasto": _schema("como_gasto", "Resume hábitos de gasto y acerca una meta de ahorro. Es una guía, no asesoría.", {}),
    "cobrar_mercancia": _schema("cobrar_mercancia", "Cobra un pedido de mercancía, sin cita. El monto sale de la cotización.", {}),
    "cargar_factura": _schema(
        "cargar_factura",
        "Dueño. Entrada de almacén. Sin cantidad, solo guarda la foto y pide confirmación.",
        {"sku": {"type": "string"}, "nombre": {"type": "string"}, "cantidad": {"type": "integer"}, "costo": {"type": "number"}, "nota": {"type": "string"}},
    ),
    "existencias": _schema("existencias", "Dueño. Qué hay en el almacén.", {}),
    "por_surtir": _schema("por_surtir", "Dueño. Productos en o bajo el mínimo.", {}),
}

_DISPATCH = {
    "ver_catalogo": _ver_catalogo,
    "crear_cotizacion": _crear_cotizacion,
    "ver_horarios": _ver_horarios,
    "aceptar_y_apartar": _aceptar_y_apartar,
    "reenviar_cobro": _reenviar_cobro,
    "mi_saldo": _mi_saldo,
    "cobrar_saldo": _cobrar_saldo,
    "crear_cobro_libre": _crear_cobro_libre,
    "registrar_gasto": _registrar_gasto,
    "resumen_finanzas": _resumen,
    "cuentas_por_cobrar": _cuentas,
    "agenda": _agenda,
    "estimar_impuestos": _impuestos,
    "generar_factura": _generar_factura,
    "registrar_devolucion": _devolucion,
    "mis_citas": _mis_citas,
    "mi_consumo": _consumo,
    "registrar_gasto_personal": _gasto_personal,
    "meta_ahorro": _meta,
    "como_gasto": _como_gasto,
    "cobrar_mercancia": _cobrar_mercancia,
    "cargar_factura": _cargar_factura,
    "existencias": _existencias,
    "por_surtir": _por_surtir,
}


def args_json(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    return json.loads(raw)
