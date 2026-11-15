'use client';

import { useData } from '@/contexts/DataContext';
import { formatCurrency, safeIsWithinInterval } from '@/lib/utils';
import { Package, Users } from 'lucide-react';
import { useDateFilter } from '@/contexts/DateFilterContext';

export default function ProfitabilityPage() {
    const { products, sales, clients } = useData();
    const { startDate, endDate } = useDateFilter();

    // Filter sales by date range (with null check for createdAt)
    const filteredSales = sales.filter(sale =>
        sale.status === 'completed' &&
        safeIsWithinInterval(sale.createdAt, { start: startDate, end: endDate })
    );

    // --- Rentabilidad por Producto ---
    const productProfitability = products.map(product => {
        // Encontrar todas las ventas de este producto
        const productSales = filteredSales.filter(sale =>
            sale.products.some(p => p.productId === product.id)
        );

        let revenue = 0;
        let quantitySold = 0;

        productSales.forEach(sale => {
            const item = sale.products.find(p => p.productId === product.id);
            if (item) {
                revenue += item.subtotal;
                quantitySold += item.quantity;
            }
        });

        const cost = product.cost * quantitySold;
        const grossProfit = revenue - cost;
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
            ...product,
            revenue,
            cost,
            grossProfit,
            grossMargin
        };
    }).filter(p => p.revenue > 0) // Mostrar solo productos con ventas
        .sort((a, b) => b.grossProfit - a.grossProfit); // Ordenar por mayor ganancia

    // --- Valor de Cliente ---
    const clientValue = clients.map(client => {
        const clientSales = filteredSales.filter(s => s.clientId === client.id);

        const totalPurchases = clientSales.length;
        const totalRevenue = clientSales.reduce((sum, s) => sum + s.total, 0);

        // Calcular costo de mercancía para este cliente
        const totalCost = clientSales.reduce((sum, sale) => {
            const saleCost = sale.products.reduce((pSum, p) => {
                const product = products.find(pr => pr.id === p.productId);
                return pSum + (product?.cost || 0) * p.quantity;
            }, 0);
            return sum + saleCost;
        }, 0);

        const grossProfit = totalRevenue - totalCost;

        return {
            ...client,
            totalPurchases,
            totalRevenue,
            totalCost,
            grossProfit
        };
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Análisis de Rentabilidad</h1>
                </div>
            </div>

            {/* Rentabilidad por Producto */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8 shadow-sm">
                <div className="flex items-start gap-3 mb-6">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Package className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Rentabilidad por Producto</h2>
                        <p className="text-sm text-gray-500">Analiza qué productos te están generando mayores ganancias directas (Ingresos - Costo de la Mercancía).</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Producto</th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Ingresos</th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Costo (CMV)</th>
                                <th className="text-right text-xs font-medium text-teal-600 uppercase tracking-wider py-3 px-4">Ganancia Bruta</th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Margen Bruto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {productProfitability.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                                        No hay datos de ventas para mostrar rentabilidad.
                                    </td>
                                </tr>
                            ) : (
                                productProfitability.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition">
                                        <td className="py-4 px-4 text-sm font-medium text-gray-900">{item.name}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-right">{formatCurrency(item.revenue)}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-right">{formatCurrency(item.cost)}</td>
                                        <td className="py-4 px-4 text-sm font-bold text-teal-600 text-right">{formatCurrency(item.grossProfit)}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-right">{item.grossMargin.toFixed(1)}%</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Valor de Cliente */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-6">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Valor de Cliente</h2>
                        <p className="text-sm text-gray-500">Identifica a tus clientes más valiosos basados en la ganancia directa que generan.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Cliente</th>
                                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4"># de Compras</th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Ingresos Totales</th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Costo Mercancía</th>
                                <th className="text-right text-xs font-medium text-teal-600 uppercase tracking-wider py-3 px-4">Ganancia Bruta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {clientValue.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                                        No hay datos de clientes para mostrar.
                                    </td>
                                </tr>
                            ) : (
                                clientValue.map((client) => (
                                    <tr key={client.id} className="hover:bg-gray-50 transition">
                                        <td className="py-4 px-4 text-sm font-medium text-gray-900">{client.name}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-center">{client.totalPurchases}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-right">{formatCurrency(client.totalRevenue)}</td>
                                        <td className="py-4 px-4 text-sm text-gray-600 text-right">{formatCurrency(client.totalCost)}</td>
                                        <td className="py-4 px-4 text-sm font-bold text-teal-600 text-right">{formatCurrency(client.grossProfit)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
