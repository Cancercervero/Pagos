"""Facturas que llegan al correo del negocio. Solo XML. No inventa piezas."""

import imaplib
from email import message_from_bytes
from email.message import Message

from app.config import env
from app.departamentos.cargas import guardar_nota, leer_cfdi
from app.db import conectar


def traer(contacto_id: int) -> str:
    host = env("CORREO_IMAP")
    usuario = env("CORREO_USUARIO")
    clave = env("CORREO_CLAVE")
    if not host or not usuario or not clave:
        return (
            "El correo todavía no está conectado. "
            "Cuando lo esté, las facturas XML que te manden entran solas al almacén."
        )
    puerto = int(env("CORREO_IMAP_PUERTO", "993") or "993")
    try:
        buzon = imaplib.IMAP4_SSL(host, puerto)
        buzon.login(usuario, clave)
    except Exception:
        return "No pude entrar al correo. No cargué ninguna factura."
    try:
        buzon.select("INBOX")
        estado, datos = buzon.search(None, "UNSEEN")
        if estado != "OK" or not datos or not datos[0]:
            return "Revisé el correo. No hay facturas nuevas."
        ids = datos[0].split()[-10:]
        notas = []
        for num in ids:
            estado, crudo = buzon.fetch(num, "(RFC822)")
            if estado != "OK" or not crudo or not crudo[0]:
                continue
            mensaje = message_from_bytes(crudo[0][1])
            clave_msg = (mensaje.get("Message-ID") or num.decode()).strip()
            marca = "correo:" + clave_msg[:180]
            with conectar() as conn:
                ya = conn.execute("SELECT id FROM cargas WHERE path=?", (marca,)).fetchone()
            if ya:
                continue
            xmls = _xmls(mensaje)
            if not xmls:
                continue
            for xml in xmls:
                notas.append(leer_cfdi(xml))
            guardar_nota(contacto_id, "correo", marca, " ".join(notas)[:500] or "sin xml")
            buzon.store(num, "+FLAGS", "\\Seen")
        if not notas:
            return "Revisé el correo. No llegó ninguna factura XML nueva."
        return " ".join(notas)
    finally:
        try:
            buzon.logout()
        except Exception:
            pass


def _xmls(mensaje: Message) -> list[bytes]:
    salidas = []
    for parte in mensaje.walk():
        nombre = (parte.get_filename() or "").lower()
        tipo = (parte.get_content_type() or "").lower()
        if not nombre.endswith(".xml") and "xml" not in tipo:
            continue
        datos = parte.get_payload(decode=True)
        if datos:
            salidas.append(datos)
    return salidas
