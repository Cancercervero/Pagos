"""
start.py — Punto de entrada único del salón.

Uso:
  python -m host_engine.products.salon_almacen.start

Hace:
  1. Carga .env (tokens, claves)
  2. Valida config.json tiene telegram_token
  3. Corre migrate() para asegurar DB actualizada
  4. Arranca bot + cron en un solo proceso
"""
import logging
import os
import sys

# ── Cargar .env ───────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _env_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env")
    )
    load_dotenv(_env_path)
except ImportError:
    pass  # Sin python-dotenv, confiar en variables de entorno del sistema

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("SalonStart")

# ── Validar config ────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
))


def _validar():
    from host_engine.products.salon_almacen.salon_manager import get_active_config
    try:
        config_path, config = get_active_config()
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    token = config.get("telegram_token", "").strip()
    if not token or token.startswith("TU_"):
        logger.error(f"telegram_token vacío en {config_path}. Obtén uno en @BotFather.")
        sys.exit(1)

    if not os.getenv("WHATSAPP_TOKEN"):
        logger.warning("WHATSAPP_TOKEN no configurado — órdenes de Aldo no se enviarán por WhatsApp.")

    # Propagar SALON_CONFIG para que bot.py lo use
    os.environ["SALON_CONFIG"] = config_path
    return config


def _migrate(config: dict):
    try:
        from host_engine.cerberus_core.almacen_db import AlmacenDB
        db_path = config.get("db_path") or None
        db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
        db.migrate()
        logger.info("DB migrada correctamente.")
    except Exception as e:
        logger.error(f"Error en migrate: {e}")
        sys.exit(1)


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    config = _validar()
    _migrate(config)

    salon = config.get("salon_nombre", "sin configurar")
    logger.info(f"{'='*50}")
    logger.info(f"  DONNA — Almacén Inteligente")
    logger.info(f"  Salón: {salon}")
    logger.info(f"{'='*50}")

    from host_engine.products.salon_almacen.bot import run
    run()
