import logging
from .wealth_manager import wealth_vault
from datetime import datetime

logger = logging.getLogger("CajeroLedger")

class CajeroLedger:
    """
    EL CENTINELA DE EFECTIVO.
    Libro mayor de ultra-precisión con validación visual.
    """
    def __init__(self):
        pass

    def record_transaction(self, client_id, amount, tx_type, description, photo_path=None):
        """
        Registra una entrada o salida de efectivo.
        tx_type: 'ENTRADA' | 'SALIDA'
        """
        conn = wealth_vault.get_client_db(client_id)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO cash_ledger (tx_date, amount, tx_type, description, reference_photo)
                VALUES (?, ?, ?, ?, ?)
            """, (
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                amount,
                tx_type.upper(),
                description,
                photo_path
            ))
            conn.commit()
            
            status = "CON VALIDACIÓN" if photo_path else "PENDIENTE DE FOTO"
            return f"[CAJERO] Transacción de ${amount} registrada para {client_id}. Estado: {status}."
        except Exception as e:
            logger.error(f"Error en Cajero: {e}")
            return f"[CAJERO] Error al registrar: {str(e)}"

    def get_client_balance(self, client_id):
        """Calcula el balance total de cash para un cliente."""
        conn = wealth_vault.get_client_db(client_id)
        df = pd.read_sql_query("SELECT amount, tx_type FROM cash_ledger", conn)
        
        total = 0
        for _, row in df.iterrows():
            if row['tx_type'] == 'ENTRADA': total += row['amount']
            else: total -= row['amount']
            
        return total

cajero = CajeroLedger()
import pandas as pd
