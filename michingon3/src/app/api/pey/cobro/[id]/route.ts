import { NextRequest, NextResponse } from 'next/server';
import { cobroPublico, reconciliarCobro } from '@/lib/server/pagos';
import { usuarioDesdeRequest } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/pey/cobro/{id} — estado del cobro. Si sigue pendiente, consulta a pey
// (respaldo por si el webhook no llega) usando la misma ruta idempotente.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const usuario = await usuarioDesdeRequest(req);
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const cobro = await reconciliarCobro(params.id);
    if (!cobro) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });
    return NextResponse.json(cobroPublico(params.id, cobro));
}
