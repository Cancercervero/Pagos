"""
petra_cobranzas_skill.py — La cobradora implacable del Imperio.
Wrapper sobre ventas_skill para darle la personalidad de Petra.
"""
import re
import random
import logging
from host_engine.skills.ventas_skill import procesar_ventas
from host_engine.cerberus_core.ventas_db import VentasDB

logger = logging.getLogger("PetraSkill")

PETRA_PHRASES = [
    "Mira, no estoy aquí para hacer amigos, estoy aquí para que pagues.",
    "El Imperio no funciona con promesas, funciona con billetes.",
    "¿Otra vez tú? Ya pareces disco rayado con tus excusas.",
    "Si no hay pago, no hay mercancía. Así de simple.",
    "Cerberus ya me preguntó por tu saldo, y créeme, no quieres que él vaya a cobrarte.",
    "¡Acuérdate que el que debe, no duerme! Y yo no te voy a dejar dormir.",
]

def procesar_cobro_petra(prompt: str, user_id: str = "default") -> str:
    p = prompt.lower().strip()
    db = VentasDB()
    
    # ── Quién nos debe? (Resumen general) ──────────────────────────────────
    if any(kw in p for kw in ["quién debe", "quien debe", "lista de deudores", "morosos", "lista negra"]):
        deudores = db.get_cuentas_por_cobrar()
        if not deudores:
            return "😌 Milagro... nadie nos debe nada. Por ahora."
        
        saludo = random.choice(PETRA_PHRASES)
        total = sum(d["saldo"] for d in deudores)
        
        lines = [f"👠 *Petra de Cobranzas:* \"{saludo}\"\n"]
        lines.append(f"💰 *MONTO TOTAL EN LA CALLE: ${total:,.2f}*\n")
        lines.append("📝 *LISTA NEGRA:*")
        
        for d in deudores[:10]:
            lines.append(f"  • {d['cliente']}: *${d['saldo']:,.2f}* (Folio: {d['folio']})")
        
        if len(deudores) > 10:
            lines.append(f"\n... y hay otros {len(deudores)-10} que mejor ni te cuento.")
            
        return "\n".join(lines)

    # ── Cuánto debe [Cliente]? ───────────────────────────────────────────
    if any(kw in p for kw in ["cuánto debe", "deuda de", "saldo de"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        
        if not cliente_found:
            return "👵 No sé de quién hablas. Dame un nombre real o no me quites el tiempo."
            
        deudores = db.get_cuentas_por_cobrar()
        facturas = [d for d in deudores if d["cliente"] == cliente_found["nombre"]]
        total_cliente = sum(d["saldo"] for d in facturas)
        
        if total_cliente <= 0:
            return f"😇 {cliente_found['nombre']} está limpio. Qué raro, normalmente todos ocultan algo."
            
        return (
            f"🤨 *Petra de Cobranzas:* \"{cliente_found['nombre']} nos debe **${total_cliente:,.2f}**.\"\n"
            f"Ya le mandé tres recordatorios. Si no paga hoy, le corto el suministro.\n"
            f"_{len(facturas)} facturas pendientes._"
        )

    # ── Generar ultimátum ───────────────────────────────────────────────
    if any(kw in p for kw in ["ultimátum", "amenaza", "cobrale", "exige"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        
        if not cliente_found:
            return "🙄 ¿A quién quieres que asuste? Necesito un nombre."
            
        deudores = db.get_cuentas_por_cobrar()
        facturas = [d for d in deudores if d["cliente"] == cliente_found["nombre"]]
        total_cliente = sum(d["saldo"] for d in facturas)
        
        if total_cliente <= 0:
            return "🤷 No le debe nada a la empresa. Búscate a otro para molestar."
            
        mensaje_fuerte = (
            f"📢 *ULTIMÁTUM DE PETRA*\n\n"
            f"Estimado **{cliente_found['nombre']}**,\n"
            f"Se le comunica que su saldo de **${total_cliente:,.2f}** ha excedido "
            f"nuestra paciencia. Evite que su expediente pase a 'Medidas Especiales'.\n\n"
            f"Deposite de inmediato o aténgase a las consecuencias operativas.\n"
            f"Atentamente,\n"
            f"**Petra (Finanzas Cerberus Gate)** 👠"
        )
        return mensaje_fuerte

    # ── Fallback a ventas_skill (registrar pagos, etc) ──────────────────
    res = procesar_ventas(prompt)
    if res.get("text"):
        if "✅ *Pago registrado*" in res["text"]:
            return f"😏 \"{random.choice(['Ya era hora.', 'Por fin soltaron la lana.', 'Así me gusta.'])}\"\n\n{res['text']}"
        return res["text"]

    # ── Fallback LLM con personalidad de Petra + memoria ──────────────────
    try:
        from host_engine.cerberus_core.llm_router import ask_llm
        petra_system = (
            "Eres Petra, la cobradora del Imperio Cerberus Gate. "
            "Tu personalidad es implacable, directa y sin pelos en la lengua. "
            "El Imperio no funciona con promesas, funciona con billetes. "
            "Respondes en español. Eres breve, contundente y siempre recuerdas quién debe. "
            "Usas frases como 'El que debe, no duerme' y 'No estoy aquí para hacer amigos'."
        )
        return ask_llm(prompt, system=petra_system, agent_id="petra", user_id=user_id)
    except Exception:
        return "🙄 No te entendí nada. ¿Vienes a pagar o solo a estorbar?"


# Alias para ops_router
def procesar_cobranza(prompt: str, user_id: str = "default") -> str:
    return procesar_cobro_petra(prompt, user_id=user_id)

    p = prompt.lower().strip()
    db = VentasDB()
    
    # ── Quién nos debe? (Resumen general) ──────────────────────────────────
    if any(kw in p for kw in ["quién debe", "quien debe", "lista de deudores", "morosos", "lista negra"]):
        deudores = db.get_cuentas_por_cobrar()
        if not deudores:
            return "😌 Milagro... nadie nos debe nada. Por ahora."
        
        saludo = random.choice(PETRA_PHRASES)
        total = sum(d["saldo"] for d in deudores)
        
        lines = [f"👠 *Petra de Cobranzas:* \"{saludo}\"\n"]
        lines.append(f"💰 *MONTO TOTAL EN LA CALLE: ${total:,.2f}*\n")
        lines.append("📝 *LISTA NEGRA:*")
        
        for d in deudores[:10]:
            lines.append(f"  • {d['cliente']}: *${d['saldo']:,.2f}* (Folio: {d['folio']})")
        
        if len(deudores) > 10:
            lines.append(f"\n... y hay otros {len(deudores)-10} que mejor ni te cuento.")
            
        return "\n".join(lines)

    # ── Cuánto debe [Cliente]? ───────────────────────────────────────────
    if any(kw in p for kw in ["cuánto debe", "deuda de", "saldo de"]):
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        
        if not cliente_found:
            return "👵 No sé de quién hablas. Dame un nombre real o no me quites el tiempo."
            
        deudores = db.get_cuentas_por_cobrar()
        facturas = [d for d in deudores if d["cliente"] == cliente_found["nombre"]]
        total_cliente = sum(d["saldo"] for d in facturas)
        
        if total_cliente <= 0:
            return f"😇 {cliente_found['nombre']} está limpio. Qué raro, normalmente todos ocultan algo."
            
        return (
            f"🤨 *Petra de Cobranzas:* \"{cliente_found['nombre']} nos debe **${total_cliente:,.2f}**.\"\n"
            f"Ya le mandé tres recordatorios. Si no paga hoy, le corto el suministro.\n"
            f"_{len(facturas)} facturas pendientes._"
        )

    # ── Generar ultimátum ───────────────────────────────────────────────
    if any(kw in p for kw in ["ultimátum", "amenaza", "cobrale", "exige"]):
        # Extraer cliente
        clientes = db.listar_clientes()
        cliente_found = None
        for c in clientes:
            if c["nombre"].lower() in p:
                cliente_found = c
                break
        
        if not cliente_found:
            return "🙄 ¿A quién quieres que asuste? Necesito un nombre."
            
        deudores = db.get_cuentas_por_cobrar()
        facturas = [d for d in deudores if d["cliente"] == cliente_found["nombre"]]
        total_cliente = sum(d["saldo"] for d in facturas)
        
        if total_cliente <= 0:
            return "🤷 No le debe nada a la empresa. Búscate a otro para molestar."
            
        mensaje_fuerte = (
            f"📢 *ULTIMÁTUM DE PETRA*\n\n"
            f"Estimado **{cliente_found['nombre']}**,\n"
            f"Se le comunica que su saldo de **${total_cliente:,.2f}** ha excedido "
            f"nuestra paciencia. Evite que su expediente pase a 'Medidas Especiales'.\n\n"
            f"Deposite de inmediato o aténgase a las consecuencias operativas.\n"
            f"Atentamente,\n"
            f"**Petra (Finanzas Cerberus Gate)** 👠"
        )
        return mensaje_fuerte

    # ── Fallback a ventas_skill (registrar pagos, etc) ──────────────────
    res = procesar_ventas(prompt)
    if res.get("text"):
        # Envolver la respuesta con el tono de Petra si es un pago exitoso
        if "✅ *Pago registrado*" in res["text"]:
            return f"😏 \"{random.choice(['Ya era hora.', 'Por fin soltaron la lana.', 'Así me gusta.'])}\"\n\n{res['text']}"
        return res["text"]
        
    return "🙄 No te entendí nada. ¿Vienes a pagar o solo a estorbar?"
