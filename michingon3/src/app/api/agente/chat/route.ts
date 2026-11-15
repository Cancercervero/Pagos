import { NextRequest, NextResponse } from 'next/server';
import { usuarioDesdeRequest } from '@/lib/server/firebase-admin';
import { responder } from '@/lib/agente/agente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/agente/chat { telefono10, texto } — mismo agente que WhatsApp, para la demo web (respaldo).
export async function POST(req: NextRequest) {
    const usuario = await usuarioDesdeRequest(req);
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const tel = String(body?.telefono10 || '').replace(/\D/g, '').slice(-10);
    const texto = String(body?.texto || '').slice(0, 2000);
    if (tel.length !== 10 || !texto) return NextResponse.json({ error: 'telefono10 y texto requeridos' }, { status: 400 });
    try {
        const respuesta = await responder(tel, texto);
        return NextResponse.json({ respuesta });
    } catch (e) {
        console.error('[api/agente/chat]', e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
