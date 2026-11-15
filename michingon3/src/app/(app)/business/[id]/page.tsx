'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { formatCurrency, safeIsWithinInterval } from '@/lib/utils';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
    CheckCircle2,
    ShoppingCart,
    Package
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { TransactionsBreakdownDialog } from '@/components/dashboard/transactions-breakdown-dialog';

import { MermaBreakdownDialog } from '@/components/dashboard/merma-breakdown-dialog';
import { CMVBreakdownDialog } from '@/components/dashboard/cmv-breakdown-dialog';
import { InventoryBreakdownDialog } from '@/components/dashboard/inventory-breakdown-dialog';
import { IVABreakdownDialog } from '@/components/dashboard/iva-breakdown-dialog';
import { Sale, Expense } from '@/types/business';
import { isWithinInterval, format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

type DialogConfig = {
    isOpen: boolean;
    title: string;
    transactions: (Sale | Expense)[];
    type: 'income' | 'expense';
};

export default function BusinessDashboard() {
    const { products, sales, expenses, kpiMetrics: globalKpiMetrics } = useData();
    const { startDate, endDate } = useDateFilter();

    const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
        isOpen: false,
        title: '',
        transactions: [],
        type: 'income'
    });

    // Individual dialog states
    const [showMermaDialog, setShowMermaDialog] = useState(false);
    const [showCMVDialog, setShowCMVDialog] = useState(false);
    const [showInventoryDialog, setShowInventoryDialog] = useState(false);
    const [showIVADialog, setShowIVADialog] = useState(false);

    const openDialog = (title: string, transactions: (Sale | Expense)[], type: 'income' | 'expense') => {
        setDialogConfig({ isOpen: true, title, transactions, type });
    };

    const closeDialog = () => {
        setDialogConfig({ ...dialogConfig, isOpen: false });
    };

    // Filter data based on selected date range
    const { filteredSales, filteredExpenses, dashboardMetrics, completedSales } = useMemo(() => {
        // Safe arrays to handle undefined during loading
        const safeSales = sales || [];
        const safeExpenses = expenses || [];
        const safeProducts = products || [];

        const interval = { start: startOfDay(startDate), end: endOfDay(endDate) };

        const fSales = safeSales.filter(s =>
            safeIsWithinInterval(new Date(s.createdAt), interval)
        );

        const fExpenses = safeExpenses.filter(e =>
            safeIsWithinInterval(new Date(e.date), interval)
        );

        const totalRevenue = fSales
            .filter(s => s.status === 'completed')
            .reduce((sum, s) => sum + s.total, 0);

        const totalExpenses = fExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;

        const completedSales = fSales.filter(s => s.status === 'completed');

        // Prepare chart data
        const revenueByDayMap = new Map<string, { date: string; revenue: number; expenses: number }>();

        fSales.forEach(sale => {
            if (sale.status !== 'completed') return;
            const dateKey = format(new Date(sale.createdAt), 'yyyy-MM-dd');
            const current = revenueByDayMap.get(dateKey) || { date: format(new Date(sale.createdAt), 'd MMM', { locale: es }), revenue: 0, expenses: 0 };
            current.revenue += sale.total;
            revenueByDayMap.set(dateKey, current);
        });

        fExpenses.forEach(expense => {
            const dateKey = format(new Date(expense.date), 'yyyy-MM-dd');
            const current = revenueByDayMap.get(dateKey) || { date: format(new Date(expense.date), 'd MMM', { locale: es }), revenue: 0, expenses: 0 };
            current.expenses += expense.amount;
            revenueByDayMap.set(dateKey, current);
        });

        const revenueByDay = Array.from(revenueByDayMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        return {
            filteredSales: fSales,
            filteredExpenses: fExpenses,
            completedSales,
            safeProducts,
            dashboardMetrics: {
                totalRevenue,
                totalExpenses,
                netProfit,
                revenueByDay
            }
        };
    }, [sales, expenses, products, startDate, endDate]);



    // CMV (Costo de Mercancía Vendida) based on filtered sales
    const cmv = completedSales.reduce((sum: number, sale) => {
        const saleCost = (sale.products || []).reduce((pSum: number, p) => {
            const product = (products || []).find((pr: { id: string; cost: number; }) => pr.id === p.productId);
            return pSum + (product?.cost || 0) * p.quantity;
        }, 0);
        return sum + saleCost;
    }, 0);

    // Merma estimada (ejemplo: 5% de los productos) - Esto podría ser estático o basado en registros de merma si existieran
    // Por ahora mantenemos la lógica global pero idealmente debería filtrarse por fecha si hubiera registros de merma
    const merma = (products || []).reduce((sum: number, p) => sum + (p.cost * p.stock * 0.05), 0);

    // IVA a declarar (16% de ingresos filtrados)
    const iva = dashboardMetrics.totalRevenue * 0.16;

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Mi Negocio</h1>
                </div>
            </div>

            {/* KPI Cards - 2 filas de 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Ingresos Totales - Clickable */}
                <KpiCard
                    title="Ingresos Totales (Pagados)"
                    value={formatCurrency(dashboardMetrics.totalRevenue)}
                    icon={<DollarSign className="w-5 h-5" />}
                    onClick={() => openDialog('Ingresos Totales', completedSales, 'income')}
                    className="border-l-4 border-l-blue-500"
                />

                {/* CMV - Clickable */}
                <KpiCard
                    title="Costo de Mercancía Vendida (CMV)"
                    value={formatCurrency(cmv)}
                    icon={<ShoppingCart className="w-5 h-5" />}
                    onClick={() => setShowCMVDialog(true)}
                    className="border-l-4 border-l-orange-500"
                />

                {/* Costo por Merma - Clickable */}
                <KpiCard
                    title="Costo por Merma"
                    value={formatCurrency(merma)}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    onClick={() => setShowMermaDialog(true)}
                    className="border-l-4 border-l-red-500"
                />

                {/* Ganancia Bruta - Non-clickable */}
                <KpiCard
                    title="Ganancia Bruta"
                    value={formatCurrency(dashboardMetrics.totalRevenue - cmv - merma)}
                    icon={<TrendingUp className="w-5 h-5" />}
                    className="border-l-4 border-l-green-500"
                />

                {/* Segunda fila */}
                {/* Gastos Operativos - Clickable */}
                <KpiCard
                    title="Gastos Operativos"
                    value={formatCurrency(dashboardMetrics.totalExpenses)}
                    icon={<TrendingDown className="w-5 h-5" />}
                    onClick={() => openDialog('Gastos Operativos', filteredExpenses, 'expense')}
                    className="border-l-4 border-l-red-500"
                />

                {/* Valor del Inventario - Clickable */}
                <KpiCard
                    title="Valor del Inventario"
                    value={formatCurrency(products.reduce((sum, p) => sum + (p.price * p.stock), 0))}
                    icon={<Package className="w-5 h-5" />}
                    onClick={() => setShowInventoryDialog(true)}
                    className="border-l-4 border-l-purple-500"
                />

                {/* Ganancia Neta - Non-clickable */}
                <KpiCard
                    title="Ganancia Neta"
                    value={formatCurrency(dashboardMetrics.netProfit)}
                    icon={<TrendingUp className="w-5 h-5" />}
                    className="border-l-4 border-l-green-500"
                />

                {/* IVA a Declarar - Clickable */}
                <KpiCard
                    title="IVA a Declarar"
                    value={formatCurrency(iva)}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    onClick={() => setShowIVADialog(true)}
                    className="border-l-4 border-l-yellow-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart - 2/3 width */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolución Financiera</h2>
                    <p className="text-sm text-gray-500 mb-6">Tendencia de tus ingresos, costos y ganancias en el período seleccionado.</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dashboardMetrics.revenueByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Ingresos" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Gastos" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Actividad Reciente - 1/3 width */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
                    <p className="text-sm text-gray-500 mb-4">Últimas 5 transacciones registradas.</p>
                    <div className="space-y-3">
                        {filteredSales.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No hay actividad en este período.</p>
                        ) : (
                            filteredSales.slice(0, 5).map((sale) => (
                                <div key={sale.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="text-xs text-gray-500">
                                        {new Date(sale.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">Venta</p>
                                        <p className="text-xs text-gray-500">{formatCurrency(sale.total)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Alertas de Inventario */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-lg font-semibold text-gray-900">Alertas de Inventario</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Productos con bajo stock e inventario en riesgo por antigüedad</p>
                    {globalKpiMetrics.lowStockProducts.length === 0 ? (
                        <div className="text-center py-6">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <p className="text-green-600 font-medium">¡Todo en orden!</p>
                            <p className="text-sm text-gray-500">Tu inventario está al día y no hay alertas por el momento.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {globalKpiMetrics.lowStockProducts.map(p => (
                                <div key={p.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                                    <p className="text-xs text-gray-500">Stock: {p.stock}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Próximos Pagos Recurrentes */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Próximos Pagos Recurrentes</h2>
                    <p className="text-sm text-gray-500 mb-4">Alertas automáticas para tus gastos fijos que vencen pronto.</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Renta del Local - Octubre 2025</p>
                                <p className="text-xs text-gray-500">Vence el: 1 de diciembre</p>
                            </div>
                            <span className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-full">
                                ¡Vence Hoy!
                            </span>
                        </div>
                    </div>
                </div>

                {/* Análisis Semanal con IA */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Análisis Semanal con IA</h2>
                    <p className="text-sm text-gray-500 mb-4">Obtén un resumen de tus métricas clave de la semana y escúchalo con una voz profesional.</p>
                    <button className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition">
                        Generar Análisis Semanal
                    </button>
                </div>
            </div>

            {/* Transactions Breakdown Dialog */}
            <TransactionsBreakdownDialog
                isOpen={dialogConfig.isOpen}
                onClose={closeDialog}
                title={dialogConfig.title}
                transactions={dialogConfig.transactions}
                type={dialogConfig.type}
            />

            {/* Additional Breakdown Dialogs */}
            <MermaBreakdownDialog
                open={showMermaDialog}
                onClose={() => setShowMermaDialog(false)}
                products={products}
            />

            <CMVBreakdownDialog
                open={showCMVDialog}
                onClose={() => setShowCMVDialog(false)}
                sales={completedSales}
                products={products}
            />

            <InventoryBreakdownDialog
                open={showInventoryDialog}
                onClose={() => setShowInventoryDialog(false)}
                products={products}
            />

            <IVABreakdownDialog
                open={showIVADialog}
                onClose={() => setShowIVADialog(false)}
                sales={completedSales}
            />
        </div>
    );
}
