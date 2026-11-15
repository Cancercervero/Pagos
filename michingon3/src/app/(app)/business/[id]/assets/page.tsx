'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Calendar, DollarSign, TrendingUp, Clock, Plus, Upload, Camera, X } from 'lucide-react';
import Image from 'next/image';

interface Asset {
    id: string;
    name: string;
    description: string;
    purchaseDate: Date;
    purchasePrice: number;
    currentValue: number;
    category: string;
    imageUrl?: string;
    financing?: {
        downPayment: number;
        monthlyPayment: number;
        remainingMonths: number;
    };
    usefulLife?: number;
}

export default function AssetsPage() {
    const { assets, addAsset } = useData();
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: '',
        currentValue: '',
        usefulLife: '',
        downPayment: '',
        monthlyPayment: '',
        calculatedMonthly: false
    });

    const totalInvestment = assets.reduce((sum, asset) => sum + asset.purchasePrice, 0);
    const totalRecovered = assets.reduce((sum, asset) => sum + (asset.purchasePrice - asset.currentValue), 0);
    const recoveryPercentage = totalInvestment > 0 ? (totalRecovered / totalInvestment) * 100 : 0;

    const handleAddAsset = async () => {
        if (!formData.name || !formData.purchasePrice) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        try {
            const purchasePrice = parseFloat(formData.purchasePrice);
            const usefulLife = parseInt(formData.usefulLife) || 5;

            await addAsset({
                name: formData.name,
                description: formData.description,
                purchaseDate: new Date(formData.purchaseDate),
                purchasePrice,
                currentValue: purchasePrice, // Initially same as purchase price
                category: 'Equipo',
                usefulLife,
                financing: formData.calculatedMonthly ? {
                    downPayment: parseFloat(formData.downPayment) || 0,
                    monthlyPayment: parseFloat(formData.monthlyPayment) || 0,
                    remainingMonths: 0
                } : undefined
            });

            setShowModal(false);
            setFormData({
                name: '',
                description: '',
                purchaseDate: new Date().toISOString().split('T')[0],
                purchasePrice: '',
                currentValue: '',
                usefulLife: '',
                downPayment: '',
                monthlyPayment: '',
                calculatedMonthly: false
            });
            alert('¡Activo agregado exitosamente!');
        } catch (error) {
            console.error('Error al agregar activo:', error);
            alert('Error al agregar el activo');
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Activos e Inversión</h1>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    Todo el Tiempo
                </button>
            </div>

            {/* Investment Recovery Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Gestión de Activos</h2>
                        <p className="text-sm text-gray-500">Registra y monitorea el valor de tu equipo, maquinaria y otros bienes.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Activo
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-gray-900">Recuperación de Inversión</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Monitorea cuánto del costo de tus activos ya ha generado valor acumulado.
                    </p>

                    <div className="mb-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">Inversión Total</span>
                            <span className="font-bold text-gray-900">{formatCurrency(totalInvestment)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-3">
                            <span className="font-medium text-gray-700">Progreso Total</span>
                            <span className="font-bold text-gray-900">
                                {formatCurrency(totalRecovered)} / {formatCurrency(totalInvestment)}
                            </span>
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-teal-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(recoveryPercentage, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-right">{recoveryPercentage.toFixed(1)}% completado</p>
                </div>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.map((asset) => (
                    <div key={asset.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
                        <div className="relative h-48 w-full bg-gray-100">
                            {asset.imageUrl ? (
                                <Image
                                    src={asset.imageUrl}
                                    alt={asset.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    Sin Imagen
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            <h3 className="font-bold text-gray-900 mb-1">{asset.name}</h3>
                            <p className="text-xs text-gray-500 mb-4">{asset.description}</p>

                            {asset.financing && (
                                <div className="mb-4 space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <DollarSign className="w-3 h-3" />
                                        <span>Financiamiento</span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        <div className="flex justify-between">
                                            <span>Enganche:</span>
                                            <span className="font-medium">{formatCurrency(asset.financing.downPayment)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Clock className="w-3 h-3" />
                                        <span>Vida útil estimada</span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        <span>en más de {asset.usefulLife} años</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Calendar className="w-3 h-3" />
                                        <span>Comprado el</span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        <span>{formatDate(asset.purchaseDate)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-gray-100 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-500">Valor Actual (Libros)</span>
                                    <span className="text-sm font-bold text-gray-900">{formatCurrency(asset.currentValue)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Costo Original</span>
                                    <span className="text-sm font-medium text-red-600">{formatCurrency(asset.purchasePrice)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Asset Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Añadir Nuevo Activo</h2>
                                <p className="text-sm text-gray-500">Registra tu equipo, vehículos o aplicaciones de software.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Activo</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Molino de Refrigeración"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <textarea
                                    placeholder="Marca, modelo, capacidad, etc."
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent h-20 resize-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        value={formData.purchaseDate}
                                        onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Compra (MXN)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        value={formData.purchasePrice}
                                        onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vida Útil (Años)</label>
                                <input
                                    type="number"
                                    placeholder="5"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.usefulLife}
                                    onChange={(e) => setFormData({ ...formData, usefulLife: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Cuánto tiempo esperas que el activo te sea útil antes de que necesites reemplazarlo.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del Activo (Opcional)</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="text-gray-400">
                                            <Upload className="w-8 h-8 mx-auto mb-2" />
                                            <p className="text-sm">Sin imagen seleccionada</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                                <Upload className="w-4 h-4" />
                                                Subir Imagen
                                            </button>
                                            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                                <Camera className="w-4 h-4" />
                                                Tomar Foto
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="calculatedMonthly"
                                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                    checked={formData.calculatedMonthly}
                                    onChange={(e) => setFormData({ ...formData, calculatedMonthly: e.target.checked })}
                                />
                                <label htmlFor="calculatedMonthly" className="flex-1">
                                    <span className="text-sm font-medium text-gray-900">¿Fue comprado a crédito?</span>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Marca esta casilla si requieres que se calcule las mensualidades del activo.
                                    </p>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddAsset}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
                            >
                                Guardar Activo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
