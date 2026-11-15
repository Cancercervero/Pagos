import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from host_engine.skills.empire_ledger import EmpireLedger

class ProphetForecasting:
    """
    EL OJO DEL PROFETA
    Predicción de agotamiento de stock basada en tendencias de consumo.
    """
    def __init__(self, ledger: Optional[EmpireLedger] = None):
        self.ledger = ledger or EmpireLedger()

    def predecir_agotamiento(self, part_name: str) -> Dict:
        """
        Calcula cuántos días de vida le quedan a un producto.
        """
        with self.ledger._get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Obtener consumo de los últimos 7 días
            cutoff = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute('''
                SELECT SUM(it.quantity) 
                FROM inventory_tx it
                JOIN stock_items si ON it.stock_item_id = si.id
                JOIN parts p ON si.part_id = p.id
                WHERE p.name = ? AND it.tx_type = 'OUT' AND it.tx_date >= ?
            ''', (part_name, cutoff))
            
            consumo_total_7d = cursor.fetchone()[0] or 0
            consumo_diario_promedio = consumo_total_7d / 7
            
            # 2. Obtener stock actual
            cursor.execute('''
                SELECT SUM(quantity) 
                FROM stock_items si
                JOIN parts p ON si.part_id = p.id
                WHERE p.name = ? AND is_depleted = 0
            ''', (part_name,))
            
            stock_actual = cursor.fetchone()[0] or 0
            
            if consumo_diario_promedio <= 0:
                return {"part": part_name, "status": "stable", "msg": "Sin consumo reciente detectado."}
            
            dias_restantes = stock_actual / consumo_diario_promedio
            
            # 3. Generar Alerta Imperial
            if dias_restantes <= 3:
                return {
                    "part": part_name,
                    "status": "CRITICAL",
                    "days": round(dias_restantes, 1),
                    "msg": f"⚠️ ALERTA: El stock de {part_name} se agotará en {round(dias_restantes, 1)} días."
                }
            
            return {
                "part": part_name,
                "status": "healthy",
                "days": round(dias_restantes, 1)
            }

if __name__ == "__main__":
    profeta = ProphetForecasting()
    print(profeta.predecir_agotamiento("Azúcar 1kg"))
