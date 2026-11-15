'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/types/business';

interface InventoryBreakdownDialogProps {
    open: boolean;
    onClose: () => void;
    products: Product[];
}

export function InventoryBreakdownDialog({ open, onClose, products }: InventoryBreakdownDialogProps) {
    if (!open) return null;

    const inventoryData = products
        .filter(p => p.stock > 0)
        .map(product => ({
            nombre: product.name,
            stock: product.stock,
            precioUnitario: product.price,
            valorTotal: product.price * product.stock
        }));

    const totalValue = inventoryData.reduce((sum, item) => sum + item.valorTotal, 0);

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
                        <h2 className="text-xl font-bold text-gray-900">Valor del Inventario</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Valor total de los productos en stock
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
                    {inventoryData.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No hay productos en inventario.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Producto</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Stock</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Precio Unitario</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Valor Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {inventoryData.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="py-3 px-2 text-sm text-gray-900">{item.nombre}</td>
                                            <td className="py-3 px-2 text-sm text-gray-600 text-right">
                                                {item.stock} kg
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">
                                                {formatCurrency(item.precioUnitario)}
                                            </td>
                                            <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(item.valorTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td colSpan={3} className="py-3 px-2 text-sm font-bold text-gray-900 text-right">
                                            Valor Total:
                                        </td>
                                        <td className="py-3 px-2 text-sm font-bold text-purple-600 text-right">
                                            {formatCurrency(totalValue)}
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
