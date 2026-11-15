"""Ayudas de firma para los tests. No es el conftest, para poder importarlo sin registrar fixtures dos veces."""

import base64
import hashlib
import hmac
import time

SECRET_RAW = b"super-secret-key-for-tests-32b!"
SECRET = "whsec_" + base64.b64encode(SECRET_RAW).decode()


def firmar(body: bytes, secret: str = SECRET) -> dict:
    wid = "msg_" + str(time.time_ns())
    ts = str(int(time.time()))
    llave = base64.b64decode(secret.removeprefix("whsec_"))
    firma = base64.b64encode(hmac.new(llave, f"{wid}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    return {"webhook-id": wid, "webhook-timestamp": ts, "webhook-signature": f"v1,{firma}"}
