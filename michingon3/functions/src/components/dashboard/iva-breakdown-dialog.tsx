'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Sale } from '@/types/business';

interface IVABreakdownDialogProps {
    open: boolean;
    onClose: () => void;
    sales: Sale[];
}

export function IVABreakdownDialog({ open, onClose, sales }: IVABreakdownDialogProps) {
    if (!open) return null;

    // Calcular IVA (16%) por cada venta completada
    const ivaData = sales
        .filter(s => s.status === 'completed')
        .map(sale => ({
            fecha: sale.createdAt,
            subtotal: sale.total / 1.16, // Asumiendo que el total incluye IVA
            iva: (sale.total / 1.16) * 0.16,
            total: sale.total
        }));

    const totalIVA = ivaData.reduce((sum, item) => sum + item.iva, 0);

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
                        <h2 className="text-xl font-bold text-gray-900">IVA a Declarar</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Impuesto al Valor Agregado (16%) sobre las ventas realizadas
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
                    {ivaData.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No hay ventas registradas en este período.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Subtotal</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">IVA (16%)</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ivaData.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="py-3 px-2 text-sm text-gray-900">
                                                {new Date(item.fecha).toLocaleDateString('es-MX')}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-600 text-right">
                                                {formatCurrency(item.subtotal)}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">
                                                {formatCurrency(item.iva)}
                                            </td>
                                            <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(item.total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td colSpan={3} className="py-3 px-2 text-sm font-bold text-gray-900 text-right">
                                            Total IVA a Declarar:
                                        </td>
                                        <td className="py-3 px-2 text-sm font-bold text-blue-600 text-right">
                                            {formatCurrency(totalIVA)}
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
