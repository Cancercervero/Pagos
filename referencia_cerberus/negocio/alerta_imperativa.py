"""
alerta_imperativa.py — Listener de alertas urgentes del sistema.
Escucha el bus_sistema y envía notificaciones inmediatas por Telegram.
Se inicia junto con el servidor gRPC.
"""
from __future__ import annotations
import json
import logging
import threading
import urllib.request

logger = logging.getLogger("AlertaImperativa")


def evaluar_stock_bajo(items: list[dict]) -> list[str]:
    """
    Recibe lista de items del almacén y devuelve mensajes de alerta
    para aquellos cuyo stock_actual < min_stock.
    """
    alertas = []
    for item in items:
        try:
            stock = float(item.get("stock_actual") or 0)
            minimo = float(item.get("min_stock") or 0)
        except (TypeError, ValueError):
            continue
        if minimo > 0 and stock < minimo:
            alertas.append(
                f"\u26a0\ufe0f *STOCK BAJO* \u2014 {item.get('name', 'N/A')} "
                f"({item.get('sku', '-')}): "
                f"{stock:.1f} {item.get('unit', 'u')} "
                f"(m\u00ednimo: {minimo:.1f})"
            )
    return alertas


class AlertaImperativa:
    """
    Monitorea el bus del sistema y envía alertas inmediatas
    cuando se detectan condiciones críticas.
    """

    def __init__(self, config: dict, tg_token: str | None, admin_ids: list[str]):
        self.config = config
        self.tg_token = tg_token
        self.admin_ids = admin_ids
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._init_db()

    def _init_db(self):
        """Runs DB migration once at startup."""
        try:
            from cerberus_core.almacen_db import AlmacenDB
            AlmacenDB().migrate()
        except Exception as e:
            logger.warning("[AlertaImperativa] DB migrate en init falló: %s", e)

    def start(self):
        """Inicia el listener en background thread."""
        self._thread = threading.Thread(
            target=self._monitorear, daemon=True, name="AlertaImperativa"
        )
        self._thread.start()
        logger.info("[+] AlertaImperativa activa.")

    def _monitorear(self):
        """Loop de monitoreo: revisa alertas de almacén cada 15 minutos."""
        # BaseException (KeyboardInterrupt, SystemExit) will kill this daemon
        # thread silently on process shutdown — intentional for daemon threads.
        while not self._stop.is_set():
            self._revisar_stock()
            self._stop.wait(900)  # wakes immediately if stop() is called

    def _revisar_stock(self):
        try:
            from cerberus_core.almacen_db import AlmacenDB
            db = AlmacenDB()
            items = db.get_alertas_stock_bajo()
            alertas = evaluar_stock_bajo(items)
            for msg in alertas:
                logger.warning("[ALERTA] %s", msg)
                self._enviar(msg)
        except Exception as e:
            logger.error("[AlertaImperativa] Error revisando stock: %s", e)

    def _enviar(self, mensaje: str):
        """Envía mensaje a todos los admin_ids por Telegram."""
        if not self.tg_token or not self.admin_ids:
            return
        for chat_id in self.admin_ids:
            try:
                api_url = f"https://api.telegram.org/bot{self.tg_token}/sendMessage"
                payload = json.dumps({
                    "chat_id": chat_id,
                    "text": mensaje,
                    "parse_mode": "Markdown",
                }).encode("utf-8")
                req = urllib.request.Request(
                    api_url, data=payload,
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req, timeout=10)
            except Exception as e:
                logger.error("[AlertaImperativa] Error enviando a %s: %s", chat_id, e)

    def stop(self):
        self._stop.set()
