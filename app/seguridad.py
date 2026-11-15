"""Entrada por correo, Google, huella del aparato o la foto de la cámara."""

import base64
import hashlib
import hmac
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import httpx
from fastapi import HTTPException, Request

from app.config import env, owner_phones
from app.db import ahora_iso, conectar, filas, transaccion

_CLIENTE = "5522222222"
_VENTANA_MIN = 15
_MAX_FALLOS = 5
_MAX_COBROS = 3


def _hash(valor: str) -> str:
    pimienta = env("PANEL_KEY") or "anillo-local"
    return hmac.new(pimienta.encode(), valor.encode(), hashlib.sha256).hexdigest()


def _en(minutos: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutos)).replace(microsecond=0).isoformat()


def _pasado(iso: str | None) -> bool:
    if not iso:
        return True
    return iso <= ahora_iso()


def anotar(conn, cuenta_id: int | None, tipo: str, detalle: str) -> None:
    conn.execute(
        "INSERT INTO eventos_seguridad (cuenta_id, tipo, detalle, creado_en) VALUES (?, ?, ?, ?)",
        (cuenta_id, tipo, detalle[:240], ahora_iso()),
    )


def _telefono(rol: str) -> str:
    if rol == "dueno":
        tels = sorted(owner_phones())
        if not tels:
            raise HTTPException(400, "Este negocio no tiene teléfono de dueño.")
        return tels[0]
    if rol == "cliente":
        return _CLIENTE
    raise HTTPException(400, "Elige persona o negocio.")


def _cuenta(conn, email: str, rol: str, google_sub: str | None = None) -> dict:
    email = email.strip().lower()
    row = conn.execute("SELECT * FROM cuentas WHERE email=?", (email,)).fetchone()
    tel = _telefono(rol)
    if row:
        if row["rol"] != rol:
            anotar(conn, row["id"], "rol_distinto", "El correo ya está en el otro perfil.")
            raise HTTPException(409, "Ese correo ya entra con el otro perfil.")
        if google_sub and not row["google_sub"]:
            conn.execute("UPDATE cuentas SET google_sub=? WHERE id=?", (google_sub, row["id"]))
        return dict(conn.execute("SELECT * FROM cuentas WHERE id=?", (row["id"],)).fetchone())
    conn.execute(
        "INSERT INTO cuentas (email, google_sub, rol, telefono10, creada_en) VALUES (?, ?, ?, ?, ?)",
        (email, google_sub, rol, tel, ahora_iso()),
    )
    creada = dict(conn.execute("SELECT * FROM cuentas WHERE email=?", (email,)).fetchone())
    anotar(conn, creada["id"], "cuenta_nueva", f"Alta {rol}.")
    return creada


def _bloqueada(conn, cuenta: dict) -> None:
    if cuenta.get("bloqueada_hasta") and not _pasado(cuenta["bloqueada_hasta"]):
        anotar(conn, cuenta["id"], "bloqueada", "Intento con la cuenta bloqueada.")
        raise HTTPException(423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")


def _fallos(conn, cuenta_id: int) -> int:
    desde = _en(-_VENTANA_MIN)
    row = conn.execute(
        """SELECT COUNT(*) AS c FROM eventos_seguridad
           WHERE cuenta_id=? AND tipo IN ('codigo_fallido', 'bio_fallida') AND creado_en>=?""",
        (cuenta_id, desde),
    ).fetchone()
    return int(row["c"])


def _castigar(conn, cuenta_id: int) -> None:
    if _fallos(conn, cuenta_id) >= _MAX_FALLOS:
        hasta = _en(_VENTANA_MIN)
        conn.execute("UPDATE cuentas SET bloqueada_hasta=? WHERE id=?", (hasta, cuenta_id))
        anotar(conn, cuenta_id, "bloqueo", "Demasiados intentos. Entrada bloqueada.")
        raise HTTPException(423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")


def _sesion(conn, cuenta_id: int, nivel: str) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sesiones (token_hash, cuenta_id, nivel, creada_en, expira_en) VALUES (?, ?, ?, ?, ?)",
        (_hash(token), cuenta_id, nivel, ahora_iso(), _en(12 * 60)),
    )
    return token


def cuenta_de_token(token: str | None) -> dict | None:
    if not token:
        return None
    with conectar() as conn:
        row = conn.execute(
            """SELECT s.nivel, s.expira_en, c.*
               FROM sesiones s JOIN cuentas c ON c.id=s.cuenta_id
               WHERE s.token_hash=?""",
            (_hash(token),),
        ).fetchone()
    if not row or _pasado(row["expira_en"]):
        return None
    return dict(row)


def exigir(token: str | None, completa: bool = False) -> dict:
    cuenta = cuenta_de_token(token)
    if not cuenta:
        raise HTTPException(401, "Falta la verificación.")
    if cuenta.get("bloqueada_hasta") and not _pasado(cuenta["bloqueada_hasta"]):
        with transaccion() as conn:
            anotar(conn, cuenta["id"], "bloqueada", "Intento con la cuenta bloqueada.")
        raise HTTPException(423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")
    if completa and cuenta["nivel"] != "completa":
        with transaccion() as conn:
            anotar(conn, cuenta["id"], "movimiento_bloqueado", "Faltó la biometría.")
        raise HTTPException(403, "Falta la cara o la huella. El movimiento está bloqueado.")
    return cuenta


def vigilar_cobro(cuenta: dict) -> None:
    desde = _en(-10)
    bloquear = False
    with transaccion() as conn:
        n = conn.execute(
            """SELECT COUNT(*) AS c FROM eventos_seguridad
               WHERE cuenta_id=? AND tipo='cobro_intent' AND creado_en>=?""",
            (cuenta["id"], desde),
        ).fetchone()["c"]
        if int(n) >= _MAX_COBROS:
            anotar(conn, cuenta["id"], "movimiento_inusual", "Demasiados cobros de prueba seguidos.")
            bloquear = True
        else:
            anotar(conn, cuenta["id"], "cobro_intent", "Código de $0.01.")
    if bloquear:
        raise HTTPException(429, "Bloqueamos este cobro: son demasiados seguidos.")


def mismo_telefono(cuenta: dict, telefono10: str) -> None:
    if telefono10 == cuenta["telefono10"]:
        return
    with transaccion() as conn:
        anotar(conn, cuenta["id"], "movimiento_ajeno", "El teléfono no es el de esta sesión.")
    raise HTTPException(403, "Esta sesión no puede mover la cuenta de otra persona.")


def codigo_visible(host: str) -> bool:
    if env("SMTP_HOST"):
        return False
    return host in {"127.0.0.1", "::1", "testclient", "10.0.2.2"}


def pedir_codigo(email: str, rol: str, host: str) -> dict:
    email = (email or "").strip().lower()
    if "@" not in email or len(email) > 120:
        raise HTTPException(400, "Escribe un correo válido.")
    codigo = f"{secrets.randbelow(1_000_000):06d}"
    with transaccion() as conn:
        cuenta = _cuenta(conn, email, rol)
        _bloqueada(conn, cuenta)
        conn.execute("UPDATE codigos_correo SET usado=1 WHERE cuenta_id=? AND usado=0", (cuenta["id"],))
        conn.execute(
            """INSERT INTO codigos_correo (cuenta_id, codigo_hash, expira_en, creado_en)
               VALUES (?, ?, ?, ?)""",
            (cuenta["id"], _hash(codigo), _en(10), ahora_iso()),
        )
        anotar(conn, cuenta["id"], "codigo_pedido", "Se pidió código de correo.")
    _enviar_correo(email, codigo)
    return {"ok": True, "codigo_local": codigo if codigo_visible(host) else None}


def confirmar_codigo(email: str, codigo: str, rol: str) -> dict:
    email = (email or "").strip().lower()
    codigo = (codigo or "").strip()
    fallo: tuple[int, str] | None = None
    token = ""
    telefono = ""
    with transaccion() as conn:
        row_cuenta = conn.execute("SELECT * FROM cuentas WHERE email=?", (email,)).fetchone()
        if not row_cuenta or row_cuenta["rol"] != rol:
            fallo = (401, "Ese código no corresponde.")
        else:
            cuenta = dict(row_cuenta)
            telefono = cuenta["telefono10"]
            if cuenta.get("bloqueada_hasta") and not _pasado(cuenta["bloqueada_hasta"]):
                anotar(conn, cuenta["id"], "bloqueada", "Intento con la cuenta bloqueada.")
                fallo = (423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")
            else:
                row = conn.execute(
                    """SELECT * FROM codigos_correo
                       WHERE cuenta_id=? AND usado=0 ORDER BY id DESC LIMIT 1""",
                    (cuenta["id"],),
                ).fetchone()
                malo = not row or _pasado(row["expira_en"]) or not hmac.compare_digest(row["codigo_hash"], _hash(codigo))
                if malo:
                    anotar(conn, cuenta["id"], "codigo_fallido", "Código incorrecto o vencido.")
                    if _fallos(conn, cuenta["id"]) >= _MAX_FALLOS:
                        conn.execute("UPDATE cuentas SET bloqueada_hasta=? WHERE id=?", (_en(_VENTANA_MIN), cuenta["id"]))
                        anotar(conn, cuenta["id"], "bloqueo", "Demasiados intentos. Entrada bloqueada.")
                        fallo = (423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")
                    else:
                        fallo = (401, "Ese código no corresponde.")
                else:
                    conn.execute("UPDATE codigos_correo SET usado=1 WHERE id=?", (row["id"],))
                    token = _sesion(conn, cuenta["id"], "correo")
                    anotar(conn, cuenta["id"], "correo_ok", "Correo verificado.")
    if fallo:
        raise HTTPException(fallo[0], fallo[1])
    return {"token": token, "nivel": "correo", "telefono10": telefono, "rol": rol}


async def confirmar_google(credential: str, rol: str) -> dict:
    client_id = env("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(400, "Google no está configurado en esta máquina.")
    async with httpx.AsyncClient(timeout=10) as cliente:
        resp = await cliente.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
    if resp.status_code != 200:
        raise HTTPException(401, "Google no reconoció la sesión.")
    datos = resp.json()
    if datos.get("aud") != client_id or str(datos.get("email_verified")).lower() != "true":
        raise HTTPException(401, "Google no reconoció la sesión.")
    email = (datos.get("email") or "").lower()
    sub = datos.get("sub")
    if not email or not sub:
        raise HTTPException(401, "Google no reconoció la sesión.")
    with transaccion() as conn:
        cuenta = _cuenta(conn, email, rol, google_sub=sub)
        _bloqueada(conn, cuenta)
        token = _sesion(conn, cuenta["id"], "correo")
        anotar(conn, cuenta["id"], "google_ok", "Entró con Google.")
    return {"token": token, "nivel": "correo", "telefono10": cuenta["telefono10"], "rol": cuenta["rol"]}


def registrar_cara(rol: str, imagen_b64: str) -> dict:
    """Guarda la cara en SQLite y, si ya hay una, solo abre si es la misma."""
    if rol not in ("cliente", "dueno"):
        raise HTTPException(400, "Elige persona o negocio.")
    datos = _foto(imagen_b64)
    muestra = _muestra_cara(datos)
    correo = "cara@local.anillo" if rol == "cliente" else "negocio@local.anillo"
    fallo: tuple[int, str] | None = None
    token = ""
    reconocida = False
    with transaccion() as conn:
        cuenta = _cuenta(conn, correo, rol)
        _bloqueada(conn, cuenta)
        previa = conn.execute("SELECT firma FROM caras WHERE cuenta_id=?", (cuenta["id"],)).fetchone()
        if previa:
            guardada = [int(n) for n in previa["firma"].split(",")]
            if _distancia(guardada, muestra) > _UMBRAL_CARA:
                anotar(conn, cuenta["id"], "bio_fallida", "La cara no es la de este perfil.")
                fallo = _tras_fallo(conn, cuenta["id"], 401, "Esa cara no es la de este perfil.")
            else:
                mezcla = ",".join(str((a + b) // 2) for a, b in zip(guardada, muestra))
                conn.execute(
                    "UPDATE caras SET foto=?, firma=?, creada_en=? WHERE cuenta_id=?",
                    (datos, mezcla, ahora_iso(), cuenta["id"]),
                )
                token = _sesion(conn, cuenta["id"], "completa")
                anotar(conn, cuenta["id"], "cara_ok", "La cara coincidió con la guardada.")
                reconocida = True
        else:
            conn.execute(
                "INSERT INTO caras (cuenta_id, foto, firma, creada_en) VALUES (?, ?, ?, ?)",
                (cuenta["id"], datos, ",".join(str(n) for n in muestra), ahora_iso()),
            )
            token = _sesion(conn, cuenta["id"], "completa")
            anotar(conn, cuenta["id"], "cara_registrada", "La cámara guardó la cara en la base.")
        telefono = cuenta["telefono10"]
        rol_cuenta = cuenta["rol"]
    if fallo:
        raise HTTPException(fallo[0], fallo[1])
    return {
        "token": token,
        "nivel": "completa",
        "telefono10": telefono,
        "rol": rol_cuenta,
        "registrada": not reconocida,
        "reconocida": reconocida,
    }


def _foto(imagen_b64: str) -> bytes:
    cruda = (imagen_b64 or "").strip()
    if "," in cruda[:40]:
        cruda = cruda.split(",", 1)[1]
    try:
        datos = base64.b64decode(cruda, validate=False)
    except Exception as exc:
        raise HTTPException(400, "No vi una foto.") from exc
    if len(datos) < 100 or len(datos) > 1_500_000 or datos[:2] != b"\xff\xd8":
        raise HTTPException(400, "No vi una foto.")
    return datos


def _muestra_cara(datos: bytes) -> list[int]:
    from io import BytesIO

    from PIL import Image

    try:
        im = Image.open(BytesIO(datos)).convert("L")
    except Exception as exc:
        raise HTTPException(400, "No vi una foto.") from exc
    w, h = im.size
    if w < 32 or h < 32:
        raise HTTPException(400, "No vi tu cara. Acércate a la cámara.")
    im = im.crop((w // 5, h // 5, (w * 4) // 5, (h * 4) // 5))
    chica = im.resize((16, 16))
    muestra = list(chica.tobytes())
    media = sum(muestra) / len(muestra)
    varianza = sum((p - media) ** 2 for p in muestra) / len(muestra)
    if varianza < 40:
        raise HTTPException(400, "No vi tu cara. Mírame de frente.")
    return muestra


def _distancia(guardada: list[int], nueva: list[int]) -> float:
    if len(guardada) != len(nueva) or not guardada:
        return 999
    return sum(abs(a - b) for a, b in zip(guardada, nueva)) / len(guardada)


_UMBRAL_CARA = 36


def entrar_aparato(rol: str, metodo: str) -> dict:
    """La cara o la huella son la entrada. Cada perfil tiene la suya."""
    if metodo not in ("cara", "huella"):
        raise HTTPException(400, "Elige cara o huella.")
    correo = "cara@local.anillo" if rol == "cliente" else "negocio@local.anillo"
    with transaccion() as conn:
        cuenta = _cuenta(conn, correo, rol)
        if cuenta.get("bloqueada_hasta") and not _pasado(cuenta["bloqueada_hasta"]):
            anotar(conn, cuenta["id"], "bloqueada", "Intento con la cuenta bloqueada.")
            raise HTTPException(423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos.")
        token = _sesion(conn, cuenta["id"], "correo")
        desafio = secrets.token_hex(32)
        desafio_id = secrets.token_urlsafe(12)
        conn.execute(
            "INSERT INTO desafios (id, cuenta_id, desafio, expira_en) VALUES (?, ?, ?, ?)",
            (desafio_id, cuenta["id"], desafio, _en(3)),
        )
        anotar(conn, cuenta["id"], "bio_pedida", "Entrada con la cara." if metodo == "cara" else "Entrada con la huella.")
    return {
        "token": token,
        "nivel": "correo",
        "telefono10": cuenta["telefono10"],
        "rol": cuenta["rol"],
        "id": desafio_id,
        "desafio": desafio,
        "alias": f"anillo-{cuenta['id']}",
    }


def nuevo_desafio(token: str) -> dict:
    cuenta = exigir(token)
    desafio = secrets.token_hex(32)
    desafio_id = secrets.token_urlsafe(12)
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO desafios (id, cuenta_id, desafio, expira_en) VALUES (?, ?, ?, ?)",
            (desafio_id, cuenta["id"], desafio, _en(3)),
        )
    return {"id": desafio_id, "desafio": desafio, "alias": f"anillo-{cuenta['id']}"}


def confirmar_bio(token: str, desafio_id: str, credencial_id: str, publica_b64: str, firma_b64: str) -> dict:
    cuenta = exigir(token)
    fallo: tuple[int, str] | None = None
    token_nuevo = ""
    with transaccion() as conn:
        row = conn.execute("SELECT * FROM desafios WHERE id=? AND cuenta_id=?", (desafio_id, cuenta["id"])).fetchone()
        if not row or row["usado"] or _pasado(row["expira_en"]):
            anotar(conn, cuenta["id"], "bio_fallida", "Desafío vencido o repetido.")
            fallo = _tras_fallo(conn, cuenta["id"], 401, "Esa confirmación ya no sirve. Pide otra.")
        else:
            try:
                _verificar_firma(publica_b64, bytes.fromhex(row["desafio"]), firma_b64)
            except Exception:
                anotar(conn, cuenta["id"], "bio_fallida", "La firma biométrica no cuadra.")
                fallo = _tras_fallo(conn, cuenta["id"], 401, "La biometría no cuadra.")
            else:
                previa = conn.execute(
                    "SELECT * FROM credenciales_bio WHERE credencial_id=?",
                    (credencial_id,),
                ).fetchone()
                if previa and (previa["cuenta_id"] != cuenta["id"] or previa["publica"] != publica_b64):
                    anotar(conn, cuenta["id"], "movimiento_inusual", "La llave biométrica no es de esta cuenta.")
                    fallo = (409, "Esa biometría pertenece a otra cuenta.")
                else:
                    if not previa:
                        cuantas = conn.execute(
                            "SELECT COUNT(*) AS c FROM credenciales_bio WHERE cuenta_id=?",
                            (cuenta["id"],),
                        ).fetchone()["c"]
                        if int(cuantas) >= 3:
                            anotar(conn, cuenta["id"], "movimiento_inusual", "Demasiados aparatos.")
                            fallo = (429, "Bloqueamos otro aparato. Ya hay tres.")
                        else:
                            if int(cuantas):
                                anotar(conn, cuenta["id"], "dispositivo_nuevo", "Aparato nuevo después del correo.")
                            conn.execute(
                                """INSERT INTO credenciales_bio (cuenta_id, credencial_id, publica, creada_en)
                                   VALUES (?, ?, ?, ?)""",
                                (cuenta["id"], credencial_id, publica_b64, ahora_iso()),
                            )
                    if not fallo:
                        conn.execute("UPDATE desafios SET usado=1 WHERE id=?", (desafio_id,))
                        token_nuevo = _sesion(conn, cuenta["id"], "completa")
                        anotar(conn, cuenta["id"], "bio_ok", "Cara o huella del aparato.")
    if fallo:
        raise HTTPException(fallo[0], fallo[1])
    return {"token": token_nuevo, "nivel": "completa", "telefono10": cuenta["telefono10"], "rol": cuenta["rol"]}


def _tras_fallo(conn, cuenta_id: int, status: int, mensaje: str) -> tuple[int, str]:
    if _fallos(conn, cuenta_id) >= _MAX_FALLOS:
        conn.execute("UPDATE cuentas SET bloqueada_hasta=? WHERE id=?", (_en(_VENTANA_MIN), cuenta_id))
        anotar(conn, cuenta_id, "bloqueo", "Demasiados intentos. Entrada bloqueada.")
        return 423, "Bloqueamos la entrada por intentos seguidos. Espera unos minutos."
    return status, mensaje


def eventos(token: str) -> dict:
    cuenta = exigir(token)
    with conectar() as conn:
        rows = filas(
            conn.execute(
                """SELECT tipo, detalle, creado_en FROM eventos_seguridad
                   WHERE cuenta_id=? ORDER BY id DESC LIMIT 12""",
                (cuenta["id"],),
            ).fetchall()
        )
        bio = conn.execute(
            "SELECT COUNT(*) AS c FROM credenciales_bio WHERE cuenta_id=?",
            (cuenta["id"],),
        ).fetchone()["c"]
        cara = conn.execute("SELECT 1 FROM caras WHERE cuenta_id=?", (cuenta["id"],)).fetchone()
    return {
        "nivel": cuenta["nivel"],
        "biometria": int(bio) > 0 or cara is not None,
        "cara": cara is not None,
        "telefono10": cuenta["telefono10"],
        "rol": cuenta["rol"],
        "eventos": rows,
    }


def _verificar_firma(publica_b64: str, desafio: bytes, firma_b64: str) -> None:
    import base64

    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    publica = serialization.load_der_public_key(base64.b64decode(publica_b64))
    publica.verify(base64.b64decode(firma_b64), desafio, ec.ECDSA(hashes.SHA256()))


def _enviar_correo(destino: str, codigo: str) -> None:
    host = env("SMTP_HOST")
    if not host:
        return
    mensaje = EmailMessage()
    mensaje["Subject"] = "Tu código de Anillo"
    mensaje["From"] = env("SMTP_FROM") or env("SMTP_USER")
    mensaje["To"] = destino
    mensaje.set_content(f"Tu código es {codigo}. Caduca en 10 minutos. Si no lo pediste, ignóralo.")
    puerto = int(env("SMTP_PORT") or "587")
    with smtplib.SMTP(host, puerto, timeout=10) as smtp:
        smtp.starttls()
        if env("SMTP_USER"):
            smtp.login(env("SMTP_USER"), env("SMTP_PASSWORD"))
        smtp.send_message(mensaje)


def host_de(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return ""
