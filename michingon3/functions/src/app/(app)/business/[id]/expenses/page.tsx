'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Upload, Camera, Calendar, DollarSign, FileText, Repeat } from 'lucide-react';

export default function ExpensesPage() {
    const { expenses, addExpense } = useData();
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        iva: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        recurring: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.description || !formData.amount || !formData.category) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }

        try {
            await addExpense({
                description: formData.description,
                amount: Number(formData.amount),
                iva: formData.iva ? Number(formData.iva) : 0,
                category: formData.category,
                date: new Date(formData.date)
            });

            // Reset form
            setFormData({
                description: '',
                amount: '',
                iva: '',
                category: '',
                date: new Date().toISOString().split('T')[0],
                recurring: false
            });

            alert('Gasto registrado exitosamente');
        } catch (error) {
            console.error('Error al registrar gasto:', error);
            alert('Error al registrar el gasto');
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    Editar Más
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel: Register New Expense */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Registrar Nuevo Gasto</h2>
                    <p className="text-sm text-gray-500 mb-6">Añade un nuevo gasto o pago.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Gasto</label>
                            <input
                                type="text"
                                placeholder="Ej: Renta del local"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Gasto</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0"
                                        className="w-full pl-10 pr-4 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IVA del Gasto</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0"
                                        className="w-full pl-10 pr-4 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        value={formData.iva}
                                        onChange={(e) => setFormData({ ...formData, iva: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                            <input
                                type="text"
                                placeholder="Ej: Servicios"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>

                        <div>
                            <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Gasto</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    id="expense-date"
                                    type="date"
                                    className="w-full pl-10 pr-4 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                            <div className="flex flex-col items-center gap-3">
                                <FileText className="w-8 h-8 text-gray-400" />
                                <p className="text-sm text-gray-500">Es un gasto sin factura.</p>
                                <div className="flex gap-3">
                                    <button type="button" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                        <Upload className="w-4 h-4" />
                                        Subir Imagen
                                    </button>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                                        <Camera className="w-4 h-4" />
                                        Tomar Foto
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    console.log("File captured:", e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                            <input
                                type="checkbox"
                                id="recurring"
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                checked={formData.recurring}
                                onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                            />
                            <label htmlFor="recurring" className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Repeat className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-900">Gastos Recurrente</span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Registra este gasto en el calendario para que se repita cada mes, cada semana, etc.</p>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition"
                        >
                            Registrar Gasto
                        </button>
                    </form>
                </div>

                {/* Right Panel: Expense History */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Historial de Gastos</h2>
                    <p className="text-sm text-gray-500 mb-6">Aquí puedes ver y gestionar todos los gastos registrados.</p>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Descripción</th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Monto</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">IVA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                                            No hay gastos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.slice().reverse().map((expense) => (
                                        <tr key={expense.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-2">
                                                <div className="text-sm font-medium text-gray-900">{expense.description}</div>
                                                <div className="text-xs text-gray-500">{expense.category}</div>
                                            </td>
                                            <td className="py-3 px-2 text-sm text-gray-600">{formatDate(expense.date)}</td>
                                            <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(expense.amount)}</td>
                                            <td className="py-3 px-2 text-sm text-gray-600 text-right">-</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
