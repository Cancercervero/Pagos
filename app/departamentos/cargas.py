"""Carga de listas. El archivo trae los precios; este módulo no los inventa."""

import csv
import io
import json
import re
import zipfile
from xml.etree import ElementTree as ET

from app.db import ahora_iso, transaccion
from app.dinero import pesos_a_centavos
from app.personas import obtener_o_crear
from app.telefono import a_telefono10

_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_ALIASES = {
    "sku": "sku",
    "clave": "sku",
    "codigo": "sku",
    "nombre": "nombre",
    "producto": "nombre",
    "precio": "precio",
    "preciodeventa": "precio",
    "venta": "precio",
    "costo": "costo",
    "preciodecompra": "costo",
    "compra": "costo",
    "existencia": "existencia",
    "stock": "existencia",
    "piezas": "existencia",
    "cantidad": "existencia",
    "minimo": "minimo",
    "telefono": "telefono",
    "tel": "telefono",
    "cliente": "cliente",
    "proveedor": "proveedor",
}


def guardar_nota(contacto_id: int | None, tipo: str, path: str, nota: str) -> None:
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO cargas (contacto_id, tipo, path, nota, creado_en) VALUES (?, ?, ?, ?, ?)",
            (contacto_id, tipo, path, nota, ahora_iso()),
        )


def leer_csv(data: bytes) -> list[list[str]]:
    texto = data.decode("utf-8-sig")
    return [fila for fila in csv.reader(io.StringIO(texto)) if any(c.strip() for c in fila)]


def leer_xlsx(data: bytes) -> list[list[str]]:
    libro = zipfile.ZipFile(io.BytesIO(data))
    compartidas: list[str] = []
    if "xl/sharedStrings.xml" in libro.namelist():
        raiz = ET.fromstring(libro.read("xl/sharedStrings.xml"))
        for si in raiz.findall("m:si", _NS):
            partes = [n.text or "" for n in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
            compartidas.append("".join(partes))
    hoja = "xl/worksheets/sheet1.xml"
    if hoja not in libro.namelist():
        return []
    raiz = ET.fromstring(libro.read(hoja))
    filas = []
    for row in raiz.findall("m:sheetData/m:row", _NS):
        vals: list[str] = []
        for celda in row.findall("m:c", _NS):
            ref = celda.attrib.get("r", "A1")
            col = 0
            for ch in ref:
                if ch.isalpha():
                    col = col * 26 + (ord(ch.upper()) - 64)
            while len(vals) < col - 1:
                vals.append("")
            nodo = celda.find("m:v", _NS)
            if nodo is None or nodo.text is None:
                vals.append("")
            elif celda.attrib.get("t") == "s":
                vals.append(compartidas[int(nodo.text)])
            else:
                vals.append(nodo.text)
        if any(v.strip() for v in vals):
            filas.append(vals)
    return filas


def aplicar_tabla(tabla: list[list[str]]) -> str:
    if len(tabla) < 2:
        return "El archivo no trae filas. No inventé precios."
    llaves = [_ALIASES.get(_norm(h), "") for h in tabla[0]]
    productos = clientes = proveedores = saltados = 0
    for cruda in tabla[1:]:
        dato = {}
        for i, llave in enumerate(llaves):
            if llave and i < len(cruda) and str(cruda[i]).strip():
                dato[llave] = str(cruda[i]).strip()
        if not dato:
            continue
        if dato.get("nombre") and (dato.get("precio") or dato.get("costo") or dato.get("existencia")):
            _guardar_producto(dato)
            productos += 1
        elif dato.get("sku") and dato.get("nombre") and dato.get("precio"):
            _guardar_producto(dato)
            productos += 1
        elif dato.get("sku"):
            saltados += 1
        if dato.get("telefono"):
            try:
                tel = a_telefono10(dato["telefono"])
            except ValueError:
                saltados += 1
            else:
                obtener_o_crear(tel, nombre=dato.get("cliente") or dato.get("nombre"))
                clientes += 1
        if dato.get("proveedor"):
            _guardar_proveedor(dato["proveedor"])
            proveedores += 1
    if not productos and not clientes and not proveedores:
        return "Guardé el archivo, pero no trae sku, nombre, precio, telefono o proveedor. No inventé precios."
    extra = f" {saltados} filas incompletas no entraron." if saltados else ""
    return (
        f"Cargué {productos} productos, {clientes} clientes y {proveedores} proveedores.{extra} "
        "Quedaron en su grupo, con su precio y sus piezas. "
        "Lo que llegó primero es lo que sale primero."
    )


def leer_cfdi(data: bytes) -> str:
    """Saca de un CFDI de compra el sku, la cantidad y el precio. Si no vienen, no inventa."""
    try:
        raiz = ET.fromstring(data)
    except ET.ParseError:
        return "Ese XML no se pudo leer. No inventé precios."
    etiqueta = _folio_cfdi(raiz)
    lineas = []
    for nodo in raiz.iter():
        if not nodo.tag.endswith("Concepto"):
            continue
        cantidad = nodo.attrib.get("Cantidad")
        valor = nodo.attrib.get("ValorUnitario")
        nombre = (nodo.attrib.get("Descripcion") or "").strip()
        sku = (nodo.attrib.get("NoIdentificacion") or nodo.attrib.get("ClaveProdServ") or "").strip()
        if not cantidad or not valor or not nombre or not sku:
            continue
        lineas.append((sku, nombre, cantidad, valor))
    if not lineas:
        return "La factura no trae concepto con clave, cantidad y precio. No inventé lotes."
    from app.departamentos.almacen import cargar_entrada

    notas = []
    for sku, nombre, cantidad, valor in lineas:
        piezas = int(float(cantidad))
        if piezas < 1:
            continue
        notas.append(cargar_entrada(sku, nombre, piezas, float(valor), f"Folio {etiqueta}"))
    if not notas:
        return "La factura no trae piezas. No inventé lotes."
    return f"Folio {etiqueta}. " + " ".join(notas)


def _folio_cfdi(raiz) -> str:
    for nodo in raiz.iter():
        if not nodo.tag.endswith("Comprobante"):
            continue
        serie = (nodo.attrib.get("Serie") or "").strip()
        folio = (nodo.attrib.get("Folio") or "").strip()
        junto = "-".join(p for p in (serie, folio) if p)
        return junto or "sin número"
    return "sin número"


def texto_sin_lista() -> str:
    return (
        "Quedó el archivo. Un audio o un PDF no trae columnas, así que no invento precios ni piezas. "
        "Si es la lista, súbela en Excel o CSV con sku, nombre, precio, costo y existencia. "
        "La contabilidad se hace sola cuando el banco confirma un pago."
    )


def grupo_de(nombre: str) -> str:
    """Acomoda por el nombre. No toca precios."""
    t = (nombre or "").lower()
    if any(p in t for p in ("tinte", "coloración", "coloracion", "oxid", "decolor")):
        return "Tintes"
    if "aluminio" in t:
        return "Varios"
    if any(p in t for p in ("jabón", "jabon", "cloro", "papel", "limpia", "shampoo", "toalla", "guante")):
        return "Limpieza"
    if any(p in t for p in ("esmalte", "lima", "uñas", "unas", "manicur", "acetona")):
        return "Manicura"
    return "Varios"


def _sku_de(nombre: str, sku: str = "") -> str:
    if sku.strip():
        return sku.strip().lower()[:40]
    base = "".join(ch if ch.isalnum() else "-" for ch in nombre.lower()).strip("-")
    while "--" in base:
        base = base.replace("--", "-")
    return (base or "pieza")[:40]


def _norm(texto: str) -> str:
    return "".join(ch for ch in texto.lower().strip() if ch.isalnum() or ch == "_")


def _pesos(texto: str) -> int:
    limpio = texto.replace("$", "").replace(",", "").strip()
    return pesos_a_centavos(limpio)


def _guardar_producto(dato: dict) -> None:
    nombre = dato["nombre"].strip()
    sku = _sku_de(nombre, dato.get("sku") or "")
    precio = _pesos(dato["precio"]) if dato.get("precio") else None
    costo = _pesos(dato["costo"]) if dato.get("costo") else 0
    existencia = int(float(dato["existencia"])) if dato.get("existencia") else None
    minimo = int(float(dato["minimo"])) if dato.get("minimo") else 2
    seccion = grupo_de(nombre)
    with transaccion() as conn:
        row = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if row:
            if precio is None:
                conn.execute("UPDATE productos SET nombre=?, seccion=? WHERE id=?", (nombre, seccion, row["id"]))
            else:
                conn.execute(
                    "UPDATE productos SET nombre=?, precio_centavos=?, seccion=? WHERE id=?",
                    (nombre, precio, seccion, row["id"]),
                )
            if costo and existencia is not None:
                conn.execute("UPDATE productos SET costo_centavos=? WHERE id=?", (costo, row["id"]))
            producto_id = row["id"]
        else:
            conn.execute(
                """INSERT INTO productos
                   (sku, nombre, precio_centavos, costo_centavos, existencia, minimo, seccion)
                   VALUES (?, ?, ?, ?, 0, ?, ?)""",
                (sku, nombre, precio or 0, costo, minimo, seccion),
            )
            producto_id = conn.execute("SELECT id FROM productos WHERE sku=?", (sku,)).fetchone()["id"]
        if costo and existencia:
            hay = conn.execute(
                "SELECT COALESCE(SUM(cantidad), 0) AS n FROM lotes WHERE producto_id=? AND cantidad>0",
                (producto_id,),
            ).fetchone()["n"]
            if int(hay) == 0:
                conn.execute(
                    """INSERT INTO lotes (producto_id, factura_id, cantidad, costo_centavos, creado_en)
                       VALUES (?, NULL, ?, ?, ?)""",
                    (producto_id, existencia, costo, ahora_iso()),
                )
                conn.execute(
                    "UPDATE productos SET existencia=? WHERE id=?",
                    (existencia, producto_id),
                )
                conn.execute(
                    """INSERT INTO movimientos_almacen
                       (producto_id, tipo, cantidad, costo_centavos, nota, creado_en)
                       VALUES (?, 'entrada', ?, ?, ?, ?)""",
                    (producto_id, existencia, costo, "Lista de la tienda", ahora_iso()),
                )
        elif existencia is not None:
            conn.execute("UPDATE productos SET existencia=? WHERE id=?", (existencia, producto_id))


def _guardar_proveedor(nombre: str) -> None:
    with transaccion() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO proveedores (nombre, nota, creado_en) VALUES (?, '', ?)",
            (nombre.strip(), ahora_iso()),
        )


_GRUPOS = ("Tintes", "Limpieza", "Manicura", "Varios")
_ORDEN = (
    "Lee únicamente lo que está escrito en la lista o la factura. "
    'Devuelve solo JSON: {"articulos":[{"nombre":"","cantidad":"","costo":"","precio":"","grupo":""}]}. '
    "grupo es Tintes, Limpieza, Manicura o Varios. "
    "cantidad, costo y precio solo si el número se lee en el papel. "
    "Si no se lee, deja el campo en blanco. No inventes artículos ni números. No calcules."
)


def _texto_pdf(data: bytes) -> str:
    partes = re.findall(rb"\((?:\\.|[^\\)]){1,180}\)", data)
    lineas = []
    for parte in partes:
        try:
            texto = parte[1:-1].decode("latin-1")
        except Exception:
            continue
        texto = texto.replace("\\n", " ").replace("\\(", "(").replace("\\)", ")")
        if any(ch.isalpha() for ch in texto):
            lineas.append(texto)
    return "\n".join(lineas)[:12000]


async def leer_imagen(data: bytes, mime: str) -> str:
    import base64

    crudo = base64.b64encode(data).decode()
    return await _pedir_lista(
        [
            {"type": "text", "text": _ORDEN},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{crudo}"}},
        ]
    )


async def leer_documento(data: bytes) -> str:
    cabeza = data.lstrip()[:8000]
    if b"Comprobante" in cabeza or cabeza.startswith(b"<?xml") or cabeza.startswith(b"<cfdi"):
        try:
            return leer_cfdi(data)
        except Exception:
            pass
    texto = _texto_pdf(data)
    if not texto.strip():
        return (
            "Esa factura no dejó letras que pueda leer. "
            "Sube el Excel de la tienda o tómale foto a la lista. No inventé precios."
        )
    return await _pedir_lista([{"type": "text", "text": _ORDEN + "\n\n" + texto}])


async def _pedir_lista(contenido: list) -> str:
    import asyncio

    from app.config import env

    if not env("LLM_API_KEY"):
        return (
            "Guardé el archivo. El lector no está conectado, así que no inventé precios ni piezas. "
            "El Excel de la tienda entra sin lector."
        )
    from openai import OpenAI

    cliente = OpenAI(base_url=env("LLM_BASE_URL") or None, api_key=env("LLM_API_KEY"))
    modelo = env("LLM_MODEL") or "gpt-4o-mini"

    def _llamar():
        return cliente.chat.completions.create(
            model=modelo,
            temperature=0,
            messages=[{"role": "user", "content": contenido}],
        )

    try:
        resp = await asyncio.to_thread(_llamar)
        texto = (resp.choices[0].message.content or "").strip()
    except Exception:
        return "No pude leer el archivo. No inventé precios. Prueba con el Excel de la tienda."
    return _meter_vistos(texto)


def _meter_vistos(texto: str) -> str:
    inicio = texto.find("{")
    fin = texto.rfind("}")
    if inicio < 0 or fin < inicio:
        return "No vi artículos en el archivo. No inventé precios."
    try:
        data = json.loads(texto[inicio : fin + 1])
    except json.JSONDecodeError:
        return "No vi artículos en el archivo. No inventé precios."
    articulos = data.get("articulos") if isinstance(data, dict) else None
    if not isinstance(articulos, list):
        return "No vi artículos en el archivo. No inventé precios."
    metidos = saltados = 0
    for item in articulos:
        if not isinstance(item, dict):
            saltados += 1
            continue
        nombre = str(item.get("nombre") or "").strip()
        if not nombre:
            saltados += 1
            continue
        dato = {"nombre": nombre}
        for origen, destino in (("cantidad", "existencia"), ("costo", "costo"), ("precio", "precio")):
            valor = str(item.get(origen) or "").strip()
            if valor and valor not in ("0", "0.0", "0.00"):
                dato[destino] = valor
        if len(dato) == 1:
            saltados += 1
            continue
        _guardar_producto(dato)
        grupo = str(item.get("grupo") or "").strip()
        if grupo in _GRUPOS:
            with transaccion() as conn:
                conn.execute("UPDATE productos SET seccion=? WHERE sku=?", (grupo, _sku_de(nombre)))
        metidos += 1
    if not metidos:
        return "No había números en la lista. No inventé precios ni piezas."
    if metidos == 1:
        cabeza = "Entré 1 artículo de la lista."
    else:
        cabeza = f"Entré {metidos} artículos de la lista."
    extra = f" {saltados} renglones sin número no entraron." if saltados else ""
    return cabeza + extra + " Quedaron en su grupo. Lo que llegó primero es lo que sale primero."
