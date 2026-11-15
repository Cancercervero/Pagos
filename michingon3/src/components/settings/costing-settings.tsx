'use client';

import { useState, useEffect } from 'react';
import { Save, Calculator, AlertCircle } from 'lucide-react';
import type { CostingConfig } from '@/types/recipes';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CostingSettingsProps {
    businessId: string;
    initialConfig?: Partial<CostingConfig>;
    onSave: (config: CostingConfig) => void;
}

const DEFAULT_CONFIG: CostingConfig = {
    businessId: '',
    fixedCosts: {
        rent: 0,
        electricity: 0,
        gas: 0,
        water: 0,
        internet: 0,
        insurance: 0,
        other: 0
    },
    labor: {
        averageHourlyRate: 50,
        workDaysPerMonth: 26,
        hoursPerDay: 8
    },
    storage: {
        dailyCostPerUnit: 0.5,
        averageStorageDays: 2
    },
    production: {
        unitsPerMonth: 1000
    },
    updatedAt: new Date()
};

// ═══════════════════════════════════════════════════════════════
// COSTING SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════

export function CostingSettings({ businessId, initialConfig, onSave }: CostingSettingsProps) {
    const [config, setConfig] = useState<CostingConfig>({
        ...DEFAULT_CONFIG,
        ...initialConfig,
        businessId
    });
    const [saved, setSaved] = useState(false);

    // Calculate derived values
    const totalFixedCosts = Object.values(config.fixedCosts).reduce((a, b) => a + b, 0);
    const fixedCostPerUnit = config.production.unitsPerMonth > 0
        ? totalFixedCosts / config.production.unitsPerMonth
        : 0;
    const monthlyLaborHours = config.labor.workDaysPerMonth * config.labor.hoursPerDay;
    const monthlyLaborCost = monthlyLaborHours * config.labor.averageHourlyRate;

    const updateFixedCost = (key: keyof CostingConfig['fixedCosts'], value: number) => {
        setConfig(prev => ({
            ...prev,
            fixedCosts: { ...prev.fixedCosts, [key]: value }
        }));
    };

    const updateLabor = (key: keyof CostingConfig['labor'], value: number) => {
        setConfig(prev => ({
            ...prev,
            labor: { ...prev.labor, [key]: value }
        }));
    };

    const updateStorage = (key: keyof CostingConfig['storage'], value: number) => {
        setConfig(prev => ({
            ...prev,
            storage: { ...prev.storage, [key]: value }
        }));
    };

    const updateProduction = (unitsPerMonth: number) => {
        setConfig(prev => ({
            ...prev,
            production: { ...prev.production, unitsPerMonth }
        }));
    };

    const handleSave = () => {
        onSave({ ...config, updatedAt: new Date() });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">🧮 Configuración de Costos</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Estos valores se usan para calcular el costo real de tus productos
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition"
                >
                    <Save className="w-4 h-4" />
                    {saved ? 'Guardado ✓' : 'Guardar'}
                </button>
            </div>

            {/* Fixed Costs */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    🏢 Costos Fijos Mensuales (Infraestructura)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { key: 'rent', label: '🏠 Renta', placeholder: '8000' },
                        { key: 'electricity', label: '💡 Luz', placeholder: '2500' },
                        { key: 'gas', label: '🔥 Gas', placeholder: '1500' },
                        { key: 'water', label: '💧 Agua', placeholder: '500' },
                        { key: 'internet', label: '📶 Internet', placeholder: '600' },
                        { key: 'insurance', label: '🛡️ Seguros', placeholder: '0' },
                        { key: 'other', label: '📦 Otros', placeholder: '0' }
                    ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                {label}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    value={config.fixedCosts[key as keyof CostingConfig['fixedCosts']] || ''}
                                    onChange={(e) => updateFixedCost(
                                        key as keyof CostingConfig['fixedCosts'],
                                        parseFloat(e.target.value) || 0
                                    )}
                                    placeholder={placeholder}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 p-3 bg-teal-50 rounded-lg flex items-center justify-between">
                    <span className="text-teal-700 font-medium">Total Costos Fijos:</span>
                    <span className="text-xl font-bold text-teal-700">
                        ${totalFixedCosts.toLocaleString('es-MX')} / mes
                    </span>
                </div>
            </section>

            {/* Labor */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    👷 Mano de Obra
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Tarifa promedio/hora
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            <input
                                type="number"
                                value={config.labor.averageHourlyRate || ''}
                                onChange={(e) => updateLabor('averageHourlyRate', parseFloat(e.target.value) || 0)}
                                placeholder="50"
                                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Días laborales/mes
                        </label>
                        <input
                            type="number"
                            value={config.labor.workDaysPerMonth || ''}
                            onChange={(e) => updateLabor('workDaysPerMonth', parseInt(e.target.value) || 0)}
                            placeholder="26"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Horas/día
                        </label>
                        <input
                            type="number"
                            value={config.labor.hoursPerDay || ''}
                            onChange={(e) => updateLabor('hoursPerDay', parseInt(e.target.value) || 0)}
                            placeholder="8"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                        />
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                    <span className="text-blue-700 font-medium">Costo de Mano de Obra:</span>
                    <span className="text-lg font-bold text-blue-700">
                        ${monthlyLaborCost.toLocaleString('es-MX')} / mes ({monthlyLaborHours} hrs)
                    </span>
                </div>
            </section>

            {/* Storage */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    📦 Almacenaje
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Costo diario por insumo
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            <input
                                type="number"
                                step="0.1"
                                value={config.storage.dailyCostPerUnit || ''}
                                onChange={(e) => updateStorage('dailyCostPerUnit', parseFloat(e.target.value) || 0)}
                                placeholder="0.5"
                                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Días promedio en almacén
                        </label>
                        <input
                            type="number"
                            value={config.storage.averageStorageDays || ''}
                            onChange={(e) => updateStorage('averageStorageDays', parseInt(e.target.value) || 0)}
                            placeholder="2"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                        />
                    </div>
                </div>
            </section>

            {/* Production */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    📊 Producción Estimada
                </h3>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                        Unidades producidas al mes
                    </label>
                    <input
                        type="number"
                        value={config.production.unitsPerMonth || ''}
                        onChange={(e) => updateProduction(parseInt(e.target.value) || 0)}
                        placeholder="1000"
                        className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                        Ej: tacos vendidos, servicios realizados, productos fabricados
                    </p>
                </div>
            </section>

            {/* Result */}
            <section className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Calculator className="w-8 h-8" />
                    <h3 className="font-bold text-xl">Resultado del Cálculo</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white/20 rounded-lg p-4">
                        <p className="text-emerald-100 text-sm mb-1">Costo fijo por unidad:</p>
                        <p className="text-3xl font-bold">${fixedCostPerUnit.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/20 rounded-lg p-4">
                        <p className="text-emerald-100 text-sm mb-1">Gasto total mensual:</p>
                        <p className="text-3xl font-bold">
                            ${(totalFixedCosts + monthlyLaborCost).toLocaleString('es-MX')}
                        </p>
                    </div>
                </div>

                <p className="text-emerald-100 text-sm mt-4">
                    💡 Este costo fijo de <strong>${fixedCostPerUnit.toFixed(2)}</strong> se agregará
                    automáticamente a cada producto/servicio que costees.
                </p>
            </section>

            {/* Tip about invoices */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">💡 Tip: Usa tus facturas</p>
                    <p>
                        Si importas las facturas de luz, gas y agua, estos valores se actualizarán
                        automáticamente con los montos reales de tus recibos.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default CostingSettings;
