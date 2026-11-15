"""
salon_almacen/ingest.py — Ingesta de inventario inicial del cliente.

El desarrollador corre esto UNA VEZ al onboarding con los datos que el cliente entregó.
El cliente nunca toca esto.

Fuentes soportadas:
  --excel   archivo.xlsx / archivo.csv
  --sheets  ID_o_URL de Google Sheets
  --fotos   carpeta/ o imagen.jpg  (qwen2.5vl extrae la lista)
  --texto   "archivo.txt" con lista pegada de WhatsApp o cualquier texto libre

Uso:
  python -m host_engine.products.salon_almacen.ingest --excel inventario_donna.xlsx
  python -m host_engine.products.salon_almacen.ingest --sheets 1BxiM...id
  python -m host_engine.products.salon_almacen.ingest --fotos ./fotos_inventario/
  python -m host_engine.products.salon_almacen.ingest --texto lista_wasap.txt
  python -m host_engine.products.salon_almacen.ingest --sheets 1BxiM...id --db /ruta/custom.db
"""
import argparse
import csv
import json
import logging
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")))

from host_engine.cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("SalonIngest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

_IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

_PROMPT_VISION_LISTA = """Eres un extractor de inventario para salón de belleza.
Analiza esta imagen (puede ser una lista escrita a mano, una hoja de Excel impresa, o una foto de estantes).
Extrae TODOS los productos que veas con sus cantidades.
Responde SOLO con JSON válido:
{
  "productos": [
    {"nombre": "...", "cantidad": N, "unidad": "ml|g|pza|litro|caja|tubo|sobre", "marca": "..."},
    ...
  ]
}
Si no ves cantidades, pon cantidad: 0."""

_PROMPT_TEXT_PARSE = """Eres un extractor de inventario para salón de belleza.
Analiza este texto (puede ser una lista de WhatsApp, un texto libre, o notas).
Extrae TODOS los productos con cantidades y unidades.
Responde SOLO con JSON válido:
{
  "productos": [
    {"nombre": "...", "cantidad": N, "unidad": "ml|g|pza|litro|caja|tubo|sobre", "marca": ""},
    ...
  ]
}
Texto:
"""

# ── Columnas típicas que los clientes usan en Excel ─────────────────────────
_COL_NOMBRE   = ["nombre", "producto", "descripcion", "descripción", "articulo", "artículo", "item"]
_COL_SKU      = ["sku", "codigo", "código", "clave", "ref", "referencia"]
_COL_CANTIDAD = ["cantidad", "stock", "existencia", "qty", "unidades", "piezas"]
_COL_UNIDAD   = ["unidad", "um", "medida", "presentacion", "presentación"]
_COL_MIN      = ["minimo", "mínimo", "min", "stock_min", "punto_reorden"]
_COL_COSTO    = ["costo", "precio_costo", "costo_unitario", "precio_compra"]
_COL_VENTA    = ["precio", "precio_venta", "pvp", "precio_publico"]
_COL_CAT      = ["categoria", "categoría", "category", "tipo", "familia"]


def _match_col(headers: list[str], aliases: list[str]) -> int | None:
    for i, h in enumerate(headers):
        if h.strip().lower() in aliases:
            return i
    return None


def _proveedor_id(db: AlmacenDB) -> int:
    prov = db.get_proveedor("Proveedor Salón")
    if prov:
        return prov["id"]
    return db.registrar_proveedor("Proveedor Salón", contacto="")


def _insertar(db: AlmacenDB, prov_id: int, nombre: str, sku: str, unidad: str,
              categoria: str, min_stock: float, costo: float, precio_venta: float,
              cantidad_inicial: float) -> str:
    nombre = nombre.strip().title()
    sku = sku.strip().upper() if sku else re.sub(r'[^A-Z0-9]', '', nombre.upper())[:8]
    existente = db.get_producto(sku) or db.get_producto(nombre.lower())
    if existente:
        return f"  ↳ Ya existe: {nombre}"
    pid = db.registrar_producto(nombre, sku, unidad or "pza", categoria or "general",
                                 min_stock, costo, 0.0, precio_venta)
    if cantidad_inicial > 0:
        db.entrada_stock(pid, prov_id, cantidad_inicial, costo)
    return f"  ✅ {nombre} ({sku}) — stock inicial: {cantidad_inicial:.0f} {unidad}"


# ── Fuente: Excel / CSV ───────────────────────────────────────────────────────

def ingest_excel(path: str, db: AlmacenDB):
    path = Path(path)
    suffix = path.suffix.lower()
    rows = []

    if suffix == ".csv":
        with open(path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows = list(reader)
    elif suffix in (".xlsx", ".xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, data_only=True)
            ws = wb.active
            rows = [[str(c.value or "") for c in row] for row in ws.iter_rows()]
        except ImportError:
            logger.error("Instala openpyxl: pip install openpyxl")
            return
    else:
        logger.error(f"Formato no soportado: {suffix}")
        return

    if not rows:
        logger.warning("Archivo vacío.")
        return

    headers = [h.strip().lower() for h in rows[0]]
    ci = _match_col(headers, _COL_NOMBRE)
    if ci is None:
        logger.error("No encontré columna de nombre/producto en el Excel.")
        return

    ski   = _match_col(headers, _COL_SKU)
    qti   = _match_col(headers, _COL_CANTIDAD)
    uni   = _match_col(headers, _COL_UNIDAD)
    mini  = _match_col(headers, _COL_MIN)
    costi = _match_col(headers, _COL_COSTO)
    venti = _match_col(headers, _COL_VENTA)
    cati  = _match_col(headers, _COL_CAT)

    db.migrate()
    prov_id = _proveedor_id(db)
    logger.info(f"📄 Procesando {len(rows)-1} filas de {path.name}")

    for row in rows[1:]:
        nombre = row[ci].strip() if ci is not None and ci < len(row) else ""
        if not nombre:
            continue
        sku      = row[ski].strip()  if ski  is not None and ski  < len(row) else ""
        cantidad = float(row[qti].replace(",","") or 0) if qti is not None and qti < len(row) else 0.0
        unidad   = row[uni].strip()  if uni  is not None and uni  < len(row) else "pza"
        min_s    = float(row[mini].replace(",","") or 0) if mini is not None and mini < len(row) else 0.0
        costo    = float(row[costi].replace(",","").replace("$","") or 0) if costi is not None and costi < len(row) else 0.0
        venta    = float(row[venti].replace(",","").replace("$","") or 0) if venti is not None and venti < len(row) else 0.0
        cat      = row[cati].strip() if cati  is not None and cati  < len(row) else "general"

        try:
            msg = _insertar(db, prov_id, nombre, sku, unidad, cat, min_s, costo, venta, cantidad)
            logger.info(msg)
        except Exception as e:
            logger.warning(f"  ⚠️  {nombre}: {e}")

    logger.info("✅ Excel procesado.")


# ── Fuente: Google Sheets ─────────────────────────────────────────────────────

def ingest_sheets(sheet_id_or_url: str, db: AlmacenDB):
    sheet_id = sheet_id_or_url
    m = re.search(r'/spreadsheets/d/([a-zA-Z0-9_-]+)', sheet_id_or_url)
    if m:
        sheet_id = m.group(1)

    try:
        from host_engine.skills.google_services.sheets_skill import leer_hoja
    except ImportError:
        logger.error("Google Sheets no disponible — verifica google_auth.")
        return

    raw = leer_hoja(sheet_id, rango="A1:Z500")
    if raw.startswith("[❌"):
        logger.error(raw)
        return

    lines = raw.split("\n")[1:]  # quita header "📊 Datos..."
    rows = [ln.split(" | ") for ln in lines if ln.strip()]
    if not rows:
        logger.warning("Hoja vacía.")
        return

    # Reusar lógica de Excel con las filas parseadas
    db.migrate()
    prov_id = _proveedor_id(db)
    headers = [h.strip().lower() for h in rows[0]]
    ci    = _match_col(headers, _COL_NOMBRE)
    ski   = _match_col(headers, _COL_SKU)
    qti   = _match_col(headers, _COL_CANTIDAD)
    uni   = _match_col(headers, _COL_UNIDAD)
    mini  = _match_col(headers, _COL_MIN)
    costi = _match_col(headers, _COL_COSTO)
    venti = _match_col(headers, _COL_VENTA)
    cati  = _match_col(headers, _COL_CAT)

    if ci is None:
        logger.error("No encontré columna nombre en la hoja.")
        return

    logger.info(f"📊 Procesando {len(rows)-1} filas de Sheets")
    for row in rows[1:]:
        nombre = row[ci].strip() if ci < len(row) else ""
        if not nombre:
            continue
        def _v(i):
            return row[i].strip() if i is not None and i < len(row) else ""
        try:
            msg = _insertar(db, prov_id, nombre,
                            _v(ski), _v(uni), _v(cati),
                            float(_v(mini) or 0), float(_v(costi) or 0),
                            float(_v(venti) or 0), float(_v(qti) or 0))
            logger.info(msg)
        except Exception as e:
            logger.warning(f"  ⚠️  {nombre}: {e}")

    logger.info("✅ Google Sheets procesado.")


# ── Fuente: Fotos (Vision) ────────────────────────────────────────────────────

def ingest_fotos(path_str: str, db: AlmacenDB):
    from host_engine.cerberus_core.llm_router import ask_llm_vision

    path = Path(path_str)
    imagenes = []
    if path.is_dir():
        imagenes = [p for p in path.iterdir() if p.suffix.lower() in _IMG_EXTS]
    elif path.is_file() and path.suffix.lower() in _IMG_EXTS:
        imagenes = [path]

    if not imagenes:
        logger.error(f"No encontré imágenes en: {path_str}")
        return

    db.migrate()
    prov_id = _proveedor_id(db)

    for img in imagenes:
        logger.info(f"📸 Analizando: {img.name}")
        raw = ask_llm_vision(_PROMPT_VISION_LISTA, str(img))
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            logger.warning(f"  ⚠️  No pude extraer JSON de {img.name}")
            continue
        try:
            data = json.loads(m.group())
        except json.JSONDecodeError:
            logger.warning(f"  ⚠️  JSON inválido en {img.name}")
            continue

        for prod in data.get("productos", []):
            nombre = prod.get("nombre", "").strip()
            if not nombre:
                continue
            try:
                msg = _insertar(db, prov_id, nombre,
                                sku="",
                                unidad=prod.get("unidad", "pza"),
                                categoria="general",
                                min_stock=0.0, costo=0.0, precio_venta=0.0,
                                cantidad_inicial=float(prod.get("cantidad") or 0))
                logger.info(msg)
            except Exception as e:
                logger.warning(f"  ⚠️  {nombre}: {e}")

    logger.info("✅ Fotos procesadas.")


# ── Fuente: Texto libre (WhatsApp, notas) ────────────────────────────────────

def ingest_texto(path_str: str, db: AlmacenDB):
    from host_engine.cerberus_core.llm_router import ask_llm

    with open(path_str, encoding="utf-8") as f:
        contenido = f.read()

    logger.info(f"📝 Procesando texto ({len(contenido)} chars)")
    raw = ask_llm(_PROMPT_TEXT_PARSE + contenido, max_tokens=1024)
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        logger.error("No pude extraer JSON del texto.")
        return
    try:
        data = json.loads(m.group())
    except json.JSONDecodeError:
        logger.error("JSON inválido en respuesta LLM.")
        return

    db.migrate()
    prov_id = _proveedor_id(db)

    for prod in data.get("productos", []):
        nombre = prod.get("nombre", "").strip()
        if not nombre:
            continue
        try:
            msg = _insertar(db, prov_id, nombre,
                            sku="",
                            unidad=prod.get("unidad", "pza"),
                            categoria="general",
                            min_stock=0.0, costo=0.0, precio_venta=0.0,
                            cantidad_inicial=float(prod.get("cantidad") or 0))
            logger.info(msg)
        except Exception as e:
            logger.warning(f"  ⚠️  {nombre}: {e}")

    logger.info("✅ Texto procesado.")


# ── Columnas de historial ─────────────────────────────────────────────────────
_COL_FECHA    = ["fecha", "date", "dia", "día", "periodo", "mes"]
_COL_TIPO_TX  = ["tipo", "type", "movimiento", "operacion", "operación"]

_PROMPT_HISTORIAL_TEXTO = """Eres un extractor de historial de consumo para salón de belleza.
El cliente envió datos históricos de uso de productos (puede ser texto libre, resumen mensual, lista de WhatsApp).
Extrae CADA movimiento de producto con su fecha y cantidad.
Si hay resúmenes mensuales ("en enero usé 200ml de tinte"), crea un registro por mes.
Responde SOLO con JSON válido:
{
  "movimientos": [
    {"fecha": "YYYY-MM-DD", "producto": "nombre exacto", "cantidad": N, "unidad": "ml|g|pza|litro", "tipo": "SALIDA"},
    ...
  ]
}
Si no hay fecha exacta, usa el primer día del mes mencionado (ej: "enero 2024" → "2024-01-01").
Texto:
"""

_PROMPT_HISTORIAL_VISION = """Eres un extractor de historial de inventario para salón de belleza.
Analiza esta imagen (puede ser una hoja de registro, cuaderno, Excel impreso, o lista de consumos).
Extrae TODOS los movimientos con fecha, producto y cantidad.
Responde SOLO con JSON válido:
{
  "movimientos": [
    {"fecha": "YYYY-MM-DD", "producto": "nombre", "cantidad": N, "unidad": "ml|g|pza|litro", "tipo": "SALIDA"},
    ...
  ]
}
Si la fecha no está completa, usa el primer día del mes. Si no hay fecha, usa "2024-01-01"."""

_PROMPT_CLIENTES_TEXTO = """Eres un extractor de clientes de salón de belleza.
El cliente envió un listado de sus clientas con sus fórmulas o servicios.
Extrae CADA clienta con sus servicios y fórmulas conocidas.
Responde SOLO con JSON válido:
{
  "clientes": [
    {
      "nombre": "Nombre Apellido",
      "telefono": "5512345678 o vacío",
      "servicios": [
        {
          "nombre_servicio": "keratina|tinte|brushing|etc",
          "formula": [
            {"producto": "nombre producto", "cantidad": N, "unidad": "ml|g|pza"}
          ],
          "notas": "texto libre si hay"
        }
      ]
    }
  ]
}
Texto:
"""


def _resolver_producto_fuzzy(db: AlmacenDB, nombre: str) -> dict | None:
    """Busca producto por nombre exacto, luego parcial."""
    prod = db.get_producto(nombre.lower())
    if prod:
        return prod
    # Búsqueda parcial: algún producto cuyo nombre contenga las palabras clave
    palabras = [p for p in nombre.lower().split() if len(p) > 3]
    if not palabras:
        return None
    conn = db._conn()
    for p in palabras:
        row = conn.execute(
            "SELECT * FROM parts WHERE LOWER(name) LIKE ?", (f"%{p}%",)
        ).fetchone()
        if row:
            conn.close()
            return dict(row)
    conn.close()
    return None


def _parsear_fecha(texto: str) -> str:
    """Convierte fechas sueltas a ISO. Fallback: 2024-01-01."""
    import re
    texto = texto.strip()
    # Ya está en YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}', texto):
        return texto[:10]
    # DD/MM/YYYY o DD-MM-YYYY
    m = re.match(r'^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$', texto)
    if m:
        d, mo, y = m.groups()
        y = f"20{y}" if len(y) == 2 else y
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    # MM/YYYY o mes-año
    m = re.match(r'^(\d{1,2})[/\-](\d{4})$', texto)
    if m:
        mo, y = m.groups()
        return f"{y}-{int(mo):02d}-01"
    return "2024-01-01"


def _insertar_tx_historica(db: AlmacenDB, nombre_producto: str, cantidad: float,
                            fecha_iso: str, notas: str = "historico") -> str:
    prod = _resolver_producto_fuzzy(db, nombre_producto)
    if not prod:
        return f"  ⚠️  Producto no encontrado: {nombre_producto}"
    ok = db.registrar_consumo_historico(prod["id"], cantidad, fecha_iso, notas)
    if not ok:
        return f"  ⚠️  Sin stock_item para: {prod['name']} (agrega inventario inicial primero)"
    return f"  ✅ {fecha_iso} | -{cantidad} {prod.get('unit','pza')} {prod['name']}"


# ── Historial: Excel / CSV ────────────────────────────────────────────────────

def ingest_historial_excel(path: str, db: AlmacenDB) -> int:
    """
    Lee Excel con columnas fecha / producto / cantidad [tipo].
    Retorna número de registros insertados.
    """
    path = Path(path)
    rows = []

    if path.suffix.lower() == ".csv":
        with open(path, encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
    elif path.suffix.lower() in (".xlsx", ".xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, data_only=True)
            ws = wb.active
            rows = [[str(c.value or "") for c in row] for row in ws.iter_rows()]
        except ImportError:
            logger.error("Instala openpyxl: pip install openpyxl")
            return 0
    else:
        logger.error(f"Formato no soportado: {path.suffix}")
        return 0

    if not rows:
        return 0

    headers = [h.strip().lower() for h in rows[0]]
    fi  = _match_col(headers, _COL_FECHA)
    ni  = _match_col(headers, _COL_NOMBRE)
    qi  = _match_col(headers, _COL_CANTIDAD)
    ti  = _match_col(headers, _COL_TIPO_TX)

    if fi is None or ni is None or qi is None:
        logger.error("El Excel de historial necesita columnas: fecha, producto/nombre, cantidad")
        return 0

    db.migrate()
    count = 0
    for row in rows[1:]:
        if len(row) < max(fi, ni, qi) + 1:
            continue
        fecha   = _parsear_fecha(row[fi])
        nombre  = row[ni].strip()
        raw_qty = row[qi].strip().replace(",", "")
        if not nombre or not raw_qty:
            continue
        try:
            cantidad = float(raw_qty)
        except ValueError:
            continue
        tipo = (row[ti].strip().upper() if ti is not None and ti < len(row) else "SALIDA") or "SALIDA"
        msg = _insertar_tx_historica(db, nombre, cantidad, fecha, f"historico:{tipo.lower()}")
        logger.info(msg)
        if msg.startswith("  ✅"):
            count += 1

    logger.info(f"✅ Historial Excel: {count} registros insertados.")
    return count


# ── Historial: Texto libre ────────────────────────────────────────────────────

def ingest_historial_texto(fuente: str, db: AlmacenDB) -> int:
    """
    fuente: ruta a archivo .txt o cadena de texto directamente.
    Retorna número de registros insertados.
    """
    from host_engine.cerberus_core.llm_router import ask_llm

    if os.path.isfile(fuente):
        with open(fuente, encoding="utf-8") as f:
            contenido = f.read()
    else:
        contenido = fuente

    logger.info(f"📝 Parseando historial texto ({len(contenido)} chars)")
    raw = ask_llm(_PROMPT_HISTORIAL_TEXTO + contenido, max_tokens=2048)
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        logger.error("No pude extraer JSON del texto histórico.")
        return 0
    try:
        data = json.loads(m.group())
    except json.JSONDecodeError:
        logger.error("JSON inválido en respuesta LLM.")
        return 0

    db.migrate()
    count = 0
    for mv in data.get("movimientos", []):
        nombre  = mv.get("producto", "").strip()
        fecha   = _parsear_fecha(mv.get("fecha", ""))
        raw_qty = mv.get("cantidad", 0)
        if not nombre:
            continue
        try:
            cantidad = float(raw_qty)
        except (ValueError, TypeError):
            continue
        tipo = (mv.get("tipo") or "SALIDA").upper()
        msg = _insertar_tx_historica(db, nombre, cantidad, fecha, f"historico:{tipo.lower()}")
        logger.info(msg)
        if msg.startswith("  ✅"):
            count += 1

    logger.info(f"✅ Historial texto: {count} registros insertados.")
    return count


# ── Historial: Fotos ──────────────────────────────────────────────────────────

def ingest_historial_foto(path_str: str, db: AlmacenDB) -> int:
    """Lee fotos de registros históricos (cuadernos, hojas, Excel impreso)."""
    from host_engine.cerberus_core.llm_router import ask_llm_vision

    path = Path(path_str)
    imagenes = []
    if path.is_dir():
        imagenes = [p for p in path.iterdir() if p.suffix.lower() in _IMG_EXTS]
    elif path.is_file() and path.suffix.lower() in _IMG_EXTS:
        imagenes = [path]

    if not imagenes:
        logger.error(f"No encontré imágenes en: {path_str}")
        return 0

    db.migrate()
    total = 0
    for img in imagenes:
        logger.info(f"📸 Leyendo historial: {img.name}")
        raw = ask_llm_vision(_PROMPT_HISTORIAL_VISION, str(img))
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            logger.warning(f"  ⚠️  No pude extraer JSON de {img.name}")
            continue
        try:
            data = json.loads(m.group())
        except json.JSONDecodeError:
            logger.warning(f"  ⚠️  JSON inválido en {img.name}")
            continue

        for mv in data.get("movimientos", []):
            nombre = mv.get("producto", "").strip()
            fecha  = _parsear_fecha(mv.get("fecha", ""))
            try:
                cantidad = float(mv.get("cantidad") or 0)
            except (ValueError, TypeError):
                continue
            if not nombre or cantidad <= 0:
                continue
            tipo = (mv.get("tipo") or "SALIDA").upper()
            msg = _insertar_tx_historica(db, nombre, cantidad, fecha, f"historico:{tipo.lower()}")
            logger.info(msg)
            if msg.startswith("  ✅"):
                total += 1

    logger.info(f"✅ Historial fotos: {total} registros insertados.")
    return total


# ── Historial: dispatcher ─────────────────────────────────────────────────────

def ingest_historial(source: str, db: AlmacenDB) -> int:
    """
    Auto-detecta fuente y despacha al parser correcto.
    source: ruta a archivo (xlsx/csv/txt/jpg/png/carpeta) o texto libre.
    Retorna total de registros insertados.
    """
    p = Path(source)
    if p.exists():
        ext = p.suffix.lower()
        if ext in (".xlsx", ".xls", ".csv"):
            return ingest_historial_excel(source, db)
        if ext in _IMG_EXTS or (p.is_dir() and any(f.suffix.lower() in _IMG_EXTS for f in p.iterdir())):
            return ingest_historial_foto(source, db)
        # .txt o cualquier archivo de texto
        return ingest_historial_texto(source, db)
    # Texto libre (mensajes de WhatsApp pegados directamente)
    return ingest_historial_texto(source, db)


# ── Clientes: importar historial de clientas ──────────────────────────────────

def ingest_clientes(source: str, db: AlmacenDB) -> int:
    """
    Importa clientas con sus fórmulas desde texto libre o archivo.
    Ejemplo: lista de WhatsApp "la señora García: keratina con 200ml X + 100ml Y"
    Retorna número de clientas importadas.
    """
    from host_engine.cerberus_core.llm_router import ask_llm

    if os.path.isfile(source):
        with open(source, encoding="utf-8") as f:
            contenido = f.read()
    else:
        contenido = source

    logger.info(f"👩 Parseando clientes ({len(contenido)} chars)")
    raw = ask_llm(_PROMPT_CLIENTES_TEXTO + contenido, max_tokens=2048)
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        logger.error("No pude extraer JSON de clientes.")
        return 0
    try:
        data = json.loads(m.group())
    except json.JSONDecodeError:
        logger.error("JSON inválido en respuesta LLM.")
        return 0

    db.migrate()
    count = 0
    for c in data.get("clientes", []):
        nombre = c.get("nombre", "").strip()
        if not nombre:
            continue
        telefono = c.get("telefono", "")
        existente = db.buscar_cliente_fuzzy(nombre)
        if existente:
            cid = existente["id"]
        else:
            cid = db.registrar_cliente(nombre, telefono, "importado")
        logger.info(f"  👩 {nombre} (id={cid})")
        for srv in c.get("servicios", []):
            srv_nombre = srv.get("nombre_servicio", "").strip()
            if not srv_nombre:
                continue
            formula_raw = srv.get("formula", [])
            formula = []
            for ing in formula_raw:
                prod = _resolver_producto_fuzzy(db, ing.get("producto", ""))
                if prod:
                    formula.append({
                        "part_id":  prod["id"],
                        "nombre":   prod["name"],
                        "cantidad": float(ing.get("cantidad") or 0),
                        "unidad":   ing.get("unidad") or prod.get("unit", "ml"),
                    })
            if formula:
                db.guardar_formula_cliente(cid, srv_nombre, formula, srv.get("notas", ""))
                logger.info(f"    ✅ {srv_nombre} — {len(formula)} ingredientes")
        count += 1

    logger.info(f"✅ Clientes: {count} clientas importadas.")
    return count


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingesta inventario salón desde múltiples fuentes")
    parser.add_argument("--excel",     help="Ruta a .xlsx o .csv del cliente")
    parser.add_argument("--sheets",    help="ID o URL de Google Sheets")
    parser.add_argument("--fotos",     help="Carpeta o archivo de imagen")
    parser.add_argument("--texto",     help="Archivo .txt con lista de WhatsApp o notas")
    parser.add_argument("--historial", help="Fuente de historial (xlsx/csv/txt/foto/carpeta o texto)")
    parser.add_argument("--clientes",  help="Fuente de clientas (archivo txt o texto libre)")
    parser.add_argument("--db",        help="Ruta custom a la DB SQLite", default=None)
    args = parser.parse_args()

    if not any([args.excel, args.sheets, args.fotos, args.texto, args.historial, args.clientes]):
        parser.print_help()
        sys.exit(1)

    db = AlmacenDB(db_path=args.db) if args.db else AlmacenDB()

    if args.excel:
        ingest_excel(args.excel, db)
    if args.sheets:
        ingest_sheets(args.sheets, db)
    if args.fotos:
        ingest_fotos(args.fotos, db)
    if args.texto:
        ingest_texto(args.texto, db)
    if args.historial:
        n = ingest_historial(args.historial, db)
        logger.info(f"🕐 Historial: {n} registros cargados → Isabel puede predecir desde hoy")
    if args.clientes:
        n = ingest_clientes(args.clientes, db)
        logger.info(f"👩 Clientes: {n} clientas importadas")
