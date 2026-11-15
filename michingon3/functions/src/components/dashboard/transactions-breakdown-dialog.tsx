'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { Sale, Expense } from '@/types/business';
import { X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface TransactionsBreakdownDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transactions: (Sale | Expense)[];
    type: 'income' | 'expense';
}

export function TransactionsBreakdownDialog({
    isOpen,
    onClose,
    title,
    transactions,
    type
}: TransactionsBreakdownDialogProps) {
    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <DialogPrimitive.Content className="fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[800px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white p-6 shadow-2xl focus:outline-none z-50 border border-gray-200 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <DialogPrimitive.Title className="text-xl font-bold text-gray-900">
                                {title}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="text-sm text-gray-500">
                                Desglose detallado de las transacciones
                            </DialogPrimitive.Description>
                        </div>
                        <DialogPrimitive.Close asChild>
                            <button className="text-gray-400 hover:text-gray-600 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </DialogPrimitive.Close>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Descripción</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Monto</th>
                                    <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                            No hay transacciones registradas.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 text-gray-600">
                                                {formatDate(t.createdAt || (t as any).date)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 font-medium">
                                                {'description' in t ? t.description : `Venta #${t.id.slice(-4)}`}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {type === 'income' ? '+' : '-'}{formatCurrency('amount' in t ? t.amount : t.total)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                    Completado
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
                            <p className={`text-2xl font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(transactions.reduce((acc, t) => acc + ('amount' in t ? t.amount : t.total), 0))}
                            </p>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
