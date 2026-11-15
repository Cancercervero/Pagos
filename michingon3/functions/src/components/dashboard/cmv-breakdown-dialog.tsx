'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Sale, Product } from '@/types/business';

interface CMVBreakdownDialogProps {
    open: boolean;
    onClose: () => void;
    sales: Sale[];
    products: Product[];
}

export function CMVBreakdownDialog({ open, onClose, sales, products }: CMVBreakdownDialogProps) {
    if (!open) return null;

    // Calcular CMV por cada venta completada
    const cmvData = sales
        .filter(s => s.status === 'completed')
        .map(sale => {
            const itemsCost = sale.products.reduce((sum, item) => {
                const product = products.find(p => p.id === item.productId);
                return sum + (product?.cost || 0) * item.quantity;
            }, 0);

            return {
                fecha: sale.createdAt,
                productos: sale.products.length,
                cantidad: sale.products.reduce((sum, p) => sum + p.quantity, 0),
                costoTotal: itemsCost
            };
        });

    const totalCMV = cmvData.reduce((sum, item) => sum + item.costoTotal, 0);

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
                        <h2 className="text-xl font-bold text-gray-900">Costo de Mercancía Vendida (CMV)</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Costo de los productos que fueron vendidos en este período
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
                <div className="p-6 overflow-y-auto max-h[calc(80vh-180px)]">
                    {cmvData.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No hay ventas registradas en este período.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Productos</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Cantidad Total</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Costo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cmvData.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="py-3 px-2 text-sm text-gray-900">
                                                {new Date(item.fecha).toLocaleDateString('es-MX')}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-600 text-right">
                                                {item.productos}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">
                                                {item.cantidad} unidades
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
                                            Total CMV:
                                        </td>
                                        <td className="py-3 px-2 text-sm font-bold text-orange-600 text-right">
                                            {formatCurrency(totalCMV)}
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
