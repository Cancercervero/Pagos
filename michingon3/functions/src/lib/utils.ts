import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { KPIMetrics, Product, Sale, Expense } from "@/types/business";
import { startOfDay, endOfDay, subDays, format, isWithinInterval } from "date-fns";

// Safe isWithinInterval that handles invalid dates gracefully
export function safeIsWithinInterval(
    date: Date | null | undefined,
    interval: { start: Date; end: Date }
): boolean {
    if (!date) return false;
    try {
        return isWithinInterval(date, interval);
    } catch {
        return false;
    }
}

// Tailwind class merger utility (for ShadCN)
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Currency formatter
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(amount);
}

// Date formatter
export function formatDate(date: Date): string {
    return format(date, 'dd/MM/yyyy');
}

// Calculate KPI Metrics - CORE FUNCTION
export function calculateKpiMetrics(
    sales: Sale[],
    expenses: Expense[],
    products: Product[],
    days: number = 30
): KPIMetrics {
    // Handle undefined/null arrays
    const safeSales = sales || [];
    const safeExpenses = expenses || [];
    const safeProducts = products || [];

    const cutoffDate = subDays(new Date(), days);

    // Filter recent data
    const recentSales = safeSales.filter(s => s.createdAt >= cutoffDate);
    const recentExpenses = safeExpenses.filter(e => e.date >= cutoffDate);

    // Total Revenue
    const totalRevenue = recentSales
        .filter(s => s.status === 'completed')
        .reduce((sum, sale) => sum + sale.total, 0);

    // Total Expenses
    const totalExpenses = recentExpenses
        .reduce((sum, expense) => sum + expense.amount, 0);

    // Net Profit
    const netProfit = totalRevenue - totalExpenses;

    // Profit Margin
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Total Sales Count
    const totalSales = recentSales.filter(s => s.status === 'completed').length;

    // Average Ticket
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Top Products
    const productSales = new Map<string, { name: string; revenue: number; quantity: number }>();

    recentSales
        .filter(s => s.status === 'completed')
        .forEach(sale => {
            (sale.products || []).forEach(item => {
                const existing = productSales.get(item.productId) || {
                    name: item.productName,
                    revenue: 0,
                    quantity: 0
                };
                productSales.set(item.productId, {
                    name: item.productName,
                    revenue: existing.revenue + item.subtotal,
                    quantity: existing.quantity + item.quantity,
                });
            });
        });

    const topProducts = Array.from(productSales.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Revenue by Day (last 7 days)
    const revenueByDay = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayRevenue = safeSales
            .filter(s =>
                s.status === 'completed' &&
                s.createdAt >= dayStart &&
                s.createdAt <= dayEnd
            )
            .reduce((sum, s) => sum + s.total, 0);

        const dayExpenses = safeExpenses
            .filter(e => e.date >= dayStart && e.date <= dayEnd)
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            date: format(date, 'dd/MM'),
            revenue: dayRevenue,
            expenses: dayExpenses,
        };
    });

    // Low Stock Products
    const lowStockProducts = safeProducts.filter(p => p.stock < 10);

    return {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        totalSales,
        averageTicket,
        topProducts,
        revenueByDay,
        lowStockProducts,
    };
}
