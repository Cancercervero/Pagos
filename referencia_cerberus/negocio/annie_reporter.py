"""
ANNIE REPORTER — Sistema de Trazabilidad y Reportes Automáticos (V1.0)
======================================================================
Registra cada interacción que pasa por Annie (C1) y genera reportes
cada hora que se envían automáticamente al Comandante via Telegram.

Carpeta de reportes: Cerberus_Data/Reports/Annie/YYYY/MM/DD/HH_MM.json

Integración en grpc_server.py:
    from skills.annie_reporter import reporter as annie_reporter
    annie_reporter.start_scheduler(tg_token, admin_id)
    annie_reporter.log_interaction(source, prompt, response, handled, accion)
"""
import os
import json
import threading
import time
import urllib.request
from datetime import datetime


class AnnieReporter:
    """
    Logger de interacciones + Generador de Reportes Horarios.
    Thread-safe. Usa un buffer en memoria que se vacía con cada reporte.
    """

    def __init__(self, base_path=None):
        if base_path is None:
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Cerberus_Data"))
            base_path = root
        self.reports_dir = os.path.join(base_path, "Reports", "Annie")
        self._lock = threading.Lock()
        self._buffer = []          # Interacciones del período actual
        self._tg_token  = ""
        self._admin_ids = set()    # Donna sources — a quiénes enviar el reporte
        self._scheduler_thread = None

    # ── LOGGING ─────────────────────────────────────────────────────────────

    def log_interaction(self, source_id: str, prompt: str, response: str,
                        handled: bool, accion: str = ""):
        """
        Registra una interacción de Annie.
        handled=True  → Annie respondió sola.
        handled=False → Annie escaló a C3 o no tuvo respuesta.
        """
        entry = {
            "ts":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source":   source_id,
            "prompt":   prompt[:300],
            "response": response[:300] if response else "",
            "handled":  handled,
            "accion":   accion,
        }
        with self._lock:
            self._buffer.append(entry)

    # ── SCHEDULER ───────────────────────────────────────────────────────────

    def start_scheduler(self, tg_token: str, admin_ids, interval_seconds: int = 3600):
        """
        Arranca el hilo de reportes automáticos.
        admin_ids: str o iterable de str (Donna sources / admin chat IDs).
        Llamar UNA SOLA VEZ al arrancar grpc_server.
        """
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            return

        self._tg_token  = tg_token or ""
        if isinstance(admin_ids, str):
            self._admin_ids = {admin_ids} if admin_ids else set()
        else:
            self._admin_ids = set(admin_ids)

        def _loop():
            # Esperar hasta el próximo múltiplo exacto de hora para alinearse
            now = datetime.now()
            secs_to_next = interval_seconds - (now.minute * 60 + now.second) % interval_seconds
            time.sleep(secs_to_next)
            while True:
                try:
                    self._run_report()
                except Exception as e:
                    print(f"[ANNIE REPORTER] Error en reporte horario: {e}")
                time.sleep(interval_seconds)

        self._scheduler_thread = threading.Thread(target=_loop, daemon=True, name="AnnieReporter")
        self._scheduler_thread.start()
        print("[+] AnnieReporter scheduler iniciado.")

    # ── GENERACIÓN DE REPORTE ────────────────────────────────────────────────

    def _run_report(self):
        """Genera el reporte del período, lo guarda en disco y lo envía."""
        with self._lock:
            interactions = list(self._buffer)
            self._buffer.clear()

        if not interactions:
            return  # Sin actividad — no enviar reporte vacío

        now = datetime.now()
        report = self._build_report(interactions, now)
        self._save_report(report, now)
        self._send_report(report)

    def _build_report(self, interactions: list, now: datetime) -> dict:
        """Construye el dict del reporte a partir de las interacciones del período."""
        total     = len(interactions)
        handled   = sum(1 for i in interactions if i["handled"])
        escalated = total - handled
        unresolved = [i for i in interactions if not i["handled"]]

        # Agrupación por source
        by_source = {}
        for i in interactions:
            src = i["source"]
            by_source[src] = by_source.get(src, 0) + 1

        # Top 5 más activos
        top_sources = sorted(by_source.items(), key=lambda x: -x[1])[:5]

        # Acciones escaladas más comunes
        accion_counts = {}
        for i in unresolved:
            ac = i.get("accion", "?")
            accion_counts[ac] = accion_counts.get(ac, 0) + 1

        return {
            "period_end":      now.strftime("%Y-%m-%d %H:%M:%S"),
            "total_messages":  total,
            "handled_by_annie": handled,
            "escalated_to_c3":  escalated,
            "top_sources":      top_sources,
            "accion_breakdown": accion_counts,
            "unresolved_sample": [
                {"source": i["source"], "prompt": i["prompt"][:120]}
                for i in unresolved[:10]
            ],
            "all_interactions": interactions,
        }

    def _save_report(self, report: dict, now: datetime):
        """Guarda el reporte como JSON en la carpeta estructurada por fecha."""
        folder = os.path.join(
            self.reports_dir,
            now.strftime("%Y"),
            now.strftime("%m"),
            now.strftime("%d"),
        )
        os.makedirs(folder, exist_ok=True)
        filename = now.strftime("%H_%M") + "_reporte.json"
        path = os.path.join(folder, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"[ANNIE REPORTER] Reporte guardado: {path}")

    def _send_report(self, report: dict):
        """Envía el resumen en texto plano al Comandante via Telegram."""
        if not self._tg_token or not self._admin_ids:
            return

        total     = report["total_messages"]
        handled   = report["handled_by_annie"]
        escalated = report["escalated_to_c3"]
        period    = report["period_end"]

        top_lines = "\n".join(
            f"  • {src}: {cnt} msg" for src, cnt in report["top_sources"]
        ) or "  (sin actividad)"

        unsolved_lines = ""
        if report["unresolved_sample"]:
            unsolved_lines = "\n*Solicitudes sin respuesta directa:*\n" + "\n".join(
                f"  [{i['source']}] {i['prompt'][:80]}" for i in report["unresolved_sample"]
            )

        msg = (
            f"📊 *Reporte Horario Annie — {period}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📨 Mensajes recibidos: *{total}*\n"
            f"✅ Atendidos por Annie: *{handled}*\n"
            f"⬆️ Escalados a C3: *{escalated}*\n\n"
            f"*Clientes más activos:*\n{top_lines}"
            f"{unsolved_lines}"
        )

        for admin_id in self._admin_ids:
            self._tg_send(admin_id, msg)

    def _tg_send(self, chat_id: str, text: str):
        """Envía texto vía Telegram Bot API."""
        try:
            payload = json.dumps({
                "chat_id": chat_id,
                "text": text[:4000],
                "parse_mode": "Markdown"
            }).encode("utf-8")
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{self._tg_token}/sendMessage",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print(f"[ANNIE REPORTER] Error enviando a Telegram ({chat_id}): {e}")

    # ── API DE CONSULTA ──────────────────────────────────────────────────────

    def get_buffer_snapshot(self) -> list:
        """Devuelve copia del buffer actual sin vaciarlo (útil para diagnóstico)."""
        with self._lock:
            return list(self._buffer)

    def force_report_now(self):
        """Fuerza la generación de un reporte ahora mismo (para testing)."""
        self._run_report()


# Singleton
reporter = AnnieReporter()
