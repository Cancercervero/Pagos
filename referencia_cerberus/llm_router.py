"""
LLM Router — Wrapper unificado de inferencia para Cerberus.
Caja de cambios — usa el modelo correcto para cada tarea:
  • ask_llm_lite()     → qwen2.5:1.5b  (intención, routing, JSON rápido)
  • ask_llm_creative() → qwen3:8b      (escritura, guiones, síntesis)
  • ask_llm()          → gemma4:5b     (razonamiento profundo, análisis complejo)
  • ask_llm_vision()   → qwen2.5vl:7b  (imagen + texto)

🐝 HIVE BRIDGE INTEGRADO:
  Todos los agentes tienen memoria persistente local (SQLite).
  Se inyecta contexto automáticamente en cada llamada y se guarda la interacción.
  Para activar memoria en una llamada, pasar agent_id y user_id.
"""
import logging

logger = logging.getLogger("LLMRouter")

# ── HiveBridge — carga lazy para no romper si la DB no está lista ──────────────
_hive = None

def _get_hive():
    """Singleton lazy del HiveBridge. Nunca falla — si hay error, retorna None."""
    global _hive
    if _hive is None:
        try:
            import sys
            from pathlib import Path
            _root = str(Path(__file__).parent.parent.parent)
            if _root not in sys.path:
                sys.path.insert(0, _root)
            from core_agents.agent_hive_bridge import HiveBridge
            _hive = HiveBridge()
            logger.info("[HiveBridge] Memoria local activada.")
        except Exception as e:
            logger.warning(f"[HiveBridge] No disponible (modo sin memoria): {e}")
            _hive = False   # False = intentamos y falló, no reintentar
    return _hive if _hive else None


def _enrich_system(system: str, agent_id: str, user_id: str) -> str:
    """Inyecta el contexto de memoria al system prompt del agente."""
    hive = _get_hive()
    if not hive or not agent_id:
        return system
    try:
        ctx = hive.get_context(agent_id, user_id or "default")
        return system + ctx
    except Exception as e:
        logger.warning(f"[HiveBridge] Error leyendo contexto: {e}")
        return system


def _save_to_hive(agent_id: str, user_id: str, prompt: str, response: str):
    """Guarda la interacción en la memoria del agente. Nunca bloquea."""
    hive = _get_hive()
    if not hive or not agent_id:
        return
    try:
        hive.save_interaction(agent_id, user_id or "default", prompt, response)
    except Exception as e:
        logger.warning(f"[HiveBridge] Error guardando interacción: {e}")


# ── API pública ────────────────────────────────────────────────────────────────

def ask_llm(
    prompt: str,
    system: str = "",
    max_tokens: int = 512,
    agent_id: str = "",
    user_id: str = "",
) -> str:
    """
    Punto de entrada principal. Usa el modelo completo (qwen3:8b).
    Con agent_id + user_id activa la memoria de la colmena para ese agente.

    Args:
        prompt:     Orden / pregunta del usuario o módulo interno.
        system:     Prompt de sistema / contexto de la misión.
        max_tokens: Límite orientativo (se pasa como num_predict a Ollama).
        agent_id:   ID del agente (ej: "donna", "oscar", "nancy"). Activa memoria.
        user_id:    ID del usuario/cliente que interactúa. Activa memoria.

    Returns:
        Texto de respuesta del LLM, o mensaje de error descriptivo.
    """
    enriched_system = _enrich_system(system, agent_id, user_id)
    try:
        from host_engine.brain_gate import gate
        response = gate.think(prompt, system_prompt=enriched_system, timeout=90)
        _save_to_hive(agent_id, user_id, prompt, response)
        return response
    except Exception as e:
        logger.error(f"[LLMRouter] ask_llm() falló: {e}", exc_info=True)
        return f"[LLMRouter] Error en inferencia: {e}"


def ask_llm_lite(
    prompt: str,
    system: str = "",
    max_tokens: int = 256,
    agent_id: str = "",
    user_id: str = "",
) -> str:
    """
    Modelo ligero (qwen2.5:1.5b). Ideal para clasificación de intención y JSON.
    Memoria desactivada por defecto en lite (velocidad > contexto).
    """
    # Para lite no inyectamos contexto completo — es para routing rápido,
    # pero sí guardamos si hay agent_id para no perder interacciones clave.
    try:
        from host_engine.brain_gate import gate
        response = gate.think_lite(prompt, system=system)
        if agent_id:
            _save_to_hive(agent_id, user_id, prompt, response)
        return response
    except Exception as e:
        logger.error(f"[LLMRouter] ask_llm_lite() falló: {e}", exc_info=True)
        return '{"respuesta": "Error en ruteo lite", "detonar": "general"}'


def ask_llm_creative(
    prompt: str,
    system: str = "",
    agent_id: str = "",
    user_id: str = "",
) -> str:
    """
    Modelo creativo (qwen3:8b). Ideal para guiones, escritura y síntesis narrativa.
    """
    enriched_system = _enrich_system(system, agent_id, user_id)
    try:
        from host_engine.brain_gate import gate
        response = gate.think_creative(prompt, system_prompt=enriched_system, timeout=120)
        _save_to_hive(agent_id, user_id, prompt, response)
        return response
    except Exception as e:
        logger.error(f"[LLMRouter] ask_llm_creative() falló: {e}", exc_info=True)
        return f"[LLMRouter] Error en inferencia creativa: {e}"


def ask_llm_vision(
    prompt: str,
    image_path: str,
    system: str = "",
    agent_id: str = "",
    user_id: str = "",
) -> str:
    """
    Modelo de visión (qwen2.5vl:7b). Procesa imagen + texto.
    """
    enriched_system = _enrich_system(system, agent_id, user_id)
    try:
        from host_engine.brain_gate import gate
        response = gate.think_with_image(prompt, image_path, system_prompt=enriched_system)
        _save_to_hive(agent_id, user_id, prompt, response)
        return response
    except Exception as e:
        logger.error(f"[LLMRouter] ask_llm_vision() falló: {e}", exc_info=True)
        return f"[LLMRouter] Error en inferencia visual: {e}"


# ── Utilidades de Colmena expuestas para uso directo ──────────────────────────

def hive_broadcast(from_agent: str, event_type: str, payload: dict, to_agent: str = None):
    """
    Envía un mensaje de un agente a la colmena.
    Ejemplo: José avisa a Nancy sobre un cliente problemático.
    """
    hive = _get_hive()
    if hive:
        try:
            hive.broadcast_to_hive(from_agent, event_type, payload, to_agent)
        except Exception as e:
            logger.warning(f"[HiveBridge] Error en broadcast: {e}")


def hive_save_fact(agent_id: str, entity: str, fact: str):
    """
    Guarda un hecho aprendido sobre una entidad.
    Ejemplo: hive_save_fact("nancy", "carlos", "prefiere no ser contactado antes de las 10am")
    """
    hive = _get_hive()
    if hive:
        try:
            hive.save_fact(agent_id, entity, fact)
        except Exception as e:
            logger.warning(f"[HiveBridge] Error guardando hecho: {e}")


def hive_get_facts(agent_id: str, entity: str) -> list[str]:
    """
    Recupera todos los hechos que el agente sabe sobre una entidad.
    Retorna lista vacía si la colmena no está disponible.
    Ejemplo: hive_get_facts("agente", "user_123") → ["perfil:{...}"]
    """
    hive = _get_hive()
    if hive:
        try:
            return hive.get_facts(agent_id, entity)
        except Exception as e:
            logger.warning(f"[HiveBridge] Error recuperando hechos: {e}")
    return []


def hive_stats() -> dict:
    """Estadísticas de la memoria de la colmena."""
    hive = _get_hive()
    if hive:
        try:
            return hive.get_stats()
        except Exception:
            pass
    return {"status": "hive_unavailable"}

