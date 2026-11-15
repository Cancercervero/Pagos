import json
import os
from datetime import datetime, timedelta

class BusinessFollowup:
    def __init__(self, data_path):
        self.deals_path = os.path.join(data_path, "Business", "deals.json")
        
    def _read_deals(self):
        if not os.path.exists(self.deals_path):
            return []
        try:
            with open(self.deals_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return []

    def get_stale_prospects(self, hours=24):
        deals = self._read_deals()
        stale = []
        now = datetime.now()
        
        for d in deals:
            if d.get("stage") == "prospecto":
                try:
                    updated_at = datetime.strptime(d["actualizado_en"], "%Y-%m-%d %H:%M:%S")
                    if now - updated_at > timedelta(hours=hours):
                        stale.append(d)
                except:
                    continue
        return stale

    def notify_commander(self, tg_bot, admin_ids):
        stale = self.get_stale_prospects()
        if not stale:
            print("[💰 FOLLOWUP] No hay tratos estancados hoy. Todo fluye.")
            return

        print(f"[💰 FOLLOWUP] Detectados {len(stale)} tratos estancados.")
        for d in stale:
            msg = (
                f"💰 *OPORTUNIDAD ESTANCADA*\n\n"
                f"El trato con *{d['client_name']}* ({d['asunto']}) por *${d['monto']}* "
                f"no ha tenido movimiento en más de 24 horas.\n\n"
                f"¿Quieres que Annie envíe un recordatorio amigable ahora?"
            )
            # En V1 solo notificamos, en V2 añadimos InlineButtons para [DALE] [IGNORAR]
            for admin_id in admin_ids:
                try:
                    tg_bot.send_message(admin_id, msg, parse_mode="Markdown")
                except Exception as e:
                    print(f"Error enviando notificación: {e}")

if __name__ == "__main__":
    # Test local
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    bf = BusinessFollowup(os.path.join(_root, "Cerberus_Data"))
    stale = bf.get_stale_prospects(hours=0) # Forzar detección de todo
    print(f"Test Detectados: {len(stale)}")
