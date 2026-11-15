// Núcleo de pagos CoDi (pey) para Michingón. SOLO servidor.
// Reglas (INSTRUCCIONES.md §6–§7, MICHINGON.md §3–§4):
//  - Solo un pago confirmado por el servidor (webhook firmado o GET /transaction) cambia estados.
//  - Idempotencia: webhookEventos/{webhook-id} y businesses/{bid}/pagos/{transactionId} se crean una sola vez.
//  - Los efectos (venta, stock, pedido, orden de compra) ocurren SOLO si el pago es nuevo.
import crypto from 'node:crypto';
import {
    DocumentReference,
    FieldValue,
    Firestore,
    Timestamp,
} from 'firebase-admin/firestore';
import { adminDb, negocioId } from './firebase-admin';
import {
    aCentavos,
    crearPush,
    crearQr,
    numRefNuevo,
    obtenerTransaccion,
    transaccionesDeQr,
} from '../pey';

// ───────────────────────── Tipos ─────────────────────────

export type TipoCobro = 'venta_pos' | 'pedido' | 'anticipo' | 'saldo' | 'libre';
export type MetodoCobro = 'qr' | 'push';
export type EstadoCobro = 'pendiente' | 'pagado' | 'expirado' | 'fallido' | 'cancelado';

export interface ItemCobro {
    productId: string;
    productName: string;
    quantity: number;
    price: number; // pesos, precio unitario al momento del cobro
}

export interface CobroDoc {
    tipo: TipoCobro;
    metodo: MetodoCobro;
    montoCentavos: number; // total real de la venta
    montoCobradoCentavos: number; // lo que se manda a pey (puede ser monto de prueba)
    montoDemo: boolean;
    concepto: string;
    estado: EstadoCobro;
    items: ItemCobro[];
    telefono10?: string | null;
    orderId?: string | null;
    clienteId?: string | null;
    peyTransactionId?: string | null;
    peyCodiId?: string | null;
    peyQrId?: string | null;
    qrString?: string | null;
    pagadoCentavos: number;
    excedenteCentavos: number;
    pagoTardio: boolean;
    saleId?: string | null;
    expiraEn: Timestamp;
    pagadoEn?: Timestamp | null;
    ultimaRevision?: Timestamp | null;
    creadoEn: Timestamp;
    creadoPor?: string | null;
}

// ───────────────────── Firma Standard Webhooks ─────────────────────

export function verificarFirmaPey(secret: string, headers: Headers, rawBody: string, toleranciaS = 300): boolean {
    const id = headers.get('webhook-id');
    const ts = headers.get('webhook-timestamp');
    const firmas = headers.get('webhook-signature');
    if (!id || !ts || !firmas) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranciaS) return false;
    const llave = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const esperado = crypto.createHmac('sha256', llave).update(`${id}.${ts}.${rawBody}`).digest('base64');
    return firmas.split(' ').some((f) => {
        const [version, valor] = f.split(',');
        return (
            version === 'v1' &&
            !!valor &&
            valor.length === esperado.length &&
            crypto.timingSafeEqual(Buffer.from(valor), Buffer.from(esperado))
        );
    });
}

// ───────────────────── Utilidades Firestore ─────────────────────

const col = (db: Firestore, bid: string, nombre: string) => db.collection(`businesses/${bid}/${nombre}`);

/**
 * Michingón guarda productos con addDoc y además un campo `id` propio (prod-...).
 * El front usa ese campo como id, así que resolvemos por id de documento y, si no existe, por campo `id`.
 */
export async function resolverProductos(
    db: Firestore,
    bid: string,
    ids: string[],
): Promise<Map<string, DocumentReference>> {
    const mapa = new Map<string, DocumentReference>();
    for (const id of Array.from(new Set(ids))) {
        const directo = col(db, bid, 'products').doc(id);
        const snap = await directo.get();
        if (snap.exists) {
            mapa.set(id, directo);
            continue;
        }
        const q = await col(db, bid, 'products').where('id', '==', id).limit(1).get();
        if (!q.empty) mapa.set(id, q.docs[0].ref);
    }
    return mapa;
}

// ───────────────────── Crear cobro ─────────────────────

export interface CrearCobroInput {
    tipo: TipoCobro;
    metodo: MetodoCobro;
    items?: { productId: string; quantity: number; productName?: string; price?: number }[];
    montoCentavos?: number; // solo para cobros sin items (libre/anticipo/saldo)
    concepto?: string;
    telefono10?: string;
    orderId?: string;
    clienteId?: string;
    uid?: string;
}

export async function crearCobro(input: CrearCobroInput) {
    const db = adminDb();
    const bid = negocioId();

    // 1) Monto: lo calcula el SERVIDOR con los precios de Firestore (nunca el cliente ni el LLM)
    const items: ItemCobro[] = [];
    let montoCentavos = 0;
    if (input.items?.length) {
        const refs = await resolverProductos(db, bid, input.items.map((i) => i.productId));
        for (const it of input.items) {
            const q = Math.max(1, Math.floor(Number(it.quantity) || 0));
            const ref = refs.get(it.productId);
            const data = ref ? (await ref.get()).data() : undefined;
            const price = Number(data?.price ?? it.price ?? 0);
            items.push({ productId: it.productId, productName: String(data?.name ?? it.productName ?? 'Producto'), quantity: q, price });
            montoCentavos += aCentavos(price) * q;
        }
    } else {
        montoCentavos = Math.round(Number(input.montoCentavos) || 0);
    }
    if (montoCentavos <= 0) throw new Error('El monto del cobro debe ser mayor a 0');

    // 2) Monto de prueba: pey se prueba en producción con dinero real ($0.01). Se marca como demo.
    const demo = Number(process.env.PEY_MONTO_DEMO_CENTAVOS || 0);
    const montoCobradoCentavos = demo > 0 ? demo : montoCentavos;

    const ref = col(db, bid, 'cobros').doc();
    const concepto = (input.concepto || `Michingón ${input.tipo.replace('_', ' ')} ${ref.id.slice(0, 6)}`).slice(0, 120);
    const metadata = { cobro_id: ref.id, negocio: bid };
    const ahora = Timestamp.now();

    let peyQrId: string | null = null;
    let qrString: string | null = null;
    let peyTransactionId: string | null = null;
    let peyCodiId: string | null = null;
    let expiracionS = 600;

    if (input.metodo === 'qr') {
        const r = await crearQr({ montoCentavos: montoCobradoCentavos, concepto, expiracionS, numRef: numRefNuevo(), metadata });
        peyQrId = r.id;
        qrString = r.qrString;
    } else {
        const tel = String(input.telefono10 || '').replace(/\D/g, '').slice(-10);
        if (tel.length !== 10) throw new Error('Se necesita un teléfono de 10 dígitos para el cobro push');
        expiracionS = 360;
        const r = await crearPush({ montoCentavos: montoCobradoCentavos, telefono10: tel, concepto, expiracionS, numRef: numRefNuevo(), metadata });
        peyTransactionId = r.transactionId;
        peyCodiId = r.codiId;
        input.telefono10 = tel;
    }

    const doc: CobroDoc = {
        tipo: input.tipo,
        metodo: input.metodo,
        montoCentavos,
        montoCobradoCentavos,
        montoDemo: demo > 0,
        concepto,
        estado: 'pendiente',
        items,
        telefono10: input.telefono10 || null,
        orderId: input.orderId || null,
        clienteId: input.clienteId || null,
        peyTransactionId,
        peyCodiId,
        peyQrId,
        qrString,
        pagadoCentavos: 0,
        excedenteCentavos: 0,
        pagoTardio: false,
        saleId: null,
        expiraEn: Timestamp.fromMillis(ahora.toMillis() + expiracionS * 1000),
        pagadoEn: null,
        ultimaRevision: null,
        creadoEn: ahora,
        creadoPor: input.uid || null,
    };
    await ref.set(doc);
    await registrarEvento(db, bid, 'cobro_creado', `Cobro ${input.metodo.toUpperCase()} por ${fmt(montoCentavos)}`, { cobroId: ref.id });
    return { cobroId: ref.id, ...doc };
}

// ───────────────────── Procesar pago (idempotente) ─────────────────────

export interface PagoEntrante {
    transactionId: string;
    fuente: 'webhook' | 'reconciliacion';
    webhookId?: string;
    tipoEvento?: string;
    codiQrId?: string;
    cobroIdHint?: string; // metadata.cobro_id si viene
}

export type ResultadoPago =
    | { resultado: 'procesado'; cobroId: string; stockBajo: StockBajo[] }
    | { resultado: 'parcial' | 'excedente'; cobroId: string }
    | { resultado: 'duplicado' }
    | { resultado: 'no_pagado' }
    | { resultado: 'sin_conciliar' };

export interface StockBajo {
    productId: string;
    nombre: string;
    stock: number;
    minStock: number;
    ordenId: string;
}

async function encontrarCobro(db: Firestore, bid: string, p: PagoEntrante, payableId?: string) {
    const cobros = col(db, bid, 'cobros');
    let q = await cobros.where('peyTransactionId', '==', p.transactionId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
    const qrId = p.codiQrId || payableId;
    if (qrId) {
        q = await cobros.where('peyQrId', '==', qrId).limit(1).get();
        if (!q.empty) return q.docs[0].ref;
    }
    if (p.cobroIdHint) {
        const r = cobros.doc(p.cobroIdHint);
        if ((await r.get()).exists) return r;
    }
    return null;
}

export async function procesarPago(p: PagoEntrante): Promise<ResultadoPago> {
    const db = adminDb();
    const bid = negocioId();

    // 1) Confirmación del lado del servidor (regla 2 del reto)
    const tx = await obtenerTransaccion(p.transactionId);
    if (tx.status !== 'PAID') return { resultado: 'no_pagado' };
    const montoPagado = aCentavos(tx.amountBreakdown?.base ?? tx.amount);
    const hint =
        p.cobroIdHint ||
        (tx.metadata as any)?.cobro_id ||
        (tx.metadata as any)?.externalMetadata?.cobro_id ||
        undefined;

    // 2) Conciliar con el cobro (fuera de la transacción: son consultas)
    const cobroRef = await encontrarCobro(db, bid, { ...p, cobroIdHint: hint }, tx.payableId);
    let productRefs = new Map<string, DocumentReference>();
    let cobroPrevio: CobroDoc | undefined;
    if (cobroRef) {
        cobroPrevio = (await cobroRef.get()).data() as CobroDoc | undefined;
        if (cobroPrevio?.items?.length) {
            productRefs = await resolverProductos(db, bid, cobroPrevio.items.map((i) => i.productId));
        }
    }

    const pagoRef = col(db, bid, 'pagos').doc(p.transactionId);
    const evRef = p.webhookId ? db.collection('webhookEventos').doc(p.webhookId) : null;

    // 3) Transacción: lecturas primero, luego escrituras
    return db.runTransaction<ResultadoPago>(async (t) => {
        const pagoSnap = await t.get(pagoRef);
        const evSnap = evRef ? await t.get(evRef) : null;
        if (pagoSnap.exists || evSnap?.exists) {
            if (evRef && !evSnap?.exists) t.create(evRef, { recibidoEn: Timestamp.now(), duplicadoDe: p.transactionId });
            return { resultado: 'duplicado' };
        }
        const cobroSnap = cobroRef ? await t.get(cobroRef) : null;
        const prodSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const [pid, ref] of Array.from(productRefs.entries())) prodSnaps.set(pid, await t.get(ref));
        const ordenRefs = new Map<string, DocumentReference>();
        const ordenSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const [pid, ref] of Array.from(productRefs.entries())) {
            const oref = col(db, bid, 'purchaseOrders').doc(`auto-${ref.id}`);
            ordenRefs.set(pid, oref);
            ordenSnaps.set(pid, await t.get(oref));
        }

        const ahora = Timestamp.now();
        // Nunca guardamos metadata del banco (CLABE, etc.): solo lo necesario.
        t.create(pagoRef, {
            cobroId: cobroRef?.id ?? null,
            montoCentavos: montoPagado,
            tipoEvento: p.tipoEvento ?? tx.payableType ?? null,
            fuente: p.fuente,
            payableType: tx.payableType ?? null,
            datePaid: tx.datePaid ?? null,
            recibidoEn: ahora,
        });
        if (evRef) t.create(evRef, { recibidoEn: ahora, transactionId: p.transactionId });

        const evento = (tipo: string, texto: string, extra: Record<string, unknown> = {}) =>
            t.create(col(db, bid, 'eventos').doc(), { tipo, texto, ...extra, creadoEn: ahora });

        if (!cobroRef || !cobroSnap?.exists) {
            evento('pago_sin_conciliar', `Pago ${fmt(montoPagado)} sin cobro asociado (${p.transactionId})`);
            return { resultado: 'sin_conciliar' };
        }

        const cobro = cobroSnap.data() as CobroDoc;
        if (cobro.estado === 'pagado') {
            t.update(cobroRef, { excedenteCentavos: FieldValue.increment(montoPagado) });
            evento('pago_excedente', `Pago extra de ${fmt(montoPagado)} al cobro ya pagado. Saldo a favor; revisar devolución.`, { cobroId: cobroRef.id });
            return { resultado: 'excedente', cobroId: cobroRef.id };
        }

        const acumulado = (cobro.pagadoCentavos || 0) + montoPagado;
        if (acumulado < cobro.montoCobradoCentavos) {
            t.update(cobroRef, { pagadoCentavos: acumulado });
            evento('pago_parcial', `Pago parcial ${fmt(montoPagado)}; faltan ${fmt(cobro.montoCobradoCentavos - acumulado)}`, { cobroId: cobroRef.id });
            return { resultado: 'parcial', cobroId: cobroRef.id };
        }

        // ── Pago completo: efectos (una sola vez) ──
        const tardio = cobro.estado === 'expirado' || ahora.toMillis() > cobro.expiraEn.toMillis();
        const stockBajo: StockBajo[] = [];
        let saleId: string | null = null;

        if (cobro.items?.length) {
            saleId = `codi-${p.transactionId}`;
            t.set(col(db, bid, 'sales').doc(saleId), {
                id: saleId,
                products: cobro.items.map((i) => ({
                    productId: i.productId,
                    productName: i.productName,
                    quantity: i.quantity,
                    price: i.price,
                    subtotal: Math.round(i.price * i.quantity * 100) / 100,
                })),
                total: cobro.montoCentavos / 100,
                paymentMethod: 'codi',
                status: 'completed',
                clientId: cobro.clienteId ?? null,
                cobroId: cobroRef.id,
                peyTransactionId: p.transactionId,
                montoDemo: cobro.montoDemo,
                createdAt: ahora,
            });

            for (const it of cobro.items) {
                const ref = productRefs.get(it.productId);
                const snap = prodSnaps.get(it.productId);
                if (!ref || !snap?.exists) continue;
                const d = snap.data() || {};
                const nuevo = Number(d.stock || 0) - it.quantity;
                t.update(ref, { stock: FieldValue.increment(-it.quantity), updatedAt: ahora });
                const min = Number(d.minStock || 0);
                if (min > 0 && nuevo <= min) {
                    const oref = ordenRefs.get(it.productId)!;
                    const osnap = ordenSnaps.get(it.productId);
                    const abierta = osnap?.exists && ['pendiente', 'aprobada', 'enviada'].includes(osnap.data()?.estado);
                    if (!abierta) {
                        const sugerida = Math.max(min * 2 - nuevo, 1);
                        t.set(oref, {
                            id: oref.id,
                            estado: 'pendiente',
                            productId: it.productId,
                            productName: d.name ?? it.productName,
                            cantidad: sugerida,
                            costoUnit: Number(d.cost || 0),
                            totalEstimado: Math.round(sugerida * Number(d.cost || 0) * 100) / 100,
                            motivo: `Stock ${nuevo} ≤ mínimo ${min} tras venta CoDi`,
                            creadoEn: ahora,
                        });
                    }
                    stockBajo.push({ productId: it.productId, nombre: String(d.name ?? it.productName), stock: nuevo, minStock: min, ordenId: oref.id });
                }
            }
        }

        if (cobro.orderId) {
            t.update(col(db, bid, 'orders').doc(cobro.orderId), { status: 'preparing', updatedAt: ahora, pagado: true });
        }

        t.update(cobroRef, {
            estado: 'pagado',
            pagadoCentavos: acumulado,
            pagadoEn: ahora,
            pagoTardio: tardio,
            saleId,
            peyTransactionId: cobro.peyTransactionId ?? p.transactionId,
        });
        evento('pago_recibido', `✅ Pago CoDi ${fmt(montoPagado)}${tardio ? ' (tardío)' : ''} · ${cobro.concepto}`, { cobroId: cobroRef.id, saleId });
        for (const s of stockBajo) {
            evento('stock_bajo', `⚠️ ${s.nombre}: quedan ${s.stock} (mínimo ${s.minStock}). Orden de compra pendiente.`, { productId: s.productId, ordenId: s.ordenId });
        }
        return { resultado: 'procesado', cobroId: cobroRef.id, stockBajo };
    });
}

// ───────────────────── Reconciliación (webhook perdido / expiración) ─────────────────────

/**
 * Revisa un cobro pendiente contra pey. Sirve de respaldo si el webhook no llega
 * (p. ej. Firebase altera el cuerpo crudo). Usa la MISMA ruta idempotente.
 */
export async function reconciliarCobro(cobroId: string, minIntervaloMs = 4000) {
    const db = adminDb();
    const bid = negocioId();
    const ref = col(db, bid, 'cobros').doc(cobroId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const c = snap.data() as CobroDoc;
    if (c.estado !== 'pendiente') return c;
    const ultima = c.ultimaRevision?.toMillis() ?? 0;
    if (Date.now() - ultima < minIntervaloMs) return c;
    await ref.update({ ultimaRevision: Timestamp.now() });

    try {
        const { notificarPago } = await import('./notificaciones');
        if (c.peyTransactionId) {
            const r = await procesarPago({ transactionId: c.peyTransactionId, fuente: 'reconciliacion', cobroIdHint: cobroId });
            await notificarPago(r);
            if (r.resultado !== 'no_pagado') return (await ref.get()).data() as CobroDoc;
        } else if (c.peyQrId) {
            const { items } = await transaccionesDeQr(c.peyQrId);
            for (const it of (items || []).filter((i) => i.status === 'PAID')) {
                const r = await procesarPago({ transactionId: it.id, fuente: 'reconciliacion', codiQrId: c.peyQrId, cobroIdHint: cobroId });
                await notificarPago(r);
            }
        }
    } catch (e) {
        console.error('[pagos] reconciliación falló', cobroId, e);
    }

    const actual = (await ref.get()).data() as CobroDoc;
    if (actual.estado === 'pendiente' && Date.now() > actual.expiraEn.toMillis() + 15_000) {
        await ref.update({ estado: 'expirado' });
        await registrarEvento(db, bid, 'cobro_expirado', `Cobro ${fmt(actual.montoCentavos)} expiró sin pago. Se puede reenviar.`, { cobroId });
        return { ...actual, estado: 'expirado' as EstadoCobro };
    }
    return actual;
}

// ───────────────────── Helpers ─────────────────────

export function fmt(centavos: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(centavos / 100);
}

async function registrarEvento(db: Firestore, bid: string, tipo: string, texto: string, extra: Record<string, unknown> = {}) {
    await col(db, bid, 'eventos').add({ tipo, texto, ...extra, creadoEn: Timestamp.now() });
}

export function cobroPublico(id: string, c: CobroDoc) {
    return {
        cobroId: id,
        tipo: c.tipo,
        metodo: c.metodo,
        estado: c.estado,
        montoCentavos: c.montoCentavos,
        montoCobradoCentavos: c.montoCobradoCentavos,
        montoDemo: c.montoDemo,
        concepto: c.concepto,
        qrString: c.qrString ?? null,
        telefono10: c.telefono10 ? `******${c.telefono10.slice(-4)}` : null,
        pagoTardio: c.pagoTardio,
        saleId: c.saleId ?? null,
        expiraEn: c.expiraEn?.toMillis?.() ?? null,
        pagadoEn: c.pagadoEn?.toMillis?.() ?? null,
    };
}
