import { NextRequest, NextResponse } from 'next/server';
import { procesarPago, verificarFirmaPey } from '@/lib/server/pagos';
import { notificarPago } from '@/lib/server/notificaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTOS = new Set(['codi.qr.payment_received', 'codi.pn.payment_received']);

// POST /api/webhooks/pey — pagos CoDi confirmados por pey (Standard Webhooks).
// 1) Firma sobre el cuerpo CRUDO  2) idempotencia  3) confirmación GET /transaction  4) efectos.
export async function POST(req: NextRequest) {
    const raw = await req.text();
    const secret = process.env.PEY_WEBHOOK_SECRET || '';
    const inseguro = process.env.PEY_WEBHOOK_INSECURE === '1' && process.env.NODE_ENV !== 'production';

    if (!inseguro) {
        if (!secret) {
            console.error('[webhook pey] Falta PEY_WEBHOOK_SECRET');
            return NextResponse.json({ error: 'webhook no configurado' }, { status: 500 });
        }
        if (!raw || !verificarFirmaPey(secret, req.headers, raw)) {
            console.warn('[webhook pey] firma inválida o cuerpo vacío', { len: raw.length, id: req.headers.get('webhook-id') });
            return NextResponse.json({ error: 'firma inválida' }, { status: 401 });
        }
    } else {
        console.warn('⚠️⚠️⚠️ [webhook pey] MODO INSEGURO: firma NO verificada (solo local) ⚠️⚠️⚠️');
    }

    let evento: any;
    try {
        evento = JSON.parse(raw);
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    if (!EVENTOS.has(evento?.type)) {
        return NextResponse.json({ ok: true, ignorado: evento?.type ?? null });
    }
    if (!evento.transactionId) {
        return NextResponse.json({ error: 'sin transactionId' }, { status: 400 });
    }

    try {
        const r = await procesarPago({
            transactionId: String(evento.transactionId),
            fuente: 'webhook',
            webhookId: req.headers.get('webhook-id') || undefined,
            tipoEvento: evento.type,
            codiQrId: evento.codiQrId,
            cobroIdHint: evento?.metadata?.externalMetadata?.cobro_id ?? evento?.metadata?.cobro_id,
        });
        if (r.resultado === 'no_pagado') {
            // pey aún no lo reporta PAID: pedimos reintento
            return NextResponse.json({ ok: false, resultado: r.resultado }, { status: 409 });
        }
        // Avisos por WhatsApp DESPUÉS del commit (cliente, dueño y stock bajo)
        await notificarPago(r);
        return NextResponse.json({ ok: true, resultado: r.resultado });
    } catch (e) {
        console.error('[webhook pey] error procesando', e);
        return NextResponse.json({ error: 'error interno' }, { status: 500 });
    }
}
