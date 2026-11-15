"""
cron.py — Trabajos programados del salón.

Corre en hilo separado junto al bot.
  - Reporte matutino → admin + dueña cada día a la hora configurada
  - Cheque de stock → cada 6h, alerta WhatsApp si hay productos bajo mínimo
  - Reporte semanal Isabel → lunes a las 8am
"""
import json
import logging
import os
import threading
import time
from datetime import datetime

logger = logging.getLogger("SalonCron")

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def _load_config() -> dict:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def _hora_actual() -> str:
    return datetime.now().strftime("%H:%M")


def _es_lunes() -> bool:
    return datetime.now().weekday() == 0


def _admin_ids(config: dict) -> list[str]:
    return [uid for uid, rol in config.get("roles", {}).items() if rol in ("admin", "duena")]


# ── Tareas ────────────────────────────────────────────────────────────────────

def _send(bot, chat_id: str, msg: str):
    """Envío seguro desde hilo síncrono usando el loop de asyncio del bot."""
    import asyncio
    try:
        future = asyncio.run_coroutine_threadsafe(
            bot.send_message(chat_id=chat_id, text=msg, parse_mode="Markdown"),
            bot.get_updates.__self__._application.updater._event_loop
            if hasattr(bot, 'get_updates') else asyncio.get_event_loop()
        )
        future.result(timeout=15)
    except Exception as e:
        logger.warning(f"[Cron] send falló a {chat_id}: {e}")


def _tarea_reporte_matutino(bot, config: dict):
    from host_engine.products.salon_almacen.agents.donna import reporte_matutino
    try:
        msg = reporte_matutino(config)
        for uid in _admin_ids(config):
            _send(bot, uid, msg)
            logger.info(f"[Cron] Reporte matutino → {uid}")
    except Exception as e:
        logger.error(f"[Cron] Reporte matutino falló: {e}")


def _tarea_reporte_semanal(bot, config: dict):
    from host_engine.products.salon_almacen.agents.donna import reporte_semanal_completo
    try:
        msg = reporte_semanal_completo(config)
        for uid in _admin_ids(config):
            _send(bot, uid, msg)
            logger.info(f"[Cron] Reporte semanal → {uid}")
    except Exception as e:
        logger.error(f"[Cron] Reporte semanal falló: {e}")


def _tarea_cheque_stock(bot, config: dict):
    from host_engine.products.salon_almacen.agents.enzo import alertas_stock_bajo
    from host_engine.products.salon_almacen.agents.aldo import generar_orden, ordenes_pendientes
    try:
        alertas = alertas_stock_bajo()
        if not alertas or ordenes_pendientes():
            return

        salon = config.get("salon_nombre", "Salón")
        result = generar_orden(salon_nombre=salon)
        if not result["ok"]:
            return

        orden = result["orden"]
        orden_id = orden["id"]
        items_txt = "\n".join([
            f"  • {i['nombre']}: {i['cantidad']:.0f} {i['unidad']}"
            for i in orden["items"][:6]
        ])
        msg = (
            f"🔔 *Aldo — Stock bajo*\n\n{items_txt}\n\n"
            f"¿Apruebo pedido a *{orden['proveedor']}*?\n"
            f"  ✅ /aprobar_{orden_id}\n"
            f"  ❌ /rechazar_{orden_id}"
        )
        for uid in _admin_ids(config):
            _send(bot, uid, msg)

        numero_admin = config.get("admin_whatsapp", "")
        if numero_admin:
            try:
                from host_engine.products.salon_almacen.whatsapp_sender import alertar_admin
                alertar_admin(numero_admin, salon, alertas)
            except Exception as e:
                logger.warning(f"[Cron] WhatsApp admin falló: {e}")

        logger.info(f"[Cron] Orden {orden_id} generada y notificada")
    except Exception as e:
        logger.error(f"[Cron] Cheque stock falló: {e}")


# ── Loop principal ────────────────────────────────────────────────────────────

def _loop(bot):
    logger.info("[Cron] Iniciado")
    ultimo_reporte_dia = None
    ultimo_reporte_semana = None
    ultimo_cheque_stock = None

    while True:
        try:
            config = _load_config()
            ahora = datetime.now()
            hora_hoy = ahora.strftime("%H:%M")
            dia_hoy = ahora.strftime("%Y-%m-%d")
            hora_config = config.get("alertas_hora", "09:00")

            # Reporte matutino — una vez al día
            if hora_hoy == hora_config and dia_hoy != ultimo_reporte_dia:
                _tarea_reporte_matutino(bot, config)
                ultimo_reporte_dia = dia_hoy

                # Reporte semanal Isabel — lunes
                semana_actual = ahora.strftime("%Y-W%W")
                if _es_lunes() and semana_actual != ultimo_reporte_semana:
                    _tarea_reporte_semanal(bot, config)
                    ultimo_reporte_semana = semana_actual

            # Cheque de stock — cada 6 horas
            hora_int = ahora.hour
            slot_6h = f"{dia_hoy}-{hora_int // 6}"
            if slot_6h != ultimo_cheque_stock:
                _tarea_cheque_stock(bot, config)
                ultimo_cheque_stock = slot_6h

        except Exception as e:
            logger.error(f"[Cron] Error en loop: {e}")

        time.sleep(60)  # checar cada minuto


def iniciar(bot):
    """Arranca el cron en hilo daemon."""
    t = threading.Thread(target=_loop, args=(bot,), daemon=True, name="SalonCron")
    t.start()
    return t
