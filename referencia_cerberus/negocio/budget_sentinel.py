import os
import sqlite3
import json
from datetime import datetime

class BudgetSentinel:
    """
    Portero de Gobernanza (Budget Sentinel).
    Vigila el uso de tokens y llamadas por agente/compañía.
    Aplica Hard-Stops si se exceden los límites.
    """
    def __init__(self, data_path):
        self.db_path = os.path.join(data_path, "Metrics", "budget_governance.db")
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS agent_budgets (
                    agent_id TEXT PRIMARY KEY,
                    daily_token_limit INTEGER,
                    daily_call_limit INTEGER,
                    current_tokens INTEGER DEFAULT 0,
                    current_calls INTEGER DEFAULT 0,
                    last_reset TEXT
                )
            """)
            conn.commit()

    def verificar_presupuesto(self, agent_id):
        """Retorna True si el agente tiene presupuesto, False si debe detenerse."""
        today = datetime.now().strftime("%Y-%m-%d")
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM agent_budgets WHERE agent_id = ?", (agent_id,)).fetchone()
            
            if not row:
                return True # Si no hay registro, permitimos (default)

            if row["last_reset"] != today:
                conn.execute("UPDATE agent_budgets SET current_tokens=0, current_calls=0, last_reset=? WHERE agent_id=?", (today, agent_id))
                return True

            if row["current_calls"] >= row["daily_call_limit"]:
                return False
            
            return True

    def registrar_consumo(self, agent_id, tokens):
        """Anota el gasto tras una operación exitosa."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE agent_budgets 
                SET current_tokens = current_tokens + ?, 
                    current_calls = current_calls + 1
                WHERE agent_id = ?
            """, (tokens, agent_id))
            conn.commit()
