'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle2, FileSpreadsheet, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { formatCurrency } from '@/lib/utils';

interface Articulo {
    nombre: string;
    categoria: string;
    cantidad: number;
    unidad: 'unit' | 'kg' | 'liter';
    costoUnitario: number;
    precioVenta: number;
    precioSugerido: boolean;
    claveSat?: string;
}

interface Extraccion {
    fuente: 'excel' | 'xml' | 'pdf' | 'foto';
    proveedor?: string;
    folio?: string;
    articulos: Articulo[];
    avisos: string[];
}

const FUENTE: Record<Extraccion['fuente'], string> = {
    excel: 'Excel de tu tienda',
    xml: 'Factura (XML)',
    pdf: 'Factura (PDF)',
    foto: 'Foto',
};

async function token() {
    return (await auth?.currentUser?.getIdToken()) || '';
}

export default function CargarInventarioPage() {
    const params = useParams<{ id: string }>();
    const [leyendo, setLeyendo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [datos, setDatos] = useState<Extraccion | null>(null);
    const [listo, setListo] = useState<{ creados: number; actualizados: number; inventario: { productos: number; valorCosto: number; valorVenta: number } } | null>(null);
    const archivoRef = useRef<HTMLInputElement>(null);
    const fotoRef = useRef<HTMLInputElement>(null);

    const subir = async (file?: File | null) => {
        if (!file) return;
        setError(null);
        setListo(null);
        setDatos(null);
        setLeyendo(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/inventario/extraer', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${await token()}` } });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'No se pudo leer');
            if (!j.articulos?.length) throw new Error(j.avisos?.[0] || 'No encontramos artículos en el archivo.');
            setDatos(j);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLeyendo(false);
            if (archivoRef.current) archivoRef.current.value = '';
            if (fotoRef.current) fotoRef.current.value = '';
        }
    };

    const editar = (i: number, campo: keyof Articulo, valor: string) => {
        if (!datos) return;
        const articulos = datos.articulos.map((a, j) => {
            if (j !== i) return a;
            if (campo === 'nombre' || campo === 'categoria') return { ...a, [campo]: valor };
            const n = Number(valor);
            return { ...a, [campo]: Number.isFinite(n) ? n : 0, ...(campo === 'precioVenta' ? { precioSugerido: false } : {}) };
        });
        setDatos({ ...datos, articulos });
    };

    const quitar = (i: number) => datos && setDatos({ ...datos, articulos: datos.articulos.filter((_, j) => j !== i) });

    const grupos = useMemo(() => {
        const m = new Map<string, { idx: number; a: Articulo }[]>();
        datos?.articulos.forEach((a, idx) => {
            const k = a.categoria || 'Sin categoría';
            m.set(k, [...(m.get(k) || []), { idx, a }]);
        });
        return Array.from(m.entries()).sort((x, y) => x[0].localeCompare(y[0]));
    }, [datos]);

    const totales = useMemo(() => {
        const arts = datos?.articulos || [];
        return {
            productos: arts.length,
            piezas: arts.reduce((s, a) => s + a.cantidad, 0),
            costo: arts.reduce((s, a) => s + a.cantidad * a.costoUnitario, 0),
            venta: arts.reduce((s, a) => s + a.cantidad * a.precioVenta, 0),
        };
    }, [datos]);

    const guardar = async () => {
        if (!datos) return;
        setGuardando(true);
        setError(null);
        try {
            const res = await fetch('/api/inventario/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
                body: JSON.stringify({ articulos: datos.articulos, proveedor: datos.proveedor, folio: datos.folio }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
            setListo(j);
            setDatos(null);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <Link href={`/business/${params?.id}/inventory`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
                <ArrowLeft className="w-4 h-4" /> Inventario
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Cargar inventario</h1>
            <p className="text-gray-500 mb-6">Sube lo que ya tengas. Nosotros acomodamos los artículos por grupo, con su costo, precio y existencia.</p>

            {!datos && !listo && (
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <button onClick={() => archivoRef.current?.click()} disabled={leyendo} className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-teal-500 hover:bg-teal-50 p-6 text-left transition">
                        <FileSpreadsheet className="w-8 h-8 text-teal-600 mb-2" />
                        <div className="font-bold text-gray-900">Excel de tu tienda</div>
                        <div className="text-xs text-gray-500">.xlsx, .xls o .csv, como lo tengas</div>
                    </button>
                    <button onClick={() => archivoRef.current?.click()} disabled={leyendo} className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-teal-500 hover:bg-teal-50 p-6 text-left transition">
                        <FileText className="w-8 h-8 text-teal-600 mb-2" />
                        <div className="font-bold text-gray-900">Factura de tu proveedor</div>
                        <div className="text-xs text-gray-500">XML o PDF; tomamos el precio al que llegó</div>
                    </button>
                    <button onClick={() => fotoRef.current?.click()} disabled={leyendo} className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-fuchsia-500 hover:bg-fuchsia-50 p-6 text-left transition">
                        <Camera className="w-8 h-8 text-fuchsia-600 mb-2" />
                        <div className="font-bold text-gray-900">Toma foto a tu lista</div>
                        <div className="text-xs text-gray-500">Lista escrita a mano o factura en papel</div>
                    </button>
                    <input ref={archivoRef} type="file" hidden accept=".xlsx,.xls,.csv,.ods,.xml,.pdf,image/*" onChange={(e) => subir(e.target.files?.[0])} />
                    <input ref={fotoRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => subir(e.target.files?.[0])} />
                </div>
            )}

            {leyendo && (
                <div className="flex items-center gap-3 rounded-xl bg-teal-50 text-teal-800 p-4 mb-6">
                    <Loader2 className="w-5 h-5 animate-spin" /> Leyendo y acomodando tus artículos…
                </div>
            )}

            {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 mb-6 text-sm">{error}</div>}

            {listo && (
                <div className="rounded-2xl bg-green-50 border border-green-200 p-6 mb-6">
                    <div className="flex items-center gap-2 text-green-700 font-bold text-lg">
                        <CheckCircle2 className="w-6 h-6" /> Inventario guardado
                    </div>
                    <p className="text-sm text-green-800 mt-1">
                        {listo.creados} productos nuevos · {listo.actualizados} actualizados (se sumó la existencia y se promedió el costo).
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3 mt-4">
                        <Tarjeta titulo="Productos en inventario" valor={String(listo.inventario.productos)} />
                        <Tarjeta titulo="Valor del inventario (a costo)" valor={formatCurrency(listo.inventario.valorCosto)} />
                        <Tarjeta titulo="Valor a precio de venta" valor={formatCurrency(listo.inventario.valorVenta)} />
                    </div>
                    <div className="flex gap-3 mt-4">
                        <Link href={`/business/${params?.id}/inventory`} className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold text-sm">Ver inventario</Link>
                        <button onClick={() => setListo(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold">Cargar otro</button>
                    </div>
                </div>
            )}

            {datos && (
                <>
                    <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
                        <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">{FUENTE[datos.fuente]}</span>
                        {datos.proveedor && <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">Proveedor: {datos.proveedor}</span>}
                        {datos.folio && <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">Folio: {datos.folio}</span>}
                    </div>
                    {datos.avisos?.length > 0 && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3 mb-4 text-sm">{datos.avisos.join(' · ')}</div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <Tarjeta titulo="Artículos" valor={String(totales.productos)} />
                        <Tarjeta titulo="Piezas" valor={totales.piezas.toLocaleString('es-MX')} />
                        <Tarjeta titulo="Valor a costo" valor={formatCurrency(totales.costo)} />
                        <Tarjeta titulo="Valor a venta" valor={formatCurrency(totales.venta)} />
                    </div>

                    <div className="space-y-6 mb-24">
                        {grupos.map(([cat, filas]) => (
                            <div key={cat} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                    <div className="font-bold text-gray-900">{cat}</div>
                                    <div className="text-xs text-gray-500">
                                        {filas.length} artículos · {formatCurrency(filas.reduce((s, f) => s + f.a.cantidad * f.a.costoUnitario, 0))} a costo
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-gray-500">
                                            <tr>
                                                <th className="text-left px-4 py-2">Artículo</th>
                                                <th className="text-left px-2 py-2">Grupo</th>
                                                <th className="text-right px-2 py-2">Cantidad</th>
                                                <th className="text-right px-2 py-2">Costo</th>
                                                <th className="text-right px-2 py-2">Precio venta</th>
                                                <th className="text-right px-2 py-2">Valor</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filas.map(({ idx, a }) => (
                                                <tr key={idx} className="border-t border-gray-100">
                                                    <td className="px-4 py-1.5"><input className="w-full min-w-[160px] bg-transparent" value={a.nombre} onChange={(e) => editar(idx, 'nombre', e.target.value)} /></td>
                                                    <td className="px-2 py-1.5"><input className="w-28 bg-transparent text-gray-600" value={a.categoria} onChange={(e) => editar(idx, 'categoria', e.target.value)} /></td>
                                                    <td className="px-2 py-1.5 text-right"><input type="number" className="w-20 text-right bg-transparent" value={a.cantidad} onChange={(e) => editar(idx, 'cantidad', e.target.value)} /></td>
                                                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.01" className="w-24 text-right bg-transparent" value={a.costoUnitario} onChange={(e) => editar(idx, 'costoUnitario', e.target.value)} /></td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        <input type="number" step="0.01" className={`w-24 text-right bg-transparent ${a.precioSugerido ? 'text-teal-700 italic' : ''}`} value={a.precioVenta} onChange={(e) => editar(idx, 'precioVenta', e.target.value)} title={a.precioSugerido ? 'Precio sugerido con tu margen; puedes cambiarlo' : ''} />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(a.cantidad * a.costoUnitario)}</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        <button onClick={() => quitar(idx)} className="text-gray-300 hover:text-red-600" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-gray-400">Los precios en <span className="italic text-teal-700">verde cursiva</span> son sugeridos con tu margen. Revísalos antes de guardar.</p>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-gray-200 p-4">
                        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
                            <button onClick={() => setDatos(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold">Cancelar</button>
                            <button onClick={guardar} disabled={guardando || !datos.articulos.length} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-bold">
                                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                Guardar {totales.productos} artículos · {formatCurrency(totales.costo)}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{titulo}</div>
            <div className="text-xl font-extrabold text-gray-900">{valor}</div>
        </div>
    );
}
