"""Lectura del tablero. No escribe pagos ni montos."""

import json
import re
import unicodedata
from urllib.parse import quote

from app.config import catalogo, negocio, owner_phones
from app.db import conectar, filas
from app.departamentos.libro import resumen
from app.dinero import fmt_mxn
from app.telefono import a_telefono10


def foto(telefono10: str | None, hilo: str | None = None, con: str | None = None) -> dict:
    tel = ""
    if telefono10:
        try:
            tel = a_telefono10(telefono10)
        except ValueError:
            tel = ""
    with conectar() as conn:
        chat = []
        contacto = None
        if tel:
            row = conn.execute("SELECT * FROM contactos WHERE telefono10=?", (tel,)).fetchone()
            contacto = dict(row) if row else None
        if tel and not contacto:
            contacto = {
                "id": None,
                "telefono10": tel,
                "nombre": "",
                "rol": "dueno" if tel in owner_phones() else "cliente",
            }
        hilo_ok = "estetica" if hilo else None
        tel_hilo = ""
        if con:
            try:
                tel_hilo = a_telefono10(con)
            except ValueError:
                tel_hilo = ""
        dueno_hilo = conn.execute("SELECT * FROM contactos WHERE telefono10=?", (tel_hilo,)).fetchone() if tel_hilo else None
        fuente = dict(dueno_hilo) if dueno_hilo else contacto
        if fuente:
            sql = "SELECT rol, contenido, creado_en FROM mensajes WHERE contacto_id=?"
            args: list = [fuente["id"]]
            if hilo_ok:
                sql += " AND hilo=?"
                args.append(hilo_ok)
            sql += " ORDER BY id DESC LIMIT 40"
            chat = filas(conn.execute(sql, args).fetchall())
        chats = _lista_chats(conn, contacto)
        citas = filas(
            conn.execute(
                """SELECT c.inicio, c.estado, co.nombre, co.telefono10
                   FROM citas c JOIN contactos co ON co.id=c.contacto_id
                   WHERE c.estado IN ('apartada', 'confirmada')
                   ORDER BY c.inicio LIMIT 8"""
            ).fetchall()
        )
        cobros = filas(conn.execute("SELECT * FROM cobros ORDER BY id DESC LIMIT 8").fetchall())
        pagos = filas(conn.execute("SELECT * FROM pagos ORDER BY id DESC LIMIT 8").fetchall())
        almacen = _almacen(conn)
        salidas = filas(
            conn.execute(
                """SELECT m.tipo, m.cantidad, m.nota, p.nombre
                   FROM movimientos_almacen m JOIN productos p ON p.id=m.producto_id
                   ORDER BY m.id DESC LIMIT 6"""
            ).fetchall()
        )
        gastos = filas(
            conn.execute(
                """SELECT g.concepto, g.categoria, g.monto_centavos, co.telefono10
                   FROM gastos_personales g JOIN contactos co ON co.id=g.contacto_id
                   ORDER BY g.id DESC LIMIT 8"""
            ).fetchall()
        )
        metas = filas(
            conn.execute(
                """SELECT m.nombre, m.meta_centavos, m.apartado_centavos, co.telefono10
                   FROM metas_ahorro m JOIN contactos co ON co.id=m.contacto_id
                   ORDER BY m.id DESC LIMIT 4"""
            ).fetchall()
        )
        resenas = filas(
            conn.execute(
                """SELECT r.texto, r.estrellas, co.telefono10, co.nombre
                   FROM resenas r JOIN contactos co ON co.id=r.contacto_id
                   ORDER BY r.id DESC LIMIT 12"""
            ).fetchall()
        )
        ultimo = ""
        if contacto:
            row = conn.execute(
                "SELECT contenido FROM mensajes WHERE contacto_id=? AND rol='user' ORDER BY id DESC LIMIT 1",
                (contacto["id"],),
            ).fetchone()
            ultimo = row["contenido"] if row else ""
        agenda = _agenda(conn)
    seccion, tabla = _seccion(ultimo, (contacto or {}).get("rol"))
    pendiente = next((c for c in cobros if c["estado"] == "pendiente" and c["metodo"] == "simulacion"), None)
    mes = resumen("mes")
    return {
        "quien": {
            "telefono": (contacto or {}).get("telefono10") or tel,
            "nombre": (contacto or {}).get("nombre") or "",
            "rol": (contacto or {}).get("rol") or "cliente",
        },
        "seccion": seccion,
        "tabla": tabla,
        "chat": list(reversed(chat)),
        "chats": chats,
        "citas": [
            {"inicio": c["inicio"], "estado": c["estado"], "quien": c["nombre"] or c["telefono10"]}
            for c in citas
        ],
        "agenda": agenda,
        "resenas_publicas": lugares_resena(),
        "cobros": [
            {
                "id": c["id"],
                "estado": c["estado"],
                "metodo": c["metodo"],
                "tipo": c["tipo"],
                "monto": fmt_mxn(c["monto_centavos"]),
                "concepto": c["concepto"],
            }
            for c in cobros
        ],
        "pagos": [
            {"monto": fmt_mxn(p["monto_centavos"]), "evento": p["tipo_evento"], "cuando": p["recibido_en"]}
            for p in pagos
        ],
        "almacen": almacen,
        "salidas": salidas,
        "gastos": [
            {"concepto": g["concepto"], "categoria": g["categoria"], "monto": fmt_mxn(g["monto_centavos"]), "telefono": g["telefono10"]}
            for g in gastos
        ],
        "metas": [
            {"nombre": m["nombre"], "meta": fmt_mxn(m["meta_centavos"]), "apartado": fmt_mxn(m["apartado_centavos"]), "telefono": m["telefono10"]}
            for m in metas
        ],
        "resenas": [
            {"texto": r["texto"], "estrellas": r["estrellas"], "quien": r["nombre"] or r["telefono10"], "telefono": r["telefono10"]}
            for r in resenas
        ],
        "mes": {
            "cobrado": fmt_mxn(mes["cobrado_centavos"]),
            "por_cobrar": fmt_mxn(mes["por_cobrar_centavos"]),
            "gastos": fmt_mxn(mes["gastos_centavos"]),
            "utilidad": fmt_mxn(mes["utilidad_centavos"]),
            "apartado": fmt_mxn(mes.get("apartado_centavos", 0)),
            "disponible": fmt_mxn(mes.get("disponible_centavos", mes["utilidad_centavos"])),
        },
        "pendiente": (
            {"id": pendiente["id"], "monto": fmt_mxn(pendiente["monto_centavos"]), "concepto": pendiente["concepto"]}
            if pendiente
            else None
        ),
    }


def _lista_chats(conn, contacto: dict | None) -> list[dict]:
    if not contacto:
        return []
    if contacto.get("rol") != "dueno":
        return [_fila_chat(conn, contacto, "Estética")]
    if not contacto.get("id"):
        return []
    otros = conn.execute(
        """SELECT * FROM contactos WHERE id!=? AND rol!='dueno'
           ORDER BY CASE rol WHEN 'proveedor' THEN 1 ELSE 0 END, nombre, id""",
        (contacto["id"],),
    ).fetchall()
    return [_fila_chat(conn, dict(otro), _nombre_cliente(dict(otro))) for otro in otros]


def lugares_resena() -> list[dict]:
    neg = negocio()
    propios = [
        {"lugar": x.get("lugar") or "Google", "url": x["url"]}
        for x in (neg.get("resenas_publicas") or [])
        if x.get("url")
    ]
    if propios:
        return propios
    nombre = neg.get("nombre_comercial") or "Estética"
    return [{"lugar": "Google", "url": "https://www.google.com/maps/search/?api=1&query=" + quote(nombre)}]


def _agenda(conn) -> dict:
    hor = negocio().get("horarios") or {}
    rows = filas(
        conn.execute(
            """SELECT c.inicio, c.estado, c.contacto_id, co.nombre, co.telefono10, q.partidas_json
               FROM citas c
               JOIN contactos co ON co.id=c.contacto_id
               LEFT JOIN cotizaciones q ON q.id=c.cotizacion_id
               WHERE c.estado IN ('apartada', 'confirmada')
               ORDER BY c.inicio"""
        ).fetchall()
    )
    memoria: dict[int, dict] = {}
    citas = []
    for c in rows:
        cid = c["contacto_id"]
        if cid not in memoria:
            memoria[cid] = _memoria_cliente(conn, cid)
        mem = memoria[cid]
        servicio = ""
        if c["partidas_json"]:
            try:
                partidas = json.loads(c["partidas_json"])
            except json.JSONDecodeError:
                partidas = []
            servicio = ", ".join(p.get("descripcion") or "" for p in partidas if p.get("descripcion"))
        citas.append(
            {
                "inicio": c["inicio"],
                "estado": c["estado"],
                "nombre": c["nombre"] or c["telefono10"],
                "telefono": c["telefono10"],
                "servicio": servicio or mem["preferencia"],
                "visitas": mem["visitas"],
                "preferencia": mem["preferencia"],
                "gasto": mem["gasto"],
                "nota": mem["nota"],
                "ultimo": mem["ultimo"],
                "usos": mem["usos"],
                "servicios": mem["servicios"],
                "formula": mem["formula"],
            }
        )
    return {
        "inicio": hor.get("inicio", "10:00"),
        "fin": hor.get("fin", "19:00"),
        "intervalo": int(hor.get("intervalo_min", 60)),
        "dias": hor.get("dias") or ["lun", "mar", "mie", "jue", "vie", "sab"],
        "citas": citas,
    }


def _memoria_cliente(conn, contacto_id: int) -> dict:
    visitas = int(
        conn.execute(
            "SELECT COUNT(*) AS n FROM citas WHERE contacto_id=? AND estado='confirmada'",
            (contacto_id,),
        ).fetchone()["n"]
    )
    pago = conn.execute(
        "SELECT monto_centavos FROM cobros WHERE contacto_id=? AND estado='pagado' ORDER BY id DESC LIMIT 1",
        (contacto_id,),
    ).fetchone()
    dichos = [
        m["contenido"]
        for m in conn.execute(
            "SELECT contenido FROM mensajes WHERE contacto_id=? AND rol='user' ORDER BY id DESC LIMIT 12",
            (contacto_id,),
        ).fetchall()
        if _claro(m["contenido"])
    ]
    interes = _interes(dichos)
    if visitas > 1:
        nota = f"Ya vino {visitas} veces."
        veces = f"Ha venido {visitas} veces"
    elif visitas == 1:
        nota = "Ya vino una vez."
        veces = "Ha venido una vez"
    else:
        nota = "Es su primera vez."
        veces = "Primera vez"
    total = int(
        conn.execute(
            "SELECT COALESCE(SUM(monto_centavos), 0) AS t FROM cobros WHERE contacto_id=? AND estado='pagado'",
            (contacto_id,),
        ).fetchone()["t"]
    )
    if total:
        gasto_txt = "Lleva " + fmt_mxn(total)
    else:
        gasto_txt = "Todavía no gasta aquí"
    ritmo = _ritmo_gasto(conn, contacto_id, total)
    usos = [
        r["descripcion"]
        for r in conn.execute(
            "SELECT descripcion FROM consumos WHERE contacto_id=? ORDER BY id DESC LIMIT 6",
            (contacto_id,),
        ).fetchall()
    ]
    formula = conn.execute("SELECT formula FROM contactos WHERE id=?", (contacto_id,)).fetchone()
    grupos = conn.execute(
        """SELECT descripcion, COUNT(*) AS n FROM consumos
           WHERE contacto_id=? GROUP BY descripcion ORDER BY MAX(id) DESC""",
        (contacto_id,),
    ).fetchall()
    marcados = {
        r["descripcion"]
        for r in conn.execute("SELECT descripcion FROM favoritos WHERE contacto_id=?", (contacto_id,))
    }
    servicios = [
        {"nombre": r["descripcion"], "veces": int(r["n"]), "favorito": r["descripcion"] in marcados}
        for r in grupos
    ]
    return {
        "visitas": visitas,
        "veces": veces,
        "gasto_txt": gasto_txt,
        "ritmo": ritmo,
        "preferencia": ", ".join(interes) if interes else "Todavía no dice una preferencia",
        "gasto": fmt_mxn(pago["monto_centavos"]) if pago else "Sin pago registrado",
        "nota": nota,
        "ultimo": usos[0] if usos else "Todavía no hay un consumo guardado",
        "usos": usos,
        "servicios": servicios,
        "formula": (formula["formula"] if formula and formula["formula"] else "") or "Sin fórmula anotada",
    }


def _ritmo_gasto(conn, contacto_id: int, propio: int) -> str:
    """Compara lo pagado con los demás clientes. Sin otros pagos, no inventa si gasta mucho o poco."""
    if propio <= 0:
        return ""
    otros = [
        int(r["t"])
        for r in conn.execute(
            """SELECT COALESCE(SUM(c.monto_centavos), 0) AS t
               FROM contactos p
               LEFT JOIN cobros c ON c.contacto_id=p.id AND c.estado='pagado'
               WHERE p.rol='cliente' AND p.id!=?
               GROUP BY p.id""",
            (contacto_id,),
        ).fetchall()
    ]
    if not otros:
        return ""
    medio = sorted(otros)[len(otros) // 2]
    if propio > medio:
        return "Gasta más que los demás"
    if propio < medio:
        return "Gasta menos que los demás"
    return "Gasta como los demás"


def _almacen(conn) -> list[dict]:
    productos = filas(
        conn.execute(
            "SELECT id, sku, nombre, existencia, minimo, seccion FROM productos ORDER BY nombre"
        ).fetchall()
    )
    salida = []
    for p in productos:
        lotes = [
            {"cantidad": int(r["cantidad"]), "costo": fmt_mxn(r["costo_centavos"])}
            for r in conn.execute(
                "SELECT cantidad, costo_centavos FROM lotes WHERE producto_id=? AND cantidad>0 ORDER BY id",
                (p["id"],),
            )
        ]
        movimientos = [
            {"tipo": r["tipo"], "cantidad": int(r["cantidad"]), "nota": r["nota"] or ""}
            for r in conn.execute(
                """SELECT tipo, cantidad, nota FROM movimientos_almacen
                   WHERE producto_id=? ORDER BY id DESC LIMIT 4""",
                (p["id"],),
            )
        ]
        salida.append(
            {
                "sku": p["sku"],
                "nombre": p["nombre"],
                "seccion": p["seccion"] or "Insumos",
                "existencia": int(p["existencia"]),
                "minimo": int(p["minimo"]),
                "lotes": lotes,
                "movimientos": movimientos,
            }
        )
    return salida


def _surte(conn, contacto_id: int) -> list[dict]:
    rows = conn.execute(
        """SELECT p.nombre, p.existencia, p.minimo
           FROM surte s JOIN productos p ON p.id=s.producto_id
           WHERE s.contacto_id=? ORDER BY p.nombre""",
        (contacto_id,),
    ).fetchall()
    return [
        {
            "nombre": r["nombre"],
            "existencia": int(r["existencia"]),
            "pide": int(r["existencia"]) <= int(r["minimo"]),
        }
        for r in rows
    ]


def _pedido(conn, contacto_id: int, mensaje: str, surte: list[dict]) -> dict:
    """Lo que el proveedor dijo que trae, cotejado con lo que el almacén pide y con su factura."""
    plano = _plano(mensaje)
    cuando = "No dijo cuándo llega."
    for clave, etiqueta in (
        ("lunes", "El lunes"),
        ("martes", "El martes"),
        ("miercoles", "El miércoles"),
        ("jueves", "El jueves"),
        ("viernes", "El viernes"),
        ("sabado", "El sábado"),
        ("domingo", "El domingo"),
    ):
        if clave in plano:
            cuando = etiqueta
            break
    mencionados = [s["nombre"] for s in surte if _plano(s["nombre"]) and _plano(s["nombre"]) in plano]
    if not mencionados:
        trae = "No dijo qué material trae."
    elif "cuanto" in plano:
        trae = ", ".join(mencionados) + ". No dijo cuántos."
    else:
        trae = ", ".join(mencionados) + "."
    pide = [s["nombre"] for s in surte if s["pide"]]
    factura = _factura_surtido(conn, contacto_id)
    return {
        "cuando": cuando,
        "trae": trae,
        "pide": ", ".join(pide) if pide else "Nada. Hay de sobra.",
        "factura": factura or "Sin factura de este proveedor.",
        "cotejo": _cotejo(mencionados, pide, factura),
    }


def _factura_surtido(conn, contacto_id: int) -> str:
    rows = conn.execute(
        """SELECT p.nombre, l.cantidad, l.costo_centavos
           FROM lotes l
           JOIN productos p ON p.id=l.producto_id
           JOIN surte s ON s.producto_id=p.id AND s.contacto_id=?
           WHERE l.factura_id IS NOT NULL AND l.cantidad>0
           ORDER BY l.id""",
        (contacto_id,),
    ).fetchall()
    if not rows:
        return ""
    return "; ".join(f"{r['nombre']} {int(r['cantidad'])} a {fmt_mxn(r['costo_centavos'])}" for r in rows)


def _cotejo(trae: list[str], pide: list[str], factura: str) -> str:
    if factura:
        if pide and any(nombre not in factura for nombre in pide):
            return "La factura no cubre lo que el almacén pide."
        if pide:
            return "La factura cuadra con lo que el almacén pide."
        return "Llegó factura y el almacén no estaba pidiendo nada."
    if pide and trae and any(nombre not in trae for nombre in pide):
        return "No cuadra. El recado no cubre lo que el almacén pide."
    if pide and trae:
        return "El recado cuadra con lo que el almacén pide. Falta la factura para cerrar el precio."
    if pide:
        return "El almacén pide material y todavía no hay recado ni factura."
    if trae:
        return "El almacén no está pidiendo eso. Ya hay de sobra."
    return "Sin pedido que cotejar."


def _nombre_cliente(contacto: dict) -> str:
    nom = (contacto.get("nombre") or "").strip()
    if not nom or nom == contacto.get("telefono10"):
        return "Sin nombre"
    return nom


def _fila_chat(conn, contacto: dict, nombre: str) -> dict:
    vacia = {
        "hilo": "estetica",
        "telefono": contacto["telefono10"],
        "nombre": nombre,
        "ultimo": "Sin mensajes",
        "quiere": "Todavía no pide nada",
        "resumen": "Todavía no pide nada.",
        "pidio": "Todavía no pide nada.",
        "historial": [],
        "interes": "No dijo en qué está interesada.",
        "seguimiento": "Primera vez. Todavía no se hace nada.",
        "alerta": "",
        "respuesta": "",
        "sugerencias": [],
        "presupuestos": [],
        "hecho": [],
    }
    if not contacto.get("id"):
        vacia["rol"] = contacto.get("rol") or "cliente"
        return vacia
    ficha = {**vacia, **_ficha(conn, contacto["id"], nombre, contacto["telefono10"])}
    mem = _memoria_cliente(conn, contacto["id"])
    ficha["visitas"] = mem["visitas"]
    ficha["veces"] = mem["veces"]
    ficha["gasto_txt"] = mem["gasto_txt"]
    ficha["ritmo"] = mem["ritmo"]
    ficha["ultimo_uso"] = mem["ultimo"]
    ficha["usos"] = mem["usos"]
    ficha["servicios"] = mem["servicios"]
    ficha["favoritos"] = [s["nombre"] for s in mem["servicios"] if s["favorito"]]
    ficha["formula"] = mem["formula"]
    ficha["rol"] = contacto.get("rol") or "cliente"
    if ficha["rol"] == "proveedor":
        ficha["seguimiento"] = ""
        ficha["sugerencias"] = []
        ficha["surte"] = _surte(conn, contacto["id"])
        ficha["pedido"] = _pedido(conn, contacto["id"], ficha["pidio"], ficha["surte"])
        ficha["alerta"] = ficha["alerta"].replace("Te escribió. Contéstale.", "El proveedor escribió. Revísalo.")
    return ficha


def _ficha(conn, contacto_id: int, nombre: str, telefono: str) -> dict:
    mensajes = filas(
        conn.execute(
            """SELECT rol, contenido, id FROM mensajes
               WHERE contacto_id=? ORDER BY id DESC LIMIT 30""",
            (contacto_id,),
        ).fetchall()
    )
    dichos = [m["contenido"].replace("\n", " ").strip() for m in mensajes if m["rol"] == "user" and _util(m["contenido"])]
    claros = [t for t in dichos if _claro(t)]
    pidio = claros[0] if claros else (dichos[0] if dichos else "Todavía no pide nada. Solo activó el agente.")
    historial = [t for t in claros[1:5]]
    interes_nombres = _interes(claros or dichos)
    interes = ", ".join(interes_nombres) if interes_nombres else "No dijo en qué está interesada."
    cotizaciones = filas(
        conn.execute(
            """SELECT folio, estado, partidas_json, total_centavos, pagado_centavos
               FROM cotizaciones WHERE contacto_id=? ORDER BY id DESC LIMIT 4""",
            (contacto_id,),
        ).fetchall()
    )
    citas = filas(
        conn.execute(
            "SELECT inicio, estado FROM citas WHERE contacto_id=? ORDER BY inicio DESC LIMIT 4",
            (contacto_id,),
        ).fetchall()
    )
    presupuestos = [_presupuesto(c) for c in cotizaciones]
    hecho = _hecho(citas, presupuestos)
    seguimiento = _seguimiento(citas, presupuestos)
    respuesta = next((m["contenido"].replace("\n", " ").strip()[:140] for m in mensajes if m["rol"] == "dueno"), "")
    ultimo_util = next((m for m in mensajes if m["rol"] == "user" and _util(m["contenido"])), None)
    humana = next((m["id"] for m in mensajes if m["rol"] == "dueno"), 0)
    alerta = ""
    if ultimo_util and ultimo_util["id"] > humana:
        alerta = "Te escribió. Contéstale."
    if any(p["estado"] in ("enviada", "aceptada") for p in presupuestos):
        alerta = (alerta + " " if alerta else "") + "Tiene un presupuesto sin cerrar."
    sugerencias = _sugerencias(interes_nombres, hecho)
    return {
        "hilo": "estetica",
        "telefono": telefono,
        "nombre": nombre,
        "ultimo": pidio[:80],
        "quiere": pidio[:90],
        "resumen": f"{pidio} {seguimiento}",
        "pidio": pidio,
        "historial": historial,
        "interes": interes,
        "seguimiento": seguimiento,
        "alerta": alerta.strip(),
        "respuesta": respuesta,
        "sugerencias": sugerencias,
        "presupuestos": presupuestos,
        "hecho": hecho,
    }


def _util(texto: str) -> bool:
    return _plano(texto) not in {"jalate eso", "jalateeso"}


def _claro(texto: str) -> bool:
    p = _plano(texto)
    if p in {"va", "si", "ok", "mis citas", "como gasto", "el de las 5"}:
        return False
    return len(p) > 12


def _plano(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", t).strip().lower())


def _interes(textos: list[str]) -> list[str]:
    junto = _plano(" ".join(textos))
    claves = {
        "corte": ("corte", "pelo", "cabello", "peluquer"),
        "tinte": ("tinte", "color"),
        "barba": ("barba",),
        "tratamiento": ("tratamiento", "hidrat"),
    }
    nombres = {s["id"]: s["nombre"] for s in catalogo().get("servicios", [])}
    return [nombres[sid] for sid, palabras in claves.items() if sid in nombres and any(p in junto for p in palabras)]


def _presupuesto(cot: dict) -> dict:
    partidas = json.loads(cot["partidas_json"] or "[]")
    conceptos = ", ".join(p.get("descripcion") or p.get("servicio_id") or "" for p in partidas)
    resta = max(int(cot["total_centavos"]) - int(cot["pagado_centavos"]), 0)
    return {
        "folio": cot["folio"],
        "estado": cot["estado"],
        "conceptos": conceptos or "Sin partidas",
        "total": fmt_mxn(1),
        "saldo": fmt_mxn(1 if resta else 0),
    }


def _hecho(citas: list[dict], presupuestos: list[dict]) -> list[str]:
    lineas = []
    for c in citas:
        if c["estado"] == "confirmada":
            lineas.append(f"Cita hecha {c['inicio'][:16].replace('T', ' ')}")
    for p in presupuestos:
        if p["estado"] in ("liquidada", "anticipo_pagado"):
            lineas.append(f"{p['folio']} {p['conceptos']} · {p['estado'].replace('_', ' ')}")
    return lineas


def _seguimiento(citas: list[dict], presupuestos: list[dict]) -> str:
    if any(c["estado"] == "confirmada" for c in citas) or any(p["estado"] in ("liquidada", "anticipo_pagado") for p in presupuestos):
        return "Seguimiento. Ya se hizo algo."
    if any(c["estado"] == "apartada" for c in citas) or any(p["estado"] in ("enviada", "aceptada") for p in presupuestos):
        return "En curso. Todavía no se hace el servicio."
    return "Primera vez. Todavía no se hace nada."


def _sugerencias(interes: list[str], hecho: list[str]) -> list[dict]:
    ya = _plano(" ".join(interes + hecho))
    salida = []
    for s in catalogo().get("servicios", []):
        if _plano(s["nombre"]) in ya or s["id"] in ya:
            continue
        salida.append({"nombre": s["nombre"], "precio": fmt_mxn(1)})
        if len(salida) == 3:
            break
    return salida


def _seccion(texto: str, rol: str | None) -> tuple[str, str]:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    t = re.sub(r"\s+", " ", t).strip().lower()
    if not t:
        return "charla", "mensajes"
    if rol == "dueno" and (t.startswith("factura") or "existencia" in t or "almacen" in t or "surtir" in t):
        return "almacen", "productos"
    if rol == "dueno" and (t.startswith("gaste") or "como voy" in t or "impuesto" in t):
        return "contabilidad", "movimientos"
    if "gaste" in t or "ahorr" in t or "como gasto" in t or "mis gastos" in t:
        return "memoria", "gastos_personales"
    if any(p in t for p in ("mis citas", "mi agenda", "horario", "las ", "primero", "va")):
        return "agenda", "citas"
    if any(p in t for p in ("cobr", "pago", "saldo")):
        return "cobranza", "cobros"
    if any(p in t for p in ("jabon", "leche", "frijol", "tinte", "producto")):
        return "almacen", "productos"
    if any(p in t for p in ("corte", "peluquer", "tinte", "barba", "cotiz")):
        return "agenda", "cotizaciones"
    return "charla", "mensajes"
