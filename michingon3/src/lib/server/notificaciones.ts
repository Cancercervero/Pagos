// Avisos por WhatsApp después de un pago confirmado (siempre DESPUÉS del commit).
import { adminDb, negocioId } from './firebase-admin';
import { avisarDuenos, enviarTexto } from '../whatsapp';
import type { CobroDoc, ResultadoPago } from './pagos';

const fmt = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(c / 100);

export async function notificarPago(r: ResultadoPago) {
    if (r.resultado !== 'procesado') return;
    try {
        const snap = await adminDb().doc(`businesses/${negocioId()}/cobros/${r.cobroId}`).get();
        const c = snap.data() as CobroDoc | undefined;
        if (!c) return;
        const demo = c.montoDemo ? ` (prueba: ${fmt(c.montoCobradoCentavos)})` : '';
        if (c.telefono10) {
            const extra = c.tipo === 'pedido' ? ' Tu pedido ya está en preparación. 🛍️' : '';
            await enviarTexto(c.telefono10, `✅ Recibimos tu pago de ${fmt(c.montoCentavos)}${demo}. ¡Gracias!${extra}`);
        }
        await avisarDuenos(`💰 Pago CoDi confirmado por el banco: ${fmt(c.montoCentavos)}${demo} · ${c.concepto}${c.pagoTardio ? ' · (tardío)' : ''}`);
        for (const s of r.stockBajo) {
            await avisarDuenos(
                `⚠️ ${s.nombre}: quedan ${s.stock} (mínimo ${s.minStock}).\n¿Mando el pedido al proveedor? Responde *SÍ* para enviarlo (orden ${s.ordenId}).`,
            );
        }
    } catch (e) {
        console.error('[notificaciones] fallo al avisar', e);
    }
}
