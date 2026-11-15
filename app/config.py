"""Lee .env y data/negocio.json cada vez que se pide, para que los tests puedan aislarse."""

import json
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def ruta_base() -> Path:
    cruda = os.getenv("DATABASE_PATH", "data/app.db")
    ruta = Path(cruda)
    if not ruta.is_absolute():
        ruta = ROOT / ruta
    return ruta


def archivos_dir() -> Path:
    destino = ROOT / "data" / "archivos"
    destino.mkdir(parents=True, exist_ok=True)
    return destino


def negocio() -> dict:
    with open(ROOT / "data" / "negocio.json", encoding="utf-8") as f:
        return json.load(f)


def catalogo() -> dict:
    with open(ROOT / "data" / "catalogo.json", encoding="utf-8") as f:
        return json.load(f)


def catalogo_bienes() -> dict:
    with open(ROOT / "data" / "catalogo_bienes.json", encoding="utf-8") as f:
        return json.load(f)


def organizaciones() -> dict:
    with open(ROOT / "data" / "organizaciones.json", encoding="utf-8") as f:
        return json.load(f)


def owner_phones() -> set[str]:
    return {p.strip() for p in os.getenv("OWNER_PHONES", "").split(",") if p.strip()}


def env(nombre: str, default: str = "") -> str:
    return os.getenv(nombre, default) or default


def panel_key() -> str:
    return env("PANEL_KEY")


def publico() -> str:
    return env("PUBLIC_BASE_URL").rstrip("/")


def tareas_activas() -> bool:
    return env("APP_DISABLE_TASKS") != "1"


def webhook_inseguro() -> bool:
    return env("PEY_WEBHOOK_INSECURE") == "1"
