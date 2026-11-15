"""FastAPI: webhooks, panel, chat de respaldo y salud."""

import asyncio
import io
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import qrcode
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from app import tareas
from app.agente.entrada import atender_whatsapp, procesar_entrada
from app.config import archivos_dir, env, negocio, owner_phones, panel_key, tareas_activas
from app.db import ahora_iso, conectar, filas, init_db, marcar_favorito, transaccion
from app.departamentos import cargas, cobranza
from app.departamentos.libro import resumen
from app.dinero import fmt_mxn
from app.personas import guardar_mensaje, obtener_o_crear
from app import pey
from app import seguridad
from app import simulacion
from app.tablero import foto, lugares_resena
from app.telefono import a_telefono10
from app.webhooks_pey import aplicar_pago_en_tx, procesar_transaccion_confirmada, procesar_webhook
from app.whatsapp import despachar

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
WEB = Path(__file__).resolve().parent / "web"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    tarea = asyncio.create_task(tareas.loop()) if tareas_activas() else None
    yield
    if tarea:
        tarea.cancel()


app = FastAPI(title="Agente bancario", lifespan=lifespan)


class ChatIn(BaseModel):
    telefono10: str
    texto: str
    hilo: str = "estetica"


class ContestarIn(BaseModel):
    desde: str
    para: str
    texto: str


class FormulaIn(BaseModel):
    desde: str
    para: str
    texto: str


class FavoritoIn(BaseModel):
    desde: str
    para: str
    texto: str


class AjusteIn(BaseModel):
    telefono10: str
    sku: str
    delta: int


class MermaIn(BaseModel):
    telefono10: str
    sku: str
    motivo: str


class AtenderIn(BaseModel):
    desde: str
    para: str
    servicio: str


class OrdenIn(BaseModel):
    telefono10: str
    orden_id: int


class LineaVenta(BaseModel):
    sku: str
    cantidad: int


class VentaIn(BaseModel):
    telefono10: str
    lineas: list[LineaVenta]
    cliente10: str = ""


class PrecioIn(BaseModel):
    telefono10: str
    sku: str
    precio_pesos: float


class BancoIn(BaseModel):
    cobro_id: int


class ResenaIn(BaseModel):
    telefono10: str
    texto: str
    estrellas: int


class CentavoIn(BaseModel):
    telefono10: str


class EscanerIn(BaseModel):
    texto: str


MONTO_CENTAVO = 1


def _llave(k: str | None) -> None:
    esperada = panel_key()
    if not esperada or k != esperada:
        raise HTTPException(status_code=401, detail="No autorizado")


@app.get("/salud")
async def salud():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
async def inicio():
    nombre = negocio().get("nombre_comercial", "Agente bancario")
    return f"""<!doctype html><meta charset="utf-8"><title>{nombre}</title>
    <body style="font-family:Georgia,serif;background:#f3eee6;color:#241c22;padding:48px">
    <h1>Anillo</h1>
    <p>Agente bancario para la Ciudad de México. El cobro lo confirma el banco. La mesa aparta el impuesto.</p>
    <p><a style="color:#7a3048" href="/app">App</a> · <a style="color:#7a3048" href="/simulacion">Mesa</a> · <a style="color:#7a3048" href="/panel">Panel</a></p>
    </body>"""


@app.get("/gracias", response_class=HTMLResponse)
async def gracias():
    return "<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;padding:40px'><h1>Listo</h1><p>Si el banco ya confirmó, el negocio recibe el aviso solo.</p></body>"


@app.post("/webhooks/pey")
async def webhook_pey(request: Request, background: BackgroundTasks):
    body = await request.body()
    status, mensajes = await procesar_webhook(body, request.headers)
    if mensajes:
        background.add_task(despachar, mensajes)
    return Response(status_code=status)


@app.get("/webhooks/whatsapp")
async def verificar_whatsapp(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == env("WHATSAPP_VERIFY_TOKEN"):
        return Response(content=hub_challenge or "", media_type="text/plain")
    return Response(content="Verification failed", status_code=403)


@app.post("/webhooks/whatsapp")
async def recibir_whatsapp(request: Request, background: BackgroundTasks):
    data = await request.json()
    background.add_task(atender_whatsapp, data)
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(body: ChatIn, k: str | None = Query(None), modo: str | None = Query(None)):
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    token = simulacion.usar(True) if modo == "simulacion" else None
    try:
        respuesta = await procesar_entrada(telefono, body.texto, hilo=body.hilo)
    finally:
        if token is not None:
            simulacion.dejar(token)
    return {"respuesta": respuesta}


@app.post("/api/contestar")
async def contestar(body: ContestarIn, k: str | None = Query(None)):
    """El negocio le escribe a la clienta. No corre el agente ni mueve dinero."""
    _llave(k)
    try:
        desde = a_telefono10(body.desde)
        para = a_telefono10(body.para)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if desde not in owner_phones():
        raise HTTPException(403, "Solo el negocio contesta desde aquí.")
    texto = (body.texto or "").strip()
    if not texto:
        raise HTTPException(400, "Escribe la respuesta.")
    contacto = obtener_o_crear(para)
    if contacto["rol"] == "dueno":
        raise HTTPException(400, "Ese número es del negocio.")
    guardar_mensaje(contacto["id"], "dueno", texto)
    salio = bool((env("WHATSAPP_TOKEN") or "").strip() and (env("WHATSAPP_PHONE_NUMBER_ID") or "").strip())
    if salio:
        from app.whatsapp import enviar_a_telefono

        await enviar_a_telefono(para, texto)
    return {"ok": True, "salio": salio}


@app.post("/api/formula")
async def guardar_formula(body: FormulaIn, k: str | None = Query(None)):
    """El negocio anota la fórmula o el gusto. No calcula dinero."""
    _llave(k)
    try:
        desde = a_telefono10(body.desde)
        para = a_telefono10(body.para)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if desde not in owner_phones():
        raise HTTPException(403, "Solo el negocio anota la fórmula.")
    texto = (body.texto or "").strip()
    if not texto:
        raise HTTPException(400, "Escribe la fórmula o el gusto.")
    contacto = obtener_o_crear(para)
    if contacto["rol"] == "dueno":
        raise HTTPException(400, "Ese número es del negocio.")
    with transaccion() as conn:
        conn.execute("UPDATE contactos SET formula=? WHERE id=?", (texto[:240], contacto["id"]))
    return {"ok": True}


@app.post("/api/servicio-atendido")
async def servicio_atendido(body: AtenderIn, k: str | None = Query(None)):
    """El servicio pagado baja la receta. Cobrar no mueve el almacén."""
    _llave(k)
    try:
        desde = a_telefono10(body.desde)
        para = a_telefono10(body.para)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if desde not in owner_phones():
        raise HTTPException(403, "Solo el negocio marca un servicio atendido.")
    contacto = obtener_o_crear(para)
    servicio = (body.servicio or "").strip().lower()
    from app.config import catalogo

    nombre = next((s["nombre"] for s in catalogo().get("servicios", []) if s["id"] == servicio), "")
    if not nombre:
        raise HTTPException(400, "No tengo ese servicio.")
    with conectar() as conn:
        pago = conn.execute(
            "SELECT id FROM consumos WHERE contacto_id=? AND descripcion=? LIMIT 1",
            (contacto["id"], nombre),
        ).fetchone()
    if not pago:
        raise HTTPException(400, "Ese servicio no está en lo que ya pagó.")
    from app.departamentos.almacen import atender_servicio

    try:
        return atender_servicio(contacto["id"], servicio)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/venta")
async def venta_caja(body: VentaIn, k: str | None = Query(None)):
    """Venta en efectivo. El monto lo calcula el anaquel. CoDi sigue en el webhook."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio cobra en caja.")
    cliente = ""
    if (body.cliente10 or "").strip():
        try:
            cliente = a_telefono10(body.cliente10)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    from app.departamentos.almacen import vender_en_caja

    try:
        venta = vender_en_caja([{"sku": linea.sku, "cantidad": linea.cantidad} for linea in body.lineas])
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    venta["aviso"] = ""
    if cliente:
        from app.config import env
        from app.personas import guardar_mensaje, obtener_o_crear
        from app.whatsapp import enviar_a_telefono

        contacto = obtener_o_crear(cliente)
        guardar_mensaje(contacto["id"], "dueno", venta["ticket"])
        if env("WHATSAPP_TOKEN") and env("WHATSAPP_PHONE_NUMBER_ID"):
            await enviar_a_telefono(cliente, venta["ticket"])
            venta["aviso"] = "Mandé el ticket por WhatsApp."
        else:
            venta["aviso"] = "El ticket quedó en su ficha. WhatsApp no tiene las llaves, así que no salió al teléfono."
    return venta


@app.post("/api/caja/cobro")
async def caja_cobro(body: VentaIn, k: str | None = Query(None)):
    """El QR del ticket. Crearlo no cobra: el banco avisa cuando el dinero entra."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio cobra en caja.")
    from app.departamentos import cobranza
    from app.departamentos.almacen import cotizar_caja
    from app.db import conectar

    contacto = obtener_o_crear(telefono)
    ticket = 0
    if body.lineas:
        try:
            ticket = cotizar_caja([{"sku": linea.sku, "cantidad": linea.cantidad} for linea in body.lineas])
        except ValueError:
            ticket = 0
    with conectar() as conn:
        ya = conn.execute(
            """SELECT * FROM cobros
               WHERE contacto_id=? AND metodo='qr' AND estado='pendiente'
                 AND qr_string IS NOT NULL AND qr_string!=''
               ORDER BY id DESC LIMIT 1""",
            (contacto["id"],),
        ).fetchone()
    if ya:
        return {
            "cobro_id": ya["id"],
            "monto": fmt_mxn(ya["monto_centavos"]),
            "ticket": fmt_mxn(ticket or ya["monto_centavos"]),
            "qr": f"/qr/{ya['id']}.png",
            "quien": contacto.get("nombre") or "Miriam",
        }
    try:
        cobro = await cobranza.crear_cobro(
            "libre",
            "qr",
            ticket or MONTO_CENTAVO,
            contacto["id"],
            None,
            "Cobro CoDi de la caja",
            expiration=600,
        )
    except pey.PeyError as exc:
        raise HTTPException(502, "No pude crear el código de pago.") from exc
    return {
        "cobro_id": cobro["id"],
        "monto": fmt_mxn(cobro["monto_centavos"]),
        "ticket": fmt_mxn(ticket or cobro["monto_centavos"]),
        "qr": f"/qr/{cobro['id']}.png",
        "quien": contacto.get("nombre") or "Miriam",
    }


@app.post("/api/orden/aprobar")
async def orden_aprobar(body: OrdenIn, k: str | None = Query(None)):
    """La dueña dice sí y el pedido queda en la ficha del proveedor."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio aprueba la orden.")
    from app.departamentos.almacen import aprobar_orden

    try:
        texto = aprobar_orden(int(body.orden_id))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "nota": texto + " Quedó en su ficha. Meta no tiene las llaves, así que no salió al teléfono."}


@app.post("/api/almacen/ajustar")
async def ajustar_almacen(body: AjusteIn, k: str | None = Query(None)):
    """El negocio suma o baja una pieza. No pone un precio nuevo."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio ajusta el almacén.")
    from app.departamentos.almacen import ajustar

    try:
        nota = ajustar(body.sku, int(body.delta))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "nota": nota}


@app.post("/api/almacen/precio")
async def precio_almacen(body: PrecioIn, k: str | None = Query(None)):
    """Pone el precio de venta. El costo del lote no se mueve."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio pone el precio de venta.")
    from app.departamentos.almacen import poner_precio

    try:
        nota = poner_precio(body.sku, body.precio_pesos)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "nota": nota}


@app.post("/api/almacen/merma")
async def merma_almacen(body: MermaIn, k: str | None = Query(None)):
    """Caducó, se rompió o se perdió. Baja el lote de enfrente y no se anota como venta."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio anota la merma.")
    from app.departamentos.almacen import registrar_merma

    try:
        nota = registrar_merma(body.sku, body.motivo)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "nota": nota}


@app.post("/api/almacen/correo")
async def correo_almacen(body: CentavoIn, k: str | None = Query(None)):
    """Busca facturas XML nuevas en el correo del negocio y las mete al almacén."""
    _llave(k)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio revisa el correo.")
    from app.correo_facturas import traer

    contacto = obtener_o_crear(telefono)
    return {"ok": True, "nota": traer(contacto["id"])}


@app.post("/api/favorito")
async def guardar_favorito(body: FavoritoIn, k: str | None = Query(None)):
    """La estrella guarda un servicio que ya se pagó. No inventa uno nuevo."""
    _llave(k)
    try:
        desde = a_telefono10(body.desde)
        para = a_telefono10(body.para)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if desde not in owner_phones():
        raise HTTPException(403, "Solo el negocio marca favoritos.")
    contacto = obtener_o_crear(para)
    if contacto["rol"] == "dueno":
        raise HTTPException(400, "Ese número es del negocio.")
    with transaccion() as conn:
        quedo = marcar_favorito(conn, contacto["id"], body.texto)
    if quedo is None:
        raise HTTPException(400, "Ese servicio no está en lo que ya pagó.")
    return {"ok": True, "favorito": quedo}


@app.get("/api/tablero")
async def tablero(k: str | None = Query(None), telefono: str | None = Query(None), hilo: str | None = Query(None), con: str | None = Query(None)):
    _llave(k)
    return foto(telefono, hilo=hilo, con=con)


@app.post("/api/simular-banco")
async def simular_banco(body: BancoIn, k: str | None = Query(None)):
    """Imita el aviso que pey manda después del Face ID. No llama a pey ni acepta un monto del cliente."""
    _llave(k)
    with transaccion() as conn:
        cobro = conn.execute("SELECT * FROM cobros WHERE id=?", (body.cobro_id,)).fetchone()
        if not cobro:
            raise HTTPException(404, "No está ese cobro.")
        if cobro["metodo"] != "simulacion":
            raise HTTPException(409, "Ese cobro lo confirma pey, no esta pantalla.")
        if cobro["estado"] != "pendiente":
            raise HTTPException(409, "Ese cobro ya no está pendiente.")
        resultado = aplicar_pago_en_tx(
            conn,
            transaction_id=f"sim-{cobro['id']}",
            monto_centavos=int(cobro["monto_centavos"]),
            tipo_evento="simulacion_local",
            payload={"origen": "simulacion_local", "cobro_id": cobro["id"]},
            cobro=cobro,
        )
    return {"ok": True, "mensajes": resultado.get("mensajes") or []}


@app.post("/api/resena")
async def crear_resena(body: ResenaIn, k: str | None = Query(None)):
    _llave(k)
    texto = (body.texto or "").strip()
    if not texto or not 1 <= body.estrellas <= 3:
        raise HTTPException(400, "Escribe una reseña y elige de una a tres estrellas.")
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    contacto = obtener_o_crear(telefono)
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO resenas (contacto_id, texto, estrellas, creado_en) VALUES (?, ?, ?, ?)",
            (contacto["id"], texto[:280], body.estrellas, ahora_iso()),
        )
    return {"ok": True}


class RolIn(BaseModel):
    email: str = ""
    rol: str
    codigo: str = ""
    credential: str = ""
    metodo: str = "cara"


class BioIn(BaseModel):
    desafio_id: str
    credencial_id: str
    publica: str
    firma: str


@app.get("/api/seguridad/estado")
async def seguridad_estado(k: str | None = Query(None)):
    _llave(k)
    client_id = env("GOOGLE_CLIENT_ID")
    return {"google": bool(client_id), "client_id": client_id}


class CaraIn(BaseModel):
    rol: str
    imagen: str


@app.post("/api/seguridad/cara")
async def seguridad_cara(body: CaraIn, k: str | None = Query(None)):
    _llave(k)
    return seguridad.registrar_cara(body.rol, body.imagen)


@app.post("/api/seguridad/entrar")
async def seguridad_entrar(body: RolIn, k: str | None = Query(None)):
    _llave(k)
    return seguridad.entrar_aparato(body.rol, body.metodo or "cara")


@app.post("/api/seguridad/correo")
async def seguridad_correo(body: RolIn, request: Request, k: str | None = Query(None)):
    _llave(k)
    return seguridad.pedir_codigo(body.email, body.rol, seguridad.host_de(request))


@app.post("/api/seguridad/codigo")
async def seguridad_codigo(body: RolIn, k: str | None = Query(None)):
    _llave(k)
    return seguridad.confirmar_codigo(body.email, body.codigo, body.rol)


@app.post("/api/seguridad/google")
async def seguridad_google(body: RolIn, k: str | None = Query(None)):
    _llave(k)
    return await seguridad.confirmar_google(body.credential, body.rol)


@app.post("/api/seguridad/bio/desafio")
async def seguridad_desafio(k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    _llave(k)
    return seguridad.nuevo_desafio(sesion)


@app.post("/api/seguridad/bio/confirmar")
async def seguridad_bio(body: BioIn, k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    _llave(k)
    return seguridad.confirmar_bio(sesion, body.desafio_id, body.credencial_id, body.publica, body.firma)


@app.get("/api/seguridad/eventos")
async def seguridad_eventos(k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    _llave(k)
    return seguridad.eventos(sesion)


@app.post("/api/cobro-centavo")
async def cobro_centavo(body: CentavoIn, k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    """QR real de $0.01. Crear el código no cobra; paga el banco."""
    _llave(k)
    cuenta = seguridad.exigir(sesion, completa=True)
    try:
        telefono = a_telefono10(body.telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    seguridad.mismo_telefono(cuenta, telefono)
    contacto = obtener_o_crear(telefono)
    with conectar() as conn:
        ya = conn.execute(
            """SELECT * FROM cobros
               WHERE contacto_id=? AND metodo='qr' AND monto_centavos=? AND estado='pendiente'
                 AND qr_string IS NOT NULL
               ORDER BY id DESC LIMIT 1""",
            (contacto["id"], MONTO_CENTAVO),
        ).fetchone()
    if ya:
        return {"cobro_id": ya["id"], "monto": fmt_mxn(MONTO_CENTAVO), "qr": f"/qr/{ya['id']}.png"}
    seguridad.vigilar_cobro(cuenta)
    try:
        cobro = await cobranza.crear_cobro(
            "libre", "qr", MONTO_CENTAVO, contacto["id"], None, "Pago de prueba $0.01", expiration=600
        )
    except pey.PeyError as exc:
        raise HTTPException(502, "No pude crear el código de $0.01.") from exc
    if int(cobro["monto_centavos"]) != MONTO_CENTAVO:
        raise HTTPException(409, "Por ahora solo pagos de $0.01.")
    return {"cobro_id": cobro["id"], "monto": fmt_mxn(MONTO_CENTAVO), "qr": f"/qr/{cobro['id']}.png"}


@app.post("/api/escanear")
async def escanear(body: EscanerIn, k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    _llave(k)
    seguridad.exigir(sesion, completa=True)
    texto = (body.texto or "").strip()
    if not texto or len(texto) > 4000:
        raise HTTPException(400, "Ese código no se lee.")
    with conectar() as conn:
        cobro = _cobro_por_codigo(conn, texto)
    if not cobro:
        raise HTTPException(404, "Ese código no es un cobro de $0.01.")
    if int(cobro["monto_centavos"]) != MONTO_CENTAVO:
        raise HTTPException(409, "Por ahora solo pagos de $0.01.")
    return {
        "cobro_id": cobro["id"],
        "monto": fmt_mxn(MONTO_CENTAVO),
        "estado": cobro["estado"],
        "concepto": cobro["concepto"],
    }


@app.post("/api/cobro-centavo/{cobro_id}/mirar")
async def mirar_centavo(cobro_id: int, k: str | None = Query(None), sesion: str | None = Header(None, alias="X-Anillo-Sesion")):
    """Pregunta a pey si el banco ya marcó pagado el QR de $0.01. La cara de esta app no paga."""
    _llave(k)
    seguridad.exigir(sesion, completa=True)
    with conectar() as conn:
        cobro = conn.execute("SELECT * FROM cobros WHERE id=?", (cobro_id,)).fetchone()
    if not cobro:
        raise HTTPException(404, "No está ese cobro.")
    if int(cobro["monto_centavos"]) != MONTO_CENTAVO:
        raise HTTPException(409, "Por ahora solo pagos de $0.01.")
    if cobro["pey_qr_id"]:
        try:
            data = await pey.transacciones_qr(cobro["pey_qr_id"])
        except pey.PeyError as exc:
            raise HTTPException(502, "No pude preguntarle al banco.") from exc
        for item in data.get("items") or []:
            if item.get("status") == "PAID":
                await procesar_transaccion_confirmada(item, "reconciliacion_qr", {"codiQrId": cobro["pey_qr_id"]})
    with conectar() as conn:
        fresco = conn.execute("SELECT estado FROM cobros WHERE id=?", (cobro_id,)).fetchone()
    return {"estado": fresco["estado"], "monto": fmt_mxn(MONTO_CENTAVO), "resenas": lugares_resena()}


def _cobro_por_codigo(conn, texto: str):
    import re

    exacto = conn.execute("SELECT * FROM cobros WHERE qr_string=?", (texto,)).fetchone()
    if exacto:
        return exacto
    hallado = re.search(r'"IDC"\s*:\s*"([A-Za-z0-9]+)"', texto)
    if hallado:
        row = conn.execute("SELECT * FROM cobros WHERE pey_qr_id=?", (hallado.group(1),)).fetchone()
        if row:
            return row
    return conn.execute(
        "SELECT * FROM cobros WHERE pey_qr_id=? OR qr_string=?",
        (texto, texto),
    ).fetchone()


@app.post("/api/cargar")
async def cargar_archivo(
    archivo: UploadFile = File(...),
    telefono10: str = Form(...),
    k: str | None = Query(None),
    sesion: str | None = Header(None, alias="X-Anillo-Sesion"),
):
    _llave(k)
    cuenta = seguridad.exigir(sesion, completa=True)
    try:
        telefono = a_telefono10(telefono10)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    seguridad.mismo_telefono(cuenta, telefono)
    if telefono not in owner_phones():
        raise HTTPException(403, "Solo el negocio carga listas.")
    nombre = (archivo.filename or "archivo").lower()
    sufijo = Path(nombre).suffix
    tipos = {
        ".pdf": "pdf",
        ".xml": "xml",
        ".csv": "excel",
        ".xlsx": "excel",
        ".mp3": "audio",
        ".m4a": "audio",
        ".wav": "audio",
        ".webm": "audio",
        ".ogg": "audio",
        ".jpg": "foto",
        ".jpeg": "foto",
        ".png": "foto",
        ".webp": "foto",
    }
    if sufijo not in tipos:
        raise HTTPException(400, "Usa el Excel de la tienda, la factura o una foto de la lista.")
    data = await archivo.read(8_000_000)
    if not data:
        raise HTTPException(400, "El archivo vino vacío.")
    destino = archivos_dir() / f"{ahora_iso().replace(':', '').replace('-', '')}{sufijo}"
    destino.write_bytes(data)
    contacto = obtener_o_crear(telefono)
    if sufijo == ".csv":
        nota = cargas.aplicar_tabla(cargas.leer_csv(data))
    elif sufijo == ".xlsx":
        nota = cargas.aplicar_tabla(cargas.leer_xlsx(data))
    elif sufijo == ".xml":
        nota = cargas.leer_cfdi(data)
    elif sufijo == ".pdf":
        nota = await cargas.leer_documento(data)
    elif sufijo in {".jpg", ".jpeg", ".png", ".webp"}:
        mime = "image/png" if sufijo == ".png" else "image/webp" if sufijo == ".webp" else "image/jpeg"
        nota = await cargas.leer_imagen(data, mime)
    else:
        nota = cargas.texto_sin_lista()
    cargas.guardar_nota(contacto["id"], tipos[sufijo], destino.name, nota)
    return {"ok": True, "nota": nota}


@app.post("/api/cobro-prueba")
async def cobro_prueba(k: str | None = Query(None)):
    _llave(k)
    contacto = obtener_o_crear("5500000000", nombre="Mostrador")
    cobro = await cobranza.crear_cobro("libre", "qr", MONTO_CENTAVO, contacto["id"], None, "Cobro de prueba $0.01", expiration=600)
    return {"cobro_id": cobro["id"], "monto": fmt_mxn(cobro["monto_centavos"]), "qr": f"/qr/{cobro['id']}.png"}


@app.get("/api/estado")
async def estado(k: str | None = Query(None)):
    _llave(k)
    neg = negocio()
    tz_hoy = ahora_iso()[:10]
    with conectar() as conn:
        cobros = filas(conn.execute("SELECT * FROM cobros ORDER BY id DESC LIMIT 12").fetchall())
        citas_hoy = filas(
            conn.execute(
                """SELECT c.*, co.nombre, co.telefono10 FROM citas c
                   JOIN contactos co ON co.id=c.contacto_id
                   WHERE c.estado IN ('apartada','confirmada') ORDER BY c.inicio LIMIT 12"""
            ).fetchall()
        )
        feed = filas(conn.execute("SELECT contenido, creado_en FROM mensajes ORDER BY id DESC LIMIT 10").fetchall())
    datos = resumen("mes")
    qr = next((c for c in cobros if c["metodo"] == "qr" and c["estado"] == "pendiente" and c.get("qr_string")), None)
    return {
        "negocio": neg.get("nombre_comercial"),
        "ahora": tz_hoy,
        "cobros": [
            {
                "id": c["id"],
                "estado": c["estado"],
                "metodo": c["metodo"],
                "tipo": c["tipo"],
                "monto": fmt_mxn(c["monto_centavos"]),
                "concepto": c["concepto"],
                "tardio": bool(c["pago_tardio"]),
            }
            for c in cobros
        ],
        "citas": [{"inicio": c["inicio"], "estado": c["estado"], "quien": c["nombre"] or c["telefono10"]} for c in citas_hoy],
        "mes": {
            "cobrado": fmt_mxn(datos["cobrado_centavos"]),
            "por_cobrar": fmt_mxn(datos["por_cobrar_centavos"]),
            "gastos": fmt_mxn(datos["gastos_centavos"]),
            "utilidad": fmt_mxn(datos["utilidad_centavos"]),
        },
        "feed": list(reversed(feed)),
        "qr": {"id": qr["id"], "monto": fmt_mxn(qr["monto_centavos"]), "concepto": qr["concepto"]} if qr else None,
        "simulado": "El CFDI es borrador (sin PAC ni CSD). Los impuestos son una estimación. Las devoluciones son manuales.",
    }


@app.get("/qr/{cobro_id}.png")
async def qr_png(cobro_id: int):
    with conectar() as conn:
        row = conn.execute("SELECT qr_string FROM cobros WHERE id=?", (cobro_id,)).fetchone()
    if not row or not row["qr_string"]:
        raise HTTPException(404, "Sin QR")
    imagen = qrcode.make(row["qr_string"])
    buf = io.BytesIO()
    imagen.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@app.get("/archivos/{nombre}")
async def archivo(nombre: str):
    limpio = Path(nombre).name
    if limpio != nombre or ".." in nombre:
        raise HTTPException(404, "No encontrado")
    ruta = (archivos_dir() / limpio).resolve()
    if ruta.parent != archivos_dir().resolve() or not ruta.is_file():
        raise HTTPException(404, "No encontrado")
    media = "application/pdf" if ruta.suffix.lower() == ".pdf" else "application/octet-stream"
    return Response(content=ruta.read_bytes(), media_type=media)


@app.get("/marca/tokens.css")
async def marca_css():
    ruta = Path(__file__).resolve().parents[1] / "design" / "mesa-cdmx" / "tokens.css"
    return Response(ruta.read_text(encoding="utf-8"), media_type="text/css")


@app.get("/app", response_class=HTMLResponse)
async def aplicacion():
    return HTMLResponse((WEB / "app.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-store"})


@app.get("/manifest.webmanifest")
async def manifest():
    return Response((WEB / "manifest.webmanifest").read_text(encoding="utf-8"), media_type="application/manifest+json")


@app.get("/marca/icon-{tam}.png")
async def icono(tam: int):
    if tam not in (192, 512):
        raise HTTPException(404, "No encontrado")
    ruta = Path(__file__).resolve().parents[1] / "design" / "mesa-cdmx" / f"icon-{tam}.png"
    return Response(ruta.read_bytes(), media_type="image/png")


@app.get("/simulacion", response_class=HTMLResponse)
async def simulacion_pagina():
    return (WEB / "simulacion.html").read_text(encoding="utf-8")


@app.get("/panel", response_class=HTMLResponse)
async def panel():
    return (WEB / "panel.html").read_text(encoding="utf-8")


@app.get("/demo", response_class=HTMLResponse)
async def demo():
    return (WEB / "demo.html").read_text(encoding="utf-8")


@app.get("/privacidad", response_class=HTMLResponse)
async def privacidad():
    nombre = negocio().get("nombre_comercial", "el negocio")
    return f"""<!doctype html><meta charset="utf-8"><title>Aviso de privacidad</title>
    <body style="font-family:Segoe UI,sans-serif;max-width:640px;margin:40px auto;line-height:1.5">
    <h1>Aviso de privacidad</h1>
    <p>{nombre} usa tu número de teléfono y los datos de tus pagos solo para cotizar, agendar y cobrar este servicio.</p>
    <p>No se venden. El pago lo confirma el banco por CoDi. Este aviso es de la demo del hackatón.</p>
    </body>"""
