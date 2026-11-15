import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { crearCobro, cobroPublico, CrearCobroInput } from '@/lib/server/pagos';
import { usuarioDesdeRequest } from '@/lib/server/firebase-admin';
import { PeyError } from '@/lib/pey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/pey/cobro — crea un cobro CoDi (QR en pantalla o push al banco del cliente).
// El monto lo calcula el servidor con los precios de Firestore.
export async function POST(req: NextRequest) {
    const usuario = await usuarioDesdeRequest(req);
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    let body: Partial<CrearCobroInput>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const tipo = body.tipo ?? 'venta_pos';
    const metodo = body.metodo ?? 'qr';
    if (!['venta_pos', 'pedido', 'anticipo', 'saldo', 'libre'].includes(tipo) || !['qr', 'push'].includes(metodo)) {
        return NextResponse.json({ error: 'tipo o método inválido' }, { status: 400 });
    }

    try {
        const cobro = await crearCobro({
            tipo,
            metodo,
            items: Array.isArray(body.items) ? body.items.slice(0, 100) : undefined,
            montoCentavos: body.montoCentavos,
            concepto: body.concepto,
            telefono10: body.telefono10,
            orderId: body.orderId,
            clienteId: body.clienteId,
            uid: usuario.uid,
        });
        const publico = cobroPublico(cobro.cobroId, cobro);
        const qrDataUrl = cobro.qrString ? await QRCode.toDataURL(cobro.qrString, { width: 420, margin: 1 }) : null;
        return NextResponse.json({ ...publico, qrDataUrl });
    } catch (e) {
        if (e instanceof PeyError) {
            return NextResponse.json(
                { error: `pey: ${e.message}`, tipo: e.type, requestId: e.requestId },
                { status: e.status >= 500 ? 502 : 400 },
            );
        }
        console.error('[api/pey/cobro]', e);
        return NextResponse.json({ error: (e as Error).message || 'Error creando el cobro' }, { status: 400 });
    }
}
