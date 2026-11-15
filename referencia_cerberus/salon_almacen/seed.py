"""
salon_almacen/seed.py — Precarga catálogo típico de salón en la DB.

Uso:
  python -m host_engine.products.salon_almacen.seed
  python -m host_engine.products.salon_almacen.seed --db /ruta/custom.db
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")))

from host_engine.cerberus_core.almacen_db import AlmacenDB

PROVEEDOR_DEFAULT = "Proveedor Salón"

CATALOGO = [
    # (nombre, sku, unidad, categoría, min_stock, costo_bruto, costo_proceso, precio_venta)
    # ── Tintes ──────────────────────────────────────────────────────────────
    ("Tinte Permanente",     "TIN-PERM",  "tubo",  "tintes",      10, 35.0, 0.0, 0.0),
    ("Tinte Semipermanente", "TIN-SEMI",  "tubo",  "tintes",       8, 28.0, 0.0, 0.0),
    ("Decolorante Polvo",    "DEC-POL",   "sobre", "decoloración", 5, 22.0, 0.0, 0.0),
    ("Tóner",                "TON-001",   "tubo",  "tintes",       5, 30.0, 0.0, 0.0),
    # ── Oxidantes ───────────────────────────────────────────────────────────
    ("Oxidante 10 Vol",      "OXI-10",    "litro", "oxidantes",    3, 45.0, 0.0, 0.0),
    ("Oxidante 20 Vol",      "OXI-20",    "litro", "oxidantes",    4, 45.0, 0.0, 0.0),
    ("Oxidante 30 Vol",      "OXI-30",    "litro", "oxidantes",    3, 45.0, 0.0, 0.0),
    ("Oxidante 40 Vol",      "OXI-40",    "litro", "oxidantes",    2, 45.0, 0.0, 0.0),
    # ── Tratamientos ────────────────────────────────────────────────────────
    ("Keratina Alisante",    "KER-001",   "ml",    "tratamientos", 500, 0.8, 0.0, 0.0),
    ("Ampolleta Hidratante", "AMP-HID",   "pza",   "tratamientos", 10, 18.0, 0.0, 0.0),
    ("Ampolleta Proteínas",  "AMP-PRO",   "pza",   "tratamientos", 10, 18.0, 0.0, 0.0),
    ("Mascarilla Nutritiva", "MAS-NUT",   "g",     "tratamientos", 300, 0.3, 0.0, 0.0),
    ("Botox Capilar",        "BOT-CAP",   "g",     "tratamientos", 200, 0.6, 0.0, 0.0),
    # ── Shampoo y acondicionador ─────────────────────────────────────────────
    ("Shampoo Profesional",  "SHA-PRO",   "litro", "lavado",       2, 80.0, 0.0, 0.0),
    ("Acondicionador Prof",  "ACO-PRO",   "litro", "lavado",       2, 75.0, 0.0, 0.0),
    ("Shampoo Matizador",    "SHA-MAT",   "litro", "lavado",       1, 90.0, 0.0, 0.0),
    # ── Consumibles ─────────────────────────────────────────────────────────
    ("Papel Aluminio",       "ALU-001",   "rollo", "consumibles",  2, 45.0, 0.0, 0.0),
    ("Guantes Latex M",      "GUA-M",     "caja",  "consumibles",  3, 55.0, 0.0, 0.0),
    ("Guantes Latex L",      "GUA-L",     "caja",  "consumibles",  2, 55.0, 0.0, 0.0),
    ("Gorro Plástico",       "GOR-PLA",   "pza",   "consumibles", 20,  2.5, 0.0, 0.0),
    ("Toalla Desechable",    "TOA-DES",   "pza",   "consumibles", 30,  3.0, 0.0, 0.0),
    ("Pincel de Tinte",      "PIN-TIN",   "pza",   "herramientas",  5, 25.0, 0.0, 0.0),
    ("Batidor / Bowl",       "BAT-001",   "pza",   "herramientas",  3, 30.0, 0.0, 0.0),
]


def seed(db_path: str = None):
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    # Proveedor genérico
    prov = db.get_proveedor(PROVEEDOR_DEFAULT)
    if not prov:
        prov_id = db.registrar_proveedor(PROVEEDOR_DEFAULT, contacto="")
        print(f"✅ Proveedor creado: {PROVEEDOR_DEFAULT} (id={prov_id})")
    else:
        prov_id = prov["id"]
        print(f"ℹ️  Proveedor ya existe: {PROVEEDOR_DEFAULT}")

    for item in CATALOGO:
        nombre, sku, unit, cat, min_s, costo_b, costo_p, precio_v = item
        existente = db.get_producto(sku)
        if existente:
            print(f"  ↳ Ya existe: {nombre}")
            continue
        pid = db.registrar_producto(nombre, sku, unit, cat, min_s, costo_b, costo_p, precio_v)
        db.entrada_stock(pid, prov_id, cantidad=0, precio_compra=costo_b)
        print(f"  ✅ {nombre} ({sku})")

    print("\n🎉 Catálogo de salón cargado en DB.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed catálogo salon")
    parser.add_argument("--db", help="Ruta custom a la DB SQLite", default=None)
    args = parser.parse_args()
    seed(db_path=args.db)
