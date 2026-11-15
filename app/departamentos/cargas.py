"""Carga de listas. El archivo trae los precios; este módulo no los inventa."""

import csv
import io
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
    "costo": "costo",
    "existencia": "existencia",
    "stock": "existencia",
    "piezas": "existencia",
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
        if dato.get("sku") and dato.get("nombre") and dato.get("precio"):
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
        "Menú, inventario y precios quedaron listos. "
        "La contabilidad se hace sola cuando el banco confirma un pago."
    )


def leer_cfdi(data: bytes) -> str:
    """Saca de un CFDI de compra el sku, la cantidad y el precio. Si no vienen, no inventa."""
    try:
        raiz = ET.fromstring(data)
    except ET.ParseError:
        return "Ese XML no se pudo leer. No inventé precios."
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
        notas.append(cargar_entrada(sku, nombre, piezas, float(valor), "CFDI"))
    if not notas:
        return "La factura no trae piezas. No inventé lotes."
    return " ".join(notas)


def texto_sin_lista() -> str:
    return (
        "Quedó el archivo. Un audio o un PDF no trae columnas, así que no invento precios ni piezas. "
        "Si es la lista, súbela en Excel o CSV con sku, nombre, precio, costo y existencia. "
        "La contabilidad se hace sola cuando el banco confirma un pago."
    )


def _norm(texto: str) -> str:
    return "".join(ch for ch in texto.lower().strip() if ch.isalnum() or ch == "_")


def _pesos(texto: str) -> int:
    limpio = texto.replace("$", "").replace(",", "").strip()
    return pesos_a_centavos(limpio)


def _guardar_producto(dato: dict) -> None:
    sku = dato["sku"].strip().lower()
    nombre = dato["nombre"].strip()
    precio = _pesos(dato["precio"])
    costo = _pesos(dato["costo"]) if dato.get("costo") else 0
    existencia = int(float(dato["existencia"])) if dato.get("existencia") else None
    minimo = int(float(dato["minimo"])) if dato.get("minimo") else 2
    with transaccion() as conn:
        row = conn.execute("SELECT * FROM productos WHERE sku=?", (sku,)).fetchone()
        if row:
            conn.execute(
                "UPDATE productos SET nombre=?, precio_centavos=?, costo_centavos=? WHERE id=?",
                (nombre, precio, costo, row["id"]),
            )
            if existencia is not None:
                conn.execute("UPDATE productos SET existencia=? WHERE id=?", (existencia, row["id"]))
        else:
            conn.execute(
                """INSERT INTO productos
                   (sku, nombre, precio_centavos, costo_centavos, existencia, minimo)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (sku, nombre, precio, costo, existencia or 0, minimo),
            )
        producto = conn.execute("SELECT id FROM productos WHERE sku=?", (sku,)).fetchone()
        if existencia is not None:
            conn.execute(
                """INSERT INTO movimientos_almacen
                   (producto_id, tipo, cantidad, costo_centavos, nota, creado_en)
                   VALUES (?, 'ajuste', ?, ?, ?, ?)""",
                (producto["id"], existencia, costo, "lista cargada", ahora_iso()),
            )


def _guardar_proveedor(nombre: str) -> None:
    with transaccion() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO proveedores (nombre, nota, creado_en) VALUES (?, '', ?)",
            (nombre.strip(), ahora_iso()),
        )
