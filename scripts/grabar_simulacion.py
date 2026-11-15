"""Graba en texto un recorrido simulado: cita, cobro del banco (simulado), venta y almacén.

No mueve dinero real. Usa la mesa (/api/simular-banco), que el banco simulado marca.
Uso: python scripts/grabar_simulacion.py http://127.0.0.1:8000 <PANEL_KEY>
"""
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime

BASE, LLAVE = sys.argv[1].rstrip("/"), sys.argv[2]
CLIENTE, DUENO = "5522222222", "5511111111"
pasos = []


def llamar(metodo, ruta, cuerpo=None):
    url = f"{BASE}{ruta}{'&' if '?' in ruta else '?'}k={urllib.parse.quote(LLAVE)}"
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def chat(tel, texto, quien):
    r = llamar("POST", "/api/chat?modo=simulacion", {"telefono10": tel, "texto": texto})
    pasos.append((quien, texto, r.get("respuesta", "")))
    return r.get("respuesta", "")


def estado():
    return llamar("GET", "/api/estado")


chat(CLIENTE, "quiero comprar una cita para el peluquero", "Cliente")
chat(CLIENTE, "va", "Cliente")
chat(CLIENTE, "el de las 5", "Cliente")
pendientes = [c for c in estado()["cobros"] if c["estado"] == "pendiente" and c["metodo"] == "simulacion"]
if not pendientes:
    sys.exit("No hay cobro pendiente del banco simulado. Revisa la cita.")
cobro = pendientes[0]["id"]
pasos.append(("Banco (simulado)", f"Cobro {cobro} pendiente de autorizar. Trámite falso de Face ID.", ""))
resp = llamar("POST", "/api/simular-banco", {"cobro_id": cobro})
pasos.append(("Banco (simulado)", "Autorizado. El aviso se aplica una sola vez.", "; ".join(m["texto"] for m in resp.get("mensajes", []))))
repetido = urllib.request.Request(f"{BASE}/api/simular-banco?k={urllib.parse.quote(LLAVE)}", data=json.dumps({"cobro_id": cobro}).encode(), method="POST", headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(repetido, timeout=30)
    repetido_txt = "ERROR: se aplicó dos veces"
except urllib.error.HTTPError as e:
    repetido_txt = f"Rechazado ({e.code}): {json.loads(e.read()).get('detail')}"
pasos.append(("Banco (simulado)", "Mismo aviso otra vez", repetido_txt))

chat(DUENO, "existencias", "Dueño")
chat(DUENO, "factura tinte 6 piezas a 80", "Dueño")
chat(DUENO, "existencias", "Dueño")

s = estado()
lineas = [
    f"# Grabación del recorrido simulado · {datetime.now():%Y-%m-%d %H:%M}",
    "",
    "Recorrido generado contra el servidor local. El banco es simulado; ningún pago real se hizo.",
    "",
    "| Quién | Qué se pidió | Qué respondió Anillo |",
    "|---|---|---|",
]
for quien, texto, resp in pasos:
    limpio = (resp or "").replace("\n", " ⏎ ").replace("|", "/")
    lineas.append(f"| {quien} | {texto} | {limpio[:400]} |")
lineas += ["", "## Estado al terminar", "", f"- Mes: cobrado {s['mes']['cobrado']}, por cobrar {s['mes']['por_cobrar']}, utilidad {s['mes']['utilidad']}",
           f"- Citas: " + ", ".join(f"{c['inicio']} ({c['estado']})" for c in s["citas"]) if s["citas"] else "- Citas: ninguna"]
open("docs/simulacion/grabacion.md", "w", encoding="utf-8").write("\n".join(lineas) + "\n")
print("\n".join(lineas))
