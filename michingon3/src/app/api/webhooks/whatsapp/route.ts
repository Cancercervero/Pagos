import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { responderYEnviar } from '@/lib/agente/agente';
import { telefono10 } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Verificación del webhook (GET) — el token viene de la variable de entorno, no del código.
export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams;
    const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
    if (esperado && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === esperado) {
        return new NextResponse(p.get('hub.challenge') || '', { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

// Mensajes entrantes (POST) → agente nuevo (src/lib/agente). Ya NO usa src/ai/flows (IA de Michingón).
export async function POST(req: NextRequest) {
    const raw = await req.text();

    // Firma de Meta (opcional, si se configura WHATSAPP_APP_SECRET)
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
        const firma = req.headers.get('x-hub-signature-256') || '';
        const esperada = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
        if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
            return new NextResponse('firma inválida', { status: 401 });
        }
    }

    let body: any;
    try {
        body = JSON.parse(raw);
    } catch {
        return new NextResponse('Bad Request', { status: 400 });
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    // Ignora estados (entregado/leído) y lo que no sea texto
    if (!msg || msg.type !== 'text' || !msg.text?.body) return NextResponse.json({ ok: true });

    // Dedupe: Meta reintenta
    try {
        await adminDb().collection('whatsappMensajes').doc(String(msg.id)).create({ recibidoEn: Timestamp.now() });
    } catch {
        return NextResponse.json({ ok: true, duplicado: true });
    }

    const waId = String(msg.from);
    const nombre = value?.contacts?.[0]?.profile?.name;
    try {
        await responderYEnviar(waId, telefono10(waId), String(msg.text.body), nombre);
    } catch (e) {
        console.error('[webhook whatsapp] error del agente', e);
    }
    return NextResponse.json({ ok: true });
}
