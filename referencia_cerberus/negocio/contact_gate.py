"""
🚪 CONTACT GATE — La Puerta de Identidad de Cerberus
=====================================================
Una sola regla de negocio: quien eres DETERMINA quién te atiende.

ARQUITECTURA:
  📱 Número externo (cliente/proveedor) → ANNIE  (modo explosivo)
  📱 Número del Comandante              → DONNA  (modo ejecutivo)
  📱 Número de chalán/equipo            → DONNA  (modo equipo)

NUNCA un externo habla con Donna.
NUNCA el Comandante habla con Annie.
La cadena no se rompe.

CONFIGURACIÓN:
  Edita el archivo Cerberus_Data/contact_gate.json
  o usa el endpoint POST /gate/contact para agregar números.
"""

import os
import json
import logging
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, asdict

logger = logging.getLogger("ContactGate")

# ── Paths ─────────────────────────────────────────────────────────────────────

_GATE_CONFIG = Path(__file__).parent.parent.parent / "Cerberus_Data" / "contact_gate.json"
_GATE_CONFIG.parent.mkdir(parents=True, exist_ok=True)


# ── Tipos de contacto ─────────────────────────────────────────────────────────

class ContactType(str, Enum):
    COMMANDER  = "commander"   # El jefe — habla con Donna en modo ejecutivo
    CHALAN     = "chalan"      # Equipo de confianza — habla con Donna en modo equipo
    CLIENT     = "client"      # Cliente — habla con Annie (modo explosivo)
    PROVIDER   = "provider"    # Proveedor — habla con Annie (modo proveedor)
    UNKNOWN    = "unknown"     # Número no registrado — va a Annie por default


@dataclass
class ContactProfile:
    phone: str                    # número normalizado sin + ni espacios, ej: "5219991234567"
    contact_type: ContactType
    name: str = "Desconocido"
    alias: str = ""               # apodo interno, ej: "Chalán Norte", "Chef Ramírez"
    notes: str = ""               # notas internas (solo para el Imperio, no para el contacto)
    active: bool = True


# ── Gate Config Schema (JSON en disco) ───────────────────────────────────────

_DEFAULT_GATE_CONFIG = {
    "_readme": (
        "Contact Gate — Cerberus. "
        "contact_type: commander | chalan | client | provider. "
        "phone: número sin + ni espacios (ej: 5219991234567)."
    ),
    "contacts": [
        # El Comandante — configura tu número aquí
        {
            "phone": os.getenv("COMMANDER_PHONE", ""),
            "contact_type": "commander",
            "name": "Comandante",
            "alias": "El Jefe",
            "notes": "Acceso ejecutivo total. Habla directo con Donna.",
            "active": True,
        }
    ]
}


# ── ContactGate ───────────────────────────────────────────────────────────────

class ContactGate:
    """
    Guardián de identidad. Clasifica cualquier número entrante
    y devuelve el agente que debe atenderlo.
    """

    def __init__(self):
        self._config: dict = {}
        self._contacts: dict[str, ContactProfile] = {}  # phone → profile
        self._load()

    def _load(self):
        """Carga la configuración del gate desde disco."""
        if not _GATE_CONFIG.exists():
            _GATE_CONFIG.write_text(json.dumps(_DEFAULT_GATE_CONFIG, indent=2, ensure_ascii=False), encoding="utf-8")
            logger.info("[ContactGate] Config creada en: %s", _GATE_CONFIG)

        try:
            self._config = json.loads(_GATE_CONFIG.read_text(encoding="utf-8"))
            self._contacts = {}
            for c in self._config.get("contacts", []):
                if c.get("phone") and c.get("active", True):
                    phone = self._normalize(c["phone"])
                    self._contacts[phone] = ContactProfile(
                        phone=phone,
                        contact_type=ContactType(c.get("contact_type", "unknown")),
                        name=c.get("name", ""),
                        alias=c.get("alias", ""),
                        notes=c.get("notes", ""),
                        active=c.get("active", True),
                    )
            logger.info("[ContactGate] %d contactos cargados.", len(self._contacts))
        except Exception as e:
            logger.error("[ContactGate] Error cargando config: %s", e)
            self._contacts = {}

    def reload(self):
        """Recarga la config desde disco sin reiniciar."""
        self._load()

    def _normalize(self, phone: str) -> str:
        """Normaliza un número: quita +, espacios, guiones."""
        if not phone:
            return ""
        return str(phone).replace("+", "").replace(" ", "").replace("-", "").strip()

    def identify(self, raw_phone: str) -> ContactProfile:
        """
        Identifica un número y retorna su perfil.
        Si no está registrado → ContactType.UNKNOWN (va a Annie).
        """
        phone = self._normalize(raw_phone)
        if not phone:
            return ContactProfile(phone="", contact_type=ContactType.UNKNOWN, name="Sin número")

        profile = self._contacts.get(phone)
        if profile:
            return profile

        # Número desconocido → cliente potencial
        return ContactProfile(
            phone=phone,
            contact_type=ContactType.UNKNOWN,
            name="Desconocido",
            alias="",
            notes="Número no registrado — tratado como cliente externo.",
        )

    def route(self, raw_phone: str) -> dict:
        """
        Punto de entrada principal.
        Retorna: { "agent": "annie"|"donna", "mode": str, "profile": ContactProfile }
        """
        profile = self.identify(raw_phone)
        ct = profile.contact_type

        if ct == ContactType.COMMANDER:
            return {
                "agent": "donna",
                "mode": "executive",
                "user_id": f"commander_{profile.phone}",
                "profile": profile,
                "system_tag": "[COMMANDER MODE — ACCESO EJECUTIVO TOTAL]",
            }

        elif ct == ContactType.CHALAN:
            return {
                "agent": "donna",
                "mode": "team",
                "user_id": f"chalan_{profile.phone}",
                "profile": profile,
                "system_tag": f"[TEAM MODE — {profile.alias or profile.name}]",
            }

        elif ct in (ContactType.CLIENT, ContactType.UNKNOWN):
            return {
                "agent": "annie",
                "mode": "explosive",       # modo explosivo: Annie en modo ventas/servicio
                "user_id": f"client_{profile.phone}",
                "profile": profile,
                "system_tag": f"[CLIENT MODE — {profile.name}]",
            }

        elif ct == ContactType.PROVIDER:
            return {
                "agent": "annie",
                "mode": "provider",        # modo proveedor: más formal pero sigue Annie
                "user_id": f"provider_{profile.phone}",
                "profile": profile,
                "system_tag": f"[PROVIDER MODE — {profile.name}]",
            }

        # Fallback seguro
        return {
            "agent": "annie",
            "mode": "explosive",
            "user_id": f"unknown_{profile.phone}",
            "profile": profile,
            "system_tag": "[UNKNOWN — DEFAULT TO ANNIE]",
        }

    def add_contact(self, phone: str, contact_type: str, name: str,
                    alias: str = "", notes: str = "") -> bool:
        """Agrega o actualiza un contacto en la config."""
        try:
            phone_norm = self._normalize(phone)
            if not phone_norm:
                return False

            # Actualizar en memoria
            self._contacts[phone_norm] = ContactProfile(
                phone=phone_norm,
                contact_type=ContactType(contact_type),
                name=name, alias=alias, notes=notes, active=True,
            )

            # Persistir en disco
            cfg = json.loads(_GATE_CONFIG.read_text(encoding="utf-8"))
            contacts = cfg.get("contacts", [])

            # Actualizar si ya existe, agregar si no
            found = False
            for i, c in enumerate(contacts):
                if self._normalize(c.get("phone", "")) == phone_norm:
                    contacts[i] = asdict(self._contacts[phone_norm])
                    contacts[i]["contact_type"] = contact_type  # guardar como string
                    found = True
                    break
            if not found:
                contacts.append({
                    "phone": phone_norm, "contact_type": contact_type,
                    "name": name, "alias": alias, "notes": notes, "active": True,
                })

            cfg["contacts"] = contacts
            _GATE_CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
            logger.info("[ContactGate] Contacto guardado: %s (%s) → %s", name, phone_norm, contact_type)
            return True
        except Exception as e:
            logger.error("[ContactGate] Error guardando contacto: %s", e)
            return False

    def remove_contact(self, phone: str) -> bool:
        """Desactiva un contacto (soft delete)."""
        try:
            phone_norm = self._normalize(phone)
            if phone_norm in self._contacts:
                del self._contacts[phone_norm]

            cfg = json.loads(_GATE_CONFIG.read_text(encoding="utf-8"))
            for c in cfg.get("contacts", []):
                if self._normalize(c.get("phone", "")) == phone_norm:
                    c["active"] = False
            _GATE_CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            logger.error("[ContactGate] Error removiendo contacto: %s", e)
            return False

    def list_contacts(self) -> list[dict]:
        """Lista todos los contactos activos para el HQ."""
        result = []
        for phone, profile in self._contacts.items():
            result.append({
                "phone":        profile.phone,
                "name":         profile.name,
                "alias":        profile.alias,
                "contact_type": profile.contact_type.value,
                "agent":        "donna" if profile.contact_type in (ContactType.COMMANDER, ContactType.CHALAN) else "annie",
                "notes":        profile.notes,
            })
        return sorted(result, key=lambda x: x["contact_type"])

    def get_stats(self) -> dict:
        """Stats del gate para el HQ dashboard."""
        from collections import Counter
        counts = Counter(p.contact_type.value for p in self._contacts.values())
        return {
            "total": len(self._contacts),
            "commander": counts.get("commander", 0),
            "chalanes": counts.get("chalan", 0),
            "clients": counts.get("client", 0),
            "providers": counts.get("provider", 0),
            "config_path": str(_GATE_CONFIG),
        }


# ── Singleton ─────────────────────────────────────────────────────────────────

GATE = ContactGate()
