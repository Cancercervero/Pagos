'use client';

import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate, safeIsWithinInterval } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useDateFilter } from '@/contexts/DateFilterContext';

export default function CashFlowPage() {
    const { sales, expenses, clients } = useData();
    const { startDate, endDate } = useDateFilter();

    // Filter data by date range
    const filteredSales = sales.filter(s =>
        safeIsWithinInterval(s.createdAt, { start: startDate, end: endDate })
    );

    const filteredExpenses = expenses.filter(e =>
        safeIsWithinInterval(e.createdAt, { start: startDate, end: endDate })
    );

    // --- Cálculos de Flujo de Efectivo ---

    // 1. Entradas de Dinero (Ventas Completadas)
    const income = filteredSales
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + s.total, 0);

    // 2. Salidas de Dinero (Gastos)
    const outflows = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 3. Flujo Neto
    const netCashFlow = income - outflows;

    // --- Cuentas por Cobrar (Ventas Pendientes) ---
    // Note: Accounts receivable might need to be filtered differently (e.g. by due date), 
    // but for now we filter by creation date to match the period view.
    const accountsReceivable = filteredSales
        .filter(s => s.status === 'pending')
        .map(sale => {
            const client = clients.find(c => c.id === sale.clientId);
            return {
                id: sale.id,
                clientName: client?.name || 'Cliente Desconocido',
                dueDate: new Date(sale.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // Mock: vence en 7 días
                amount: sale.total
            };
        });

    const totalReceivable = accountsReceivable.reduce((sum, item) => sum + item.amount, 0);

    // --- Cuentas por Pagar (Mock por ahora ya que Expense no tiene status) ---
    const accountsPayable: Array<{ id: string; provider: string; dueDate: Date; amount: number }> = [];
    const totalPayable = 0;

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Flujo de Efectivo</h1>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Entradas */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Entradas de Dinero</h3>
                        <div className="p-2 bg-green-100 rounded-full">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(income)}</p>
                </div>

                {/* Salidas */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Salidas de Dinero</h3>
                        <div className="p-2 bg-red-100 rounded-full">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(outflows)}</p>
                </div>

                {/* Flujo Neto */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Flujo Neto de Efectivo</h3>
                        <div className="p-2 bg-blue-100 rounded-full">
                            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold ${netCashFlow >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(netCashFlow)}
                    </p>
                </div>
            </div>

            {/* Bottom Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cuentas por Cobrar */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Cuentas por Cobrar (Vencidas)</h2>
                        <p className="text-sm text-gray-500">Facturas emitidas a clientes que ya vencieron y están pendientes de pago.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Cliente</th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Vencimiento</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {accountsReceivable.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-sm text-gray-400">
                                            No hay cuentas por cobrar vencidas.
                                        </td>
                                    </tr>
                                ) : (
                                    accountsReceivable.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-3 text-sm text-gray-900">{item.clientName}</td>
                                            <td className="py-3 text-sm text-red-500">{formatDate(item.dueDate)}</td>
                                            <td className="py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {accountsReceivable.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-semibold">
                                        <td colSpan={2} className="py-3 px-2 text-sm text-gray-900">Total por Cobrar</td>
                                        <td className="py-3 px-2 text-sm text-gray-900 text-right">{formatCurrency(totalReceivable)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        {accountsReceivable.length === 0 && (
                            <div className="mt-4 bg-gray-100 rounded-lg p-3 flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-900">Total por Cobrar</span>
                                <span className="text-sm font-bold text-gray-900">$0.00</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cuentas por Pagar */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Cuentas por Pagar (Vencidas)</h2>
                        <p className="text-sm text-gray-500">Facturas de proveedores que ya vencieron y están pendientes de pago.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Proveedor / Gasto</th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Vencimiento</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {accountsPayable.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-sm text-gray-400">
                                            No hay cuentas por pagar vencidas.
                                        </td>
                                    </tr>
                                ) : (
                                    accountsPayable.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-3 text-sm text-gray-900">{item.provider}</td>
                                            <td className="py-3 text-sm text-red-500">{formatDate(item.dueDate)}</td>
                                            <td className="py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {accountsPayable.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-semibold">
                                        <td colSpan={2} className="py-3 px-2 text-sm text-gray-900">Total por Pagar</td>
                                        <td className="py-3 px-2 text-sm text-gray-900 text-right">{formatCurrency(totalPayable)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        {accountsPayable.length === 0 && (
                            <div className="mt-4 bg-gray-100 rounded-lg p-3 flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-900">Total por Pagar</span>
                                <span className="text-sm font-bold text-gray-900">$0.00</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


