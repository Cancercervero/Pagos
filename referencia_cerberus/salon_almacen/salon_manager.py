"""
salon_manager.py — Gestor multi-tenant de salones.

Cada salón tiene su propio directorio con config, DB y archivos aislados.
Un proceso por salón. El manager los crea, lista y lanza.

Estructura por salón:
  /salones/{salon_id}/
    config.json         ← token Telegram, nombre, roles, moneda
    salon.db            ← SQLite exclusivo
    ordenes_pendientes.json
    evidencias/
    facturas/

Uso:
  # Crear nuevo salón
  python -m host_engine.products.salon_almacen.salon_manager crear --id bella_epoca --token BOT_TOKEN

  # Listar salones
  python -m host_engine.products.salon_almacen.salon_manager listar

  # Arrancar todos
  python -m host_engine.products.salon_almacen.salon_manager iniciar --todos

  # Arrancar uno
  python -m host_engine.products.salon_almacen.salon_manager iniciar --id bella_epoca
"""
import argparse
import json
import logging
import os
import subprocess
import sys

logger = logging.getLogger("SalonManager")

_SALONES_DIR = os.path.join(os.path.dirname(__file__), "salones")

_CONFIG_TEMPLATE = {
    "salon_nombre":   "Mi Salón",
    "telegram_token": "",
    "moneda":         "$",
    "roles":          {},
    "horario_reporte": "08:00",
    "db_path":        "",        # se llena al crear
    "salon_id":       "",        # se llena al crear
}


# ── Paths por salón ───────────────────────────────────────────────────────────

def salon_dir(salon_id: str) -> str:
    return os.path.join(_SALONES_DIR, salon_id)


def get_paths(salon_id: str) -> dict:
    base = salon_dir(salon_id)
    return {
        "base":      base,
        "config":    os.path.join(base, "config.json"),
        "db":        os.path.join(base, "salon.db"),
        "ordenes":   os.path.join(base, "ordenes_pendientes.json"),
        "evidencias": os.path.join(base, "evidencias"),
        "facturas":  os.path.join(base, "facturas"),
        "onboarding_state": os.path.join(base, "onboarding_state.json"),
    }


# ── Crear salón ───────────────────────────────────────────────────────────────

def crear_salon(salon_id: str, token: str = "", nombre: str = "",
                moneda: str = "$") -> dict:
    """
    Crea estructura de directorios y config base para un nuevo salón.
    Retorna el config creado.
    """
    paths = get_paths(salon_id)
    os.makedirs(paths["base"], exist_ok=True)
    os.makedirs(paths["evidencias"], exist_ok=True)
    os.makedirs(paths["facturas"], exist_ok=True)

    config = dict(_CONFIG_TEMPLATE)
    config["salon_id"]      = salon_id
    config["salon_nombre"]  = nombre or salon_id.replace("_", " ").title()
    config["telegram_token"] = token
    config["moneda"]        = moneda
    config["db_path"]       = paths["db"]

    with open(paths["config"], "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    # Migrar DB para este salón
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    AlmacenDB(db_path=paths["db"]).migrate()

    logger.info(f"[Manager] Salón '{salon_id}' creado en {paths['base']}")
    return config


# ── Listar salones ────────────────────────────────────────────────────────────

def listar_salones() -> list[dict]:
    if not os.path.exists(_SALONES_DIR):
        return []
    salones = []
    for name in os.listdir(_SALONES_DIR):
        cfg_path = os.path.join(_SALONES_DIR, name, "config.json")
        if os.path.exists(cfg_path):
            with open(cfg_path, encoding="utf-8") as f:
                cfg = json.load(f)
            salones.append({
                "id":     name,
                "nombre": cfg.get("salon_nombre", name),
                "token":  "✅" if cfg.get("telegram_token") else "❌",
                "db":     os.path.exists(cfg.get("db_path", "")),
            })
    return salones


# ── Arrancar salón(es) ────────────────────────────────────────────────────────

def arrancar_salon(salon_id: str) -> subprocess.Popen:
    """
    Lanza un proceso separado para el salón.
    Pasa SALON_ID como variable de entorno para que start.py lo use.
    """
    paths = get_paths(salon_id)
    if not os.path.exists(paths["config"]):
        raise FileNotFoundError(f"Salón '{salon_id}' no existe.")

    env = os.environ.copy()
    env["SALON_ID"] = salon_id
    env["SALON_CONFIG"] = paths["config"]

    proc = subprocess.Popen(
        [sys.executable, "-m", "host_engine.products.salon_almacen.start"],
        env=env,
    )
    logger.info(f"[Manager] Salón '{salon_id}' arrancado (PID {proc.pid})")
    return proc


def arrancar_todos() -> list[subprocess.Popen]:
    salones = listar_salones()
    procs = []
    for s in salones:
        if s["token"] == "✅":
            try:
                procs.append(arrancar_salon(s["id"]))
            except Exception as e:
                logger.error(f"Error arrancando {s['id']}: {e}")
    return procs


# ── start.py integration ──────────────────────────────────────────────────────

def get_active_config() -> tuple[str, dict]:
    """
    Retorna (config_path, config_dict) para el proceso actual.
    Si SALON_CONFIG está en env → ese salón específico.
    Si no → config.json legacy (compatibilidad hacia atrás).
    """
    env_config = os.environ.get("SALON_CONFIG")
    if env_config and os.path.exists(env_config):
        with open(env_config, encoding="utf-8") as f:
            return env_config, json.load(f)

    # Legacy: config.json en el directorio del módulo
    legacy = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(legacy):
        with open(legacy, encoding="utf-8") as f:
            return legacy, json.load(f)

    raise FileNotFoundError("No se encontró config.json ni SALON_CONFIG en el entorno.")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    parser = argparse.ArgumentParser(description="Gestor multi-tenant de salones Donna")
    sub = parser.add_subparsers(dest="cmd")

    # crear
    p_crear = sub.add_parser("crear", help="Crear nuevo salón")
    p_crear.add_argument("--id",     required=True, help="ID único del salón (slug)")
    p_crear.add_argument("--token",  default="",    help="Token de Telegram del bot")
    p_crear.add_argument("--nombre", default="",    help="Nombre del salón")
    p_crear.add_argument("--moneda", default="$",   help="Símbolo de moneda")

    # listar
    sub.add_parser("listar", help="Listar salones registrados")

    # iniciar
    p_init = sub.add_parser("iniciar", help="Arrancar salón(es)")
    p_init.add_argument("--id",    default="", help="ID del salón a arrancar")
    p_init.add_argument("--todos", action="store_true", help="Arrancar todos")

    args = parser.parse_args()

    if args.cmd == "crear":
        cfg = crear_salon(args.id, args.token, args.nombre, args.moneda)
        print(f"✅ Salón creado: {cfg['salon_nombre']} ({args.id})")
        print(f"   Config: {get_paths(args.id)['config']}")
        if not args.token:
            print("⚠️  Recuerda agregar el telegram_token en config.json")

    elif args.cmd == "listar":
        salones = listar_salones()
        if not salones:
            print("Sin salones registrados.")
        for s in salones:
            estado = "🟢" if s["token"] == "✅" else "🔴"
            print(f"  {estado} {s['id']} — {s['nombre']} (token: {s['token']})")

    elif args.cmd == "iniciar":
        if args.todos:
            procs = arrancar_todos()
            print(f"✅ {len(procs)} salones arrancados.")
            for p in procs:
                p.wait()
        elif args.id:
            proc = arrancar_salon(args.id)
            proc.wait()
        else:
            parser.print_help()
