// Cliente de la API de pey (CoDi). Contratos tomados de docs/pey_openapi.json.
// Base: https://api.pey.mx · Auth: Authorization: Bearer <PEY_API_KEY>
// Montos: pey recibe PESOS (number). Internamente manejamos centavos enteros.

const BASE = (process.env.PEY_BASE_URL || 'https://api.pey.mx').replace(/\/$/, '');

export class PeyError extends Error {
    constructor(
        message: string,
        public status: number,
        public type?: string,
        public requestId?: string | null,
    ) {
        super(message);
    }
}

export const aPesos = (centavos: number) => Math.round(centavos) / 100;
export const aCentavos = (pesos: number) => Math.round(Number(pesos) * 100);

async function peyFetch<T>(path: string, init: RequestInit = {}, intentos = 3): Promise<T> {
    const key = process.env.PEY_API_KEY;
    if (!key) throw new PeyError('Falta PEY_API_KEY', 500);
    let ultimo: unknown;
    for (let i = 0; i < intentos; i++) {
        const res = await fetch(`${BASE}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                ...(init.headers || {}),
            },
            cache: 'no-store',
        });
        const texto = await res.text();
        const data = texto ? JSON.parse(texto) : {};
        if (res.ok) return data as T;
        const err = data?.error || {};
        ultimo = new PeyError(err.message || `pey HTTP ${res.status}`, res.status, err.type, err.requestId);
        console.error('[pey] error', res.status, err.type, err.requestId, err.message);
        // Reintento solo en 503 (mantenimiento) o 5xx transitorio
        if (res.status === 503 || res.status >= 500) {
            await new Promise((r) => setTimeout(r, 600 * (i + 1)));
            continue;
        }
        break;
    }
    throw ultimo;
}

type Metadata = Record<string, string | number | boolean | null>;

/** POST /codi/qr → 201 { id (IDC de Banxico), qrString, qrImage? } */
export function crearQr(p: {
    montoCentavos: number;
    concepto: string;
    expiracionS?: number; // 0 = sin expiración; si se define, mínimo 360
    numRef?: string; // 1-7 dígitos
    metadata?: Metadata;
}) {
    return peyFetch<{ id: string; qrString: string; qrImage?: string | null }>('/codi/qr', {
        method: 'POST',
        body: JSON.stringify({
            amount: aPesos(p.montoCentavos),
            concept: p.concepto.slice(0, 120),
            expiration: p.expiracionS ?? 600,
            numRef: p.numRef ?? '0',
            generateImage: false,
            metadata: p.metadata,
        }),
    });
}

/** POST /codi/pn → 200 { transactionId (ULID), codiId } — el cobro le llega a la app bancaria del pagador */
export function crearPush(p: {
    montoCentavos: number;
    telefono10: string;
    concepto: string;
    expiracionS?: number; // mínimo y default 360
    numRef?: string;
    metadata?: Metadata;
}) {
    return peyFetch<{ transactionId: string; codiId: string }>('/codi/pn', {
        method: 'POST',
        body: JSON.stringify({
            amount: aPesos(p.montoCentavos),
            phoneNumber: p.telefono10,
            concept: p.concepto.slice(0, 120),
            expiration: Math.max(360, p.expiracionS ?? 360),
            numRef: p.numRef ?? '0',
            metadata: p.metadata,
        }),
    });
}

/** POST /payment-link/create → { id, url } (CoDi o tarjeta). URLs HTTPS obligatorias. */
export function crearLink(p: { montoCentavos: number; successUrl: string; backUrl: string; referencia?: string; metadata?: Metadata }) {
    return peyFetch<{ id: string; url: string }>('/payment-link/create', {
        method: 'POST',
        body: JSON.stringify({
            amount: aPesos(p.montoCentavos),
            successUrl: p.successUrl,
            backUrl: p.backUrl,
            clientReferenceId: p.referencia,
            metadata: p.metadata,
        }),
    });
}

export interface PeyTransaccion {
    id: string;
    status: 'PENDING' | 'PAID';
    amount: number;
    amountBreakdown?: { base?: number; tip?: number; fee?: number };
    currency?: string;
    paymentMethod?: 'CARD' | 'CODI';
    payableType?: 'PAYMENT_LINK' | 'API_CODI_QR' | 'API_CODI_PN';
    payableId?: string;
    description?: string;
    dateCreated?: number;
    datePaid?: number;
    metadata?: Record<string, unknown>;
}

/** GET /transaction/{id} — confirmación del lado del servidor */
export function obtenerTransaccion(id: string) {
    return peyFetch<PeyTransaccion>(`/transaction/${encodeURIComponent(id)}`, { method: 'GET' });
}

/** GET /transaction/codi/qr/{id} — pagos recibidos por un QR (hasta 20, recientes primero) */
export function transaccionesDeQr(qrId: string) {
    return peyFetch<{ items: PeyTransaccion[] }>(`/transaction/codi/qr/${encodeURIComponent(qrId)}`, { method: 'GET' });
}

/** Referencia numérica de 7 dígitos para CoDi */
export function numRefNuevo(): string {
    return String(Date.now() % 10_000_000).padStart(7, '0');
}
