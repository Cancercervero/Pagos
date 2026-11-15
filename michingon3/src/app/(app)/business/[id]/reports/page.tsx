'use client';

import { useData } from '@/contexts/DataContext';
import { formatCurrency, safeIsWithinInterval } from '@/lib/utils';
import { DollarSign, TrendingDown, AlertTriangle, Receipt } from 'lucide-react';
import { useDateFilter } from '@/contexts/DateFilterContext';

export default function ReportsPage() {
    const { products, sales, expenses, kpiMetrics } = useData();
    const { startDate, endDate } = useDateFilter();

    // Filter data by date range
    const filteredSales = sales.filter(s =>
        s.status === 'completed' &&
        safeIsWithinInterval(s.createdAt, { start: startDate, end: endDate })
    );

    const filteredExpenses = expenses.filter(e =>
        safeIsWithinInterval(e.createdAt, { start: startDate, end: endDate })
    );

    // --- Cálculos para Estado de Resultados ---

    // 1. Ingresos Totales (Calculated from filtered sales)
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);

    // 2. Costo de Mercancía Vendida (CMV)
    const cmv = filteredSales.reduce((sum, sale) => {
        const saleCost = sale.products.reduce((pSum, p) => {
            const product = products.find(pr => pr.id === p.productId);
            return pSum + (product?.cost || 0) * p.quantity;
        }, 0);
        return sum + saleCost;
    }, 0);

    // 3. Costo por Merma (Estimado 0 por ahora o lógica personalizada)
    // En un sistema real, esto vendría de un registro de mermas.
    const merma = 0;

    // 4. Ganancia Bruta
    const grossProfit = totalRevenue - cmv - merma;

    // 5. Gastos Operativos
    const operatingExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 6. Utilidad Neta
    const netIncome = grossProfit - operatingExpenses;

    // --- Desglose de Gastos Operativos ---
    const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reportes Financieros</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Estado de Resultados */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Estado de Resultados</h2>
                    <p className="text-sm text-gray-500 mb-6">Un resumen de tus ingresos y gastos para determinar tu ganancia o pérdida en el periodo seleccionado.</p>

                    <div className="space-y-4">
                        {/* Ingresos */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-gray-900">Ingresos Totales</span>
                            </div>
                            <span className="font-bold text-gray-900">{formatCurrency(totalRevenue)}</span>
                        </div>

                        {/* Deducciones */}
                        <div className="pl-4 space-y-2 bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <span className="w-4 text-center">-</span>
                                    <span>Costo de Mercancía Vendida</span>
                                </div>
                                <span className="text-gray-900 font-medium">-{formatCurrency(cmv)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <AlertTriangle className="w-4 h-4 text-gray-400" />
                                    <span>Costo por Merma</span>
                                </div>
                                <span className="text-gray-900 font-medium">-{formatCurrency(merma)}</span>
                            </div>
                        </div>

                        {/* Ganancia Bruta */}
                        <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-900">= Ganancia Bruta</span>
                            </div>
                            <span className="font-bold text-gray-900">{formatCurrency(grossProfit)}</span>
                        </div>

                        {/* Gastos Operativos */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                            <div className="flex items-center gap-3">
                                <Receipt className="w-5 h-5 text-red-500" />
                                <span className="font-semibold text-gray-900">Gastos Operativos</span>
                            </div>
                            <span className="font-bold text-gray-900">-{formatCurrency(operatingExpenses)}</span>
                        </div>

                        {/* Utilidad Neta */}
                        <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg border border-teal-100">
                            <div className="flex items-center gap-3">
                                <div className="p-1 bg-teal-100 rounded">
                                    <DollarSign className="w-5 h-5 text-teal-600" />
                                </div>
                                <span className="font-bold text-teal-900">Utilidad Neta</span>
                            </div>
                            <span className="font-bold text-teal-600 text-xl">{formatCurrency(netIncome)}</span>
                        </div>
                    </div>
                </div>

                {/* Desglose de Gastos Operativos */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm h-fit">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Desglose de Gastos Operativos</h2>
                    <p className="text-sm text-gray-500 mb-6">Detalle de todos los gastos que no son costo de mercancía.</p>

                    <div className="overflow-hidden rounded-lg border border-gray-100">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Categoría</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {Object.entries(expensesByCategory).length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="py-4 px-4 text-center text-sm text-gray-400">
                                            No hay gastos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    Object.entries(expensesByCategory).map(([category, amount]) => (
                                        <tr key={category}>
                                            <td className="py-3 px-4 text-sm text-gray-900">{category}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(amount)}</td>
                                        </tr>
                                    ))
                                )}
                                <tr className="bg-gray-50 font-semibold">
                                    <td className="py-3 px-4 text-sm text-gray-900">Total</td>
                                    <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(operatingExpenses)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
