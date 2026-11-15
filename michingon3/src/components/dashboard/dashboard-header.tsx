'use client';

import { useData } from '@/contexts/DataContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { CalendarWidget } from './calendar-widget';
import { DollarSign, TrendingUp, Bell, AlertTriangle } from 'lucide-react';
import { MaoAssistant } from './mao-assistant';
import { formatCurrency, safeIsWithinInterval } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function DashboardHeader() {
    const { sales, expenses, products, orders } = useData();
    const { startDate, endDate } = useDateFilter();

    // Safe arrays to handle undefined during loading
    const safeSales = sales || [];
    const safeExpenses = expenses || [];
    const safeProducts = products || [];
    const safeOrders = orders || [];

    // --- Metrics Calculations ---

    // 1. Revenue (Ventas)
    const filteredSales = safeSales.filter(s =>
        s.status === 'completed' &&
        safeIsWithinInterval(s.createdAt, { start: startDate, end: endDate })
    );
    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);

    // 2. Net Profit (Utilidad)
    const filteredExpenses = safeExpenses.filter(e =>
        safeIsWithinInterval(e.createdAt, { start: startDate, end: endDate })
    );

    const costOfGoods = filteredSales.reduce((sum, sale) => {
        const saleCost = (sale.products || []).reduce((pSum, p) => {
            const product = safeProducts.find(pr => pr.id === p.productId);
            return pSum + (product?.cost || 0) * p.quantity;
        }, 0);
        return sum + saleCost;
    }, 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - costOfGoods - totalExpenses;

    // 3. Pending Orders (Pedidos Pendientes)
    // Note: Pending orders are usually "current" regardless of date filter, 
    // but user might want to see pending orders created in that period. 
    // For "Action Items", showing ALL pending is usually more useful. 
    // Let's show ALL pending orders to ensure nothing is missed.
    const pendingOrders = safeOrders.filter(o => o.status === 'pending').length;

    // 4. Low Stock (Alerta de Stock)
    // Always current state, independent of date filter.
    const lowStockCount = safeProducts.filter(p => p.stock < 10).length;


    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            {/* Left: Date Picker */}
            <div className="flex-shrink-0">
                <CalendarWidget />
            </div>

            {/* Right: Metrics Bar & Mao */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-start md:justify-end">

                {/* Scrollable Metrics Container */}
                <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {/* Revenue */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help min-w-max">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <DollarSign className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Ventas</span>
                                        <span className="text-lg font-bold text-gray-900 leading-none">{formatCurrency(revenue)}</span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ingresos totales en el periodo seleccionado</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Net Profit */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help min-w-max">
                                    <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <TrendingUp className={`w-5 h-5 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Utilidad</span>
                                        <span className={`text-lg font-bold leading-none ${netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                            {formatCurrency(netProfit)}
                                        </span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ganancia neta (Ventas - Costos - Gastos)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Separator */}
                    <div className="h-8 w-px bg-gray-200 hidden md:block flex-shrink-0"></div>

                    {/* Pending Orders */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help min-w-max">
                                    <div className="relative">
                                        <Bell className={`w-5 h-5 ${pendingOrders > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                                        {pendingOrders > 0 && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Pedidos</span>
                                        <span className={`text-lg font-bold leading-none ${pendingOrders > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                                            {pendingOrders}
                                        </span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{pendingOrders} pedidos pendientes de procesar</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Low Stock */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help min-w-max">
                                    <div className="relative">
                                        <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Stock Bajo</span>
                                        <span className={`text-lg font-bold leading-none ${lowStockCount > 0 ? 'text-yellow-600' : 'text-gray-700'}`}>
                                            {lowStockCount}
                                        </span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{lowStockCount} productos con inventario bajo (&lt;10)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Mao Assistant (Fixed) */}
                <div className="flex-shrink-0 ml-2 border-l border-gray-200 pl-4">
                    <MaoAssistant />
                </div>
            </div>
        </div>
    );
}
