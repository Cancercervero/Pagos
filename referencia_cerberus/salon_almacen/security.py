"""
security.py — Guardia de seguridad del almacén.

Tres capas:
  1. Whitelist — solo usuarios registrados pueden interactuar
  2. Scope guard — solo temas de inventario/almacén pasan al LLM
  3. Injection sanitizer — detecta y bloquea intentos de manipular al agente
"""
import re
import logging

logger = logging.getLogger("SalonSecurity")

# ── 1. Whitelist ──────────────────────────────────────────────────────────────

def usuario_autorizado(user_id: str, config: dict) -> bool:
    return str(user_id) in config.get("roles", {})


def requiere_autorizacion(user_id: str, config: dict) -> str | None:
    """Retorna mensaje de rechazo si no autorizado, None si ok."""
    if not usuario_autorizado(user_id, config):
        logger.warning(f"[Security] Acceso denegado: user_id={user_id}")
        return None  # Silencio total — no confirmar que el bot existe


# ── 2. Scope guard ────────────────────────────────────────────────────────────

_FUERA_DE_SCOPE = [
    r"ignor[ae]\s+(las?\s+)?instrucciones",
    r"ol[vb]ida\s+(lo\s+que|todo)",
    r"act[úu]a\s+como",
    r"eres?\s+(ahora|un[a]?\s+)",
    r"nuevo\s+rol",
    r"jailbreak",
    r"prompt\s+injection",
    r"sistema\s+anterior",
    r"instrucciones\s+(anteriores|previas)",
    r"hazme\s+.{0,30}(fuera|otro|diferente)",
    r"dime\s+(el\s+)?(token|clave|password|contrase)",
    r"qu[eé]\s+sabes\s+de\s+(?!productos|stock|inventario|proveedor)",
    r"busca\s+en\s+internet\s+(?!proveedor|producto|distribuid)",
    r"manda\s+(un\s+)?correo\s+a\s+(?!proveedor)",
    r"investiga\s+(?!proveedor|producto)",
]

_TEMAS_VALIDOS = [
    "tinte", "oxidante", "keratina", "stock", "inventario", "producto",
    "proveedor", "pedido", "entrada", "salida", "merma", "tubo", "caja",
    "shampoo", "mascarilla", "ampolleta", "orden", "compra", "alerta",
    "existencia", "cuanto", "cuánto", "falta", "bajo", "reporte", "margen",
    "precio", "costo", "semana", "mes", "flujo", "ranking", "usé", "use",
    "llegaron", "recibimos", "vendimos", "gastamos", "aplicamos",
]

_COMPILED_INJECTION = [re.compile(p, re.IGNORECASE) for p in _FUERA_DE_SCOPE]


def sanitizar(texto: str) -> tuple[bool, str]:
    """
    Retorna (es_seguro, razon).
    Si es_seguro=False, el mensaje debe bloquearse.
    """
    if not texto or not texto.strip():
        return True, ""

    texto_lower = texto.lower()

    # Detectar patrones de inyección
    for patron in _COMPILED_INJECTION:
        if patron.search(texto_lower):
            logger.warning(f"[Security] Posible inyección: '{texto[:60]}'")
            return False, "injection"

    return True, ""


def es_tema_inventario(texto: str) -> bool:
    """
    Verifica si el texto está relacionado con inventario/almacén.
    Mensajes claramente fuera de scope se bloquean antes de llegar al LLM.
    """
    texto_lower = texto.lower()

    # Corto o saludo → dejar pasar (help, hola, sí, no, etc.)
    if len(texto.strip()) < 20:
        return True

    return any(kw in texto_lower for kw in _TEMAS_VALIDOS)


def respuesta_fuera_scope() -> str:
    return (
        "Solo soy el almacenista del salón. 📦\n"
        "Puedo ayudarte con stock, productos, pedidos y reportes.\n"
        "Para otra cosa, habla con tu admin."
    )


def respuesta_no_autorizado() -> str | None:
    return None  # Silencio — no revelar que el bot existe


# ── 3. Setup token — primer acceso ───────────────────────────────────────────

def verificar_setup_token(texto: str, config: dict) -> bool:
    """
    El primer admin debe presentar el setup_token para activar el onboarding.
    El token lo pone el desarrollador en config.json antes de entregar al cliente.
    """
    token_correcto = config.get("setup_token", "")
    if not token_correcto:
        return False  # Sin token configurado = onboarding deshabilitado para desconocidos
    return texto.strip() == token_correcto
