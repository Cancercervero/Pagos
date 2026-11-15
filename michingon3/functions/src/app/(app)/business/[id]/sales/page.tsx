'use client';

import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { NewSaleDialog } from '@/components/sales/new-sale-dialog';


export default function SalesPage() {
    const { sales, kpiMetrics } = useData();
    const [showAddDialog, setShowAddDialog] = useState(false);

    return (
        <div className="p-6 lg:p-8">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Ventas</h1>
                    <p className="text-purple-300">Registro de todas tus ventas</p>
                </div>
                <button
                    onClick={() => setShowAddDialog(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Venta
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-white/60 text-sm font-medium">Total Ventas</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{kpiMetrics.totalSales}</p>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                        <h3 className="text-white/60 text-sm font-medium">Ingresos</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {formatCurrency(kpiMetrics.totalRevenue)}
                    </p>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-white/60 text-sm font-medium">Ticket Promedio</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {formatCurrency(kpiMetrics.averageTicket)}
                    </p>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-pink-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-pink-400" />
                        </div>
                        <h3 className="text-white/60 text-sm font-medium">Utilidad</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {formatCurrency(kpiMetrics.netProfit)}
                    </p>
                </div>
            </div>

            {/* Sales Table */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white mb-6">Historial de Ventas</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-white/60 font-medium py-3 px-4">ID</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Fecha</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Productos</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Cantidad</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Total</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Método</th>
                                <th className="text-left text-white/60 font-medium py-3 px-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((sale) => (
                                <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                    <td className="text-white/80 py-3 px-4 font-mono text-sm">{sale.id}</td>
                                    <td className="text-white/80 py-3 px-4">{formatDate(sale.createdAt)}</td>
                                    <td className="text-white py-3 px-4">
                                        <div className="max-w-xs">
                                            {sale.products.map((p, i) => (
                                                <div key={i} className="text-sm">
                                                    {p.productName} ({p.quantity}x)
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-white/80 py-3 px-4">
                                        {sale.products.reduce((sum, p) => sum + p.quantity, 0)} items
                                    </td>
                                    <td className="text-green-400 font-bold py-3 px-4">
                                        {formatCurrency(sale.total)}
                                    </td>
                                    <td className="text-white/60 py-3 px-4">
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs capitalize">
                                            {sale.paymentMethod === 'cash' ? 'Efectivo' :
                                                sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sale.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                            sale.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                            {sale.status === 'completed' ? 'Completada' :
                                                sale.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Sale Dialog */}
            <NewSaleDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
            />
        </div>
    );
}
