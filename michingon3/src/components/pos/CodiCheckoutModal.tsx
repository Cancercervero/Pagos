'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, Smartphone, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { formatCurrency } from '@/lib/utils';

export interface CodiItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
}

interface CobroPublico {
    cobroId: string;
    estado: 'pendiente' | 'pagado' | 'expirado' | 'fallido' | 'cancelado';
    metodo: 'qr' | 'push';
    montoCentavos: number;
    montoCobradoCentavos: number;
    montoDemo: boolean;
    qrDataUrl?: string | null;
    telefono10?: string | null;
    pagoTardio?: boolean;
    expiraEn?: number | null;
    saleId?: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const token = await auth?.currentUser?.getIdToken();
    const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    return data as T;
}

export function CodiCheckoutModal({
    items,
    total,
    onClose,
    onPagado,
}: {
    items: CodiItem[];
    total: number;
    onClose: () => void;
    onPagado: () => void;
}) {
    const [metodo, setMetodo] = useState<'qr' | 'push'>('qr');
    const [telefono, setTelefono] = useState('');
    const [cobro, setCobro] = useState<CobroPublico | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creando, setCreando] = useState(false);
    const [restante, setRestante] = useState<number>(0);
    const avisado = useRef(false);

    const crear = async (m: 'qr' | 'push') => {
        setError(null);
        setCreando(true);
        setCobro(null);
        avisado.current = false;
        try {
            const c = await api<CobroPublico>('/api/pey/cobro', {
                method: 'POST',
                body: JSON.stringify({
                    tipo: 'venta_pos',
                    metodo: m,
                    telefono10: m === 'push' ? telefono : undefined,
                    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, productName: i.productName, price: i.price })),
                }),
            });
            setCobro(c);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreando(false);
        }
    };

    // QR se genera en cuanto abre el modal
    useEffect(() => {
        crear('qr');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Estado en vivo: el servidor confirma con pey (webhook o reconciliación)
    useEffect(() => {
        if (!cobro || cobro.estado !== 'pendiente') return;
        const t = setInterval(async () => {
            try {
                const c = await api<CobroPublico>(`/api/pey/cobro/${cobro.cobroId}`);
                setCobro((prev) => ({ ...(prev || c), ...c, qrDataUrl: prev?.qrDataUrl }));
            } catch {
                /* reintenta en el siguiente tick */
            }
        }, 2000);
        return () => clearInterval(t);
    }, [cobro?.cobroId, cobro?.estado]);

    useEffect(() => {
        if (!cobro?.expiraEn || cobro.estado !== 'pendiente') return;
        const t = setInterval(() => setRestante(Math.max(0, Math.round((cobro.expiraEn! - Date.now()) / 1000))), 500);
        return () => clearInterval(t);
    }, [cobro?.expiraEn, cobro?.estado]);

    useEffect(() => {
        if (cobro?.estado === 'pagado' && !avisado.current) {
            avisado.current = true;
            onPagado();
        }
    }, [cobro?.estado, onPagado]);

    const pagado = cobro?.estado === 'pagado';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-1">Cobrar con CoDi</h3>
                <p className="text-xs text-gray-500 mb-4">Pago directo del banco del cliente vía pey. Se confirma solo.</p>

                <div className="text-center mb-3">
                    <div className="text-4xl font-extrabold text-gray-900">{formatCurrency(total)}</div>
                    {cobro?.montoDemo && (
                        <div className="mt-1 inline-block rounded-full bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 font-semibold">
                            DEMO: se cobran {formatCurrency(cobro.montoCobradoCentavos / 100)} reales (prueba pey)
                        </div>
                    )}
                </div>

                {!pagado && (
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => { setMetodo('qr'); crear('qr'); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border ${metodo === 'qr' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-700'}`}
                        >
                            <QrCode className="w-4 h-4" /> QR en pantalla
                        </button>
                        <button
                            onClick={() => { setMetodo('push'); setCobro(null); setError(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border ${metodo === 'push' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-700'}`}
                        >
                            <Smartphone className="w-4 h-4" /> A su banco
                        </button>
                    </div>
                )}

                {metodo === 'push' && !cobro && !pagado && (
                    <div className="mb-4">
                        <label className="text-xs text-gray-600">Celular del cliente (10 dígitos, con CoDi activo)</label>
                        <input
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            inputMode="numeric"
                            placeholder="5512345678"
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-lg tracking-widest"
                        />
                        <button
                            disabled={telefono.length !== 10 || creando}
                            onClick={() => crear('push')}
                            className="w-full mt-3 py-2 bg-teal-600 disabled:bg-gray-300 text-white rounded-lg font-bold"
                        >
                            Enviar cobro a su banco
                        </button>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center min-h-[260px]">
                    {creando && (
                        <div className="flex flex-col items-center text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" /> Generando cobro…
                        </div>
                    )}

                    {error && (
                        <div className="w-full rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                                <div className="font-semibold">No se pudo crear el cobro</div>
                                <div className="text-xs break-words">{error}</div>
                                <button onClick={() => crear(metodo)} className="mt-2 text-xs underline flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Reintentar
                                </button>
                            </div>
                        </div>
                    )}

                    {cobro && !pagado && cobro.estado === 'pendiente' && (
                        <>
                            {cobro.metodo === 'qr' && cobro.qrDataUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cobro.qrDataUrl} alt="QR CoDi" className="w-60 h-60" />
                            )}
                            {cobro.metodo === 'push' && (
                                <div className="text-center text-gray-700">
                                    <Smartphone className="w-12 h-12 mx-auto text-teal-600 mb-2" />
                                    Cobro enviado a la app bancaria de <b>{cobro.telefono10}</b>.
                                    <div className="text-xs text-gray-500">El cliente lo autoriza en su banco.</div>
                                </div>
                            )}
                            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                                <Loader2 className="w-4 h-4 animate-spin" /> Esperando confirmación del banco…
                                {restante > 0 && <span className="text-xs text-gray-400">({Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')})</span>}
                            </div>
                        </>
                    )}

                    {cobro?.estado === 'expirado' && (
                        <div className="text-center">
                            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                            <div className="font-semibold text-gray-800">El cobro expiró sin pago</div>
                            <button onClick={() => crear(metodo)} className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold">
                                Generar uno nuevo
                            </button>
                        </div>
                    )}

                    {pagado && (
                        <div className="text-center animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto" />
                            <div className="text-3xl font-extrabold text-green-600 mt-2">PAGADO ✓</div>
                            <div className="text-sm text-gray-600 mt-1">
                                Confirmado por el banco. Venta registrada y stock actualizado.
                                {cobro?.pagoTardio && <span className="block text-amber-600 text-xs">Pago tardío aceptado.</span>}
                            </div>
                            <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold">
                                Listo
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
