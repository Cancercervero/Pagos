"""
Enzo — Almacenista del Salón.

Meticuloso. No pierde ni un tubo. Lleva el conteo exacto de todo.
Registra cada entrada, salida y merma. Genera el estado actual del almacén.
No opina sobre precios ni proveedores — eso no es su trabajo.
"""
import logging
from host_engine.cerberus_core.almacen_db import AlmacenDB

logger = logging.getLogger("Enzo")

_PERSONALIDAD = (
    "Soy Enzo, almacenista. Llevo el conteo exacto de todo lo que entra y sale. "
    "No pierdo ni un tubo, ni un sobre, ni un guante. "
    "Mis reportes son precisos y sin adornos."
)


def _db(db_path=None) -> AlmacenDB:
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()
    return db


def registrar_uso(part_id: int, cantidad: float, nota: str = "",
                  db_path=None, photo_ref: str = None) -> dict:
    """Estilista usó un producto. Enzo lo descuenta."""
    db = _db(db_path)
    stock_antes = db.get_stock_actual(part_id)
    if cantidad > stock_antes:
        logger.warning(f"[Enzo] Stock insuficiente part_id={part_id}: tiene {stock_antes}, pide {cantidad}")
        return {"ok": False, "motivo": "stock_insuficiente", "stock_actual": stock_antes}
    tx_id = db.salida_stock(part_id, cantidad, precio_venta=0, notas=nota or "Uso en servicio")
    if photo_ref and tx_id:
        db.update_tx_photo(tx_id, photo_ref)
    stock_nuevo = db.get_stock_actual(part_id)
    logger.info(f"[Enzo] Uso registrado: part_id={part_id} -{cantidad} → stock={stock_nuevo}")
    return {"ok": True, "tx_id": tx_id, "stock_nuevo": stock_nuevo, "bajo_minimo": _esta_bajo_minimo(db, part_id, stock_nuevo)}


def registrar_entrada(part_id: int, proveedor_id: int, cantidad: float,
                      precio_compra: float, lote: str = None, db_path=None) -> dict:
    """Llegó mercancía. Enzo la suma."""
    db = _db(db_path)
    tx_id = db.entrada_stock(part_id, proveedor_id, cantidad, precio_compra, lote=lote)
    stock_nuevo = db.get_stock_actual(part_id)
    logger.info(f"[Enzo] Entrada registrada: part_id={part_id} +{cantidad} → stock={stock_nuevo}")
    return {"ok": True, "tx_id": tx_id, "stock_nuevo": stock_nuevo}


def registrar_merma(stock_item_id: int, cantidad: float, motivo: str = "", db_path=None) -> dict:
    """Producto se dañó, venció o se perdió. Enzo lo anota."""
    db = _db(db_path)
    tx_id = db.registrar_merma(stock_item_id, cantidad, motivo or "Sin especificar")
    logger.info(f"[Enzo] Merma: item={stock_item_id} -{cantidad} motivo={motivo}")
    return {"ok": True, "tx_id": tx_id}


def estado_almacen(db_path=None) -> list[dict]:
    """Snapshot completo del stock actual."""
    db = _db(db_path)
    productos = db.listar_productos()
    resultado = []
    for p in productos:
        stock = db.get_stock_actual(p["id"])
        resultado.append({
            "id": p["id"],
            "nombre": p["name"],
            "sku": p["sku"],
            "unidad": p["unit"],
            "stock": stock,
            "min_stock": p.get("min_stock", 0),
            "bajo_minimo": stock < p.get("min_stock", 0),
        })
    return resultado


def alertas_stock_bajo(db_path=None) -> list[dict]:
    """Lista de productos bajo mínimo. Enzo los detecta."""
    db = _db(db_path)
    return db.get_alertas_stock_bajo()


def reporte_enzo(db_path=None) -> str:
    """Resumen en texto listo para Donna."""
    estado = estado_almacen(db_path)
    if not estado:
        return "📦 Enzo: almacén vacío, no hay nada registrado."
    bajos = [p for p in estado if p["bajo_minimo"]]
    ok    = [p for p in estado if not p["bajo_minimo"]]
    lines = [f"📦 *Enzo — Estado del almacén ({len(estado)} productos):*\n"]
    if bajos:
        lines.append("⚠️ *Bajo mínimo:*")
        for p in bajos:
            lines.append(f"  • {p['nombre']}: {p['stock']:.1f} {p['unidad']} (mín {p['min_stock']:.0f})")
    lines.append(f"\n✅ En niveles normales: {len(ok)} productos")
    return "\n".join(lines)


def _esta_bajo_minimo(db: AlmacenDB, part_id: int, stock_actual: float) -> bool:
    prod = db.get_producto(str(part_id))
    if not prod:
        return False
    return stock_actual < prod.get("min_stock", 0)
