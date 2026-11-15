'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/types/business';

interface MermaBreakdownDialogProps {
    open: boolean;
    onClose: () => void;
    products: Product[];
}

export function MermaBreakdownDialog({ open, onClose, products }: MermaBreakdownDialogProps) {
    if (!open) return null;

    // Calcular mermas (ejemplo: 5% de cada producto)
    const mermaData = products
        .filter(p => p.stock > 0)
        .map(product => ({
            producto: product.name,
            fechaLote: product.batches?.[0]?.date || '-',
            cantidadMerma: Math.round(product.stock * 0.05 * 100) / 100,
            costoTotal: product.cost * product.stock * 0.05
        }));

    const totalCosto = mermaData.reduce((sum, item) => sum + item.costoTotal, 0);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[1000]"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Desglose de Merma</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Pérdidas por productos que no se pudieron vender (caducados, dañados, etc.)
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                    {mermaData.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No se registraron mermas en este período.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Producto</th>
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha del Lote</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Cantidad Merma</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Costo Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {mermaData.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="py-3 px-2 text-sm text-gray-900">{item.producto}</td>
                                            <td className="py-3 px-2 text-sm text-gray-600">
                                                {item.fechaLote !== '-' ? new Date(item.fechaLote).toLocaleDateString('es-MX') : '-'}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">
                                                {item.cantidadMerma.toFixed(2)} kg
                                            </td>
                                            <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(item.costoTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td colSpan={3} className="py-3 px-2 text-sm font-bold text-gray-900 text-right">
                                            Total:
                                        </td>
                                        <td className="py-3 px-2 text-sm font-bold text-red-600 text-right">
                                            {formatCurrency(totalCosto)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
