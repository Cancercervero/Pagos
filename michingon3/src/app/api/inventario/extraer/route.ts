import { NextRequest, NextResponse } from 'next/server';
import { usuarioDesdeRequest } from '@/lib/server/firebase-admin';
import { extraerInventario, resumen } from '@/lib/server/inventario-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

// POST /api/inventario/extraer (multipart: file) → artículos agrupados + valor del inventario. No guarda nada.
export async function POST(req: NextRequest) {
    const usuario = await usuarioDesdeRequest(req);
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Sube un archivo' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo pesa más de 12 MB' }, { status: 400 });

    try {
        const buf = Buffer.from(await file.arrayBuffer());
        const r = await extraerInventario(file.name || 'archivo', file.type || '', buf);
        return NextResponse.json({ ...r, resumen: resumen(r.articulos) });
    } catch (e) {
        console.error('[api/inventario/extraer]', e);
        return NextResponse.json({ error: (e as Error).message || 'No se pudo leer el archivo' }, { status: 400 });
    }
}
