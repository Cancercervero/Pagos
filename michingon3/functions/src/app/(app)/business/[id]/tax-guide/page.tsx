'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

export default function TaxGuidePage() {
    const [savedMessage, setSavedMessage] = useState(false);

    const taxRates = [
        { range: '$0 hasta $0', rate: '1%' },
        { range: '$0.01 hasta $300,000', rate: '1.1%' },
        { range: '$300,000.01 hasta $', rate: '1.5%' },
        { range: '$500,000.01 hasta $', rate: '2.5%' },
        { range: '$3,500,000.01 en adelante', rate: '2.5%' }
    ];

    const handleSave = () => {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 3000);
    };

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Guía de Impuestos</h1>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                >
                    Guardar Tasas
                </button>
            </div>

            {savedMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    ✓ Tasas guardadas exitosamente
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-8">
                {/* RESICO Section */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Entendiendo los Impuestos en México</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Aquí tienes una guía rápida sobre los impuestos más comunes en México, especialmente si estás en el Régimen Simplificado de Confianza (RESICO).
                    </p>

                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">¿Qué es el RESICO?</h3>
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                            El <strong>Régimen Simplificado de Confianza (RESICO)</strong> es un régimen fiscal del SAT para pequeños contribuyentes en México.
                            El objetivo es simplificar las obligaciones fiscales de las personas físicas con ingresos menores a $3.5 millones de pesos anuales.
                        </p>
                        <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                            <p className="text-sm text-teal-900">
                                <strong>💡 Ventaja principal:</strong> Pagas impuestos de forma mensual con tasas más bajas y tienes menos obligaciones contables.
                            </p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">Tasas de ISR Mensual en RESICO</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            El Impuesto Sobre la Renta (ISR) en el RESICO se calcula mensualmente sobre tus ingresos:
                        </p>

                        <div className="overflow-x-auto">
                            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left text-sm font-semibold text-gray-700 py-3 px-4 border-b border-gray-200">
                                            Ingresos Mensuales (Rango)
                                        </th>
                                        <th className="text-right text-sm font-semibold text-gray-700 py-3 px-4 border-b border-gray-200">
                                            Tasa de ISR (%)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {taxRates.map((rate, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="text-sm text-gray-900 py-3 px-4">{rate.range}</td>
                                            <td className="text-sm font-medium text-gray-900 py-3 px-4 text-right">{rate.rate}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* IVA Section */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">2. Impuesto al Valor Agregado (IVA)</h2>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">
                        El <strong>IVA</strong> es un impuesto que se cobra sobre el valor agregado en cada etapa de la cadena de producción y distribución.
                        En México, la tasa general es del <strong>16%</strong>, aunque en zonas fronterizas es del 8%.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-xs text-blue-600 font-medium mb-1">IVA en Ventas</p>
                            <p className="text-2xl font-bold text-blue-700">16%</p>
                            <p className="text-xs text-blue-600 mt-1">Tasa general en México</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-xs text-green-600 font-medium mb-1">IVA en Zona Fronteriza</p>
                            <p className="text-2xl font-bold text-green-700">8%</p>
                            <p className="text-xs text-green-600 mt-1">Tasa reducida</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-xs text-purple-600 font-medium mb-1">IVA en Alimentos</p>
                            <p className="text-2xl font-bold text-purple-700">0%</p>
                            <p className="text-xs text-purple-600 mt-1">Tasa exenta (algunos productos)</p>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                        <p className="text-sm text-yellow-900">
                            <strong>⚠️ Importante:</strong> Aunque cobres IVA en tus ventas, puedes deducir el IVA que pagas en tus compras.
                            Solo pagas la diferencia al SAT. Asegúrate de solicitar facturas con IVA desglosado en todas tus compras para poder deducirlo.
                        </p>
                    </div>
                </section>

                {/* Additional Info */}
                <section className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Recursos Adicionales</h3>
                    <div className="space-y-2">
                        <a
                            href="https://www.sat.gob.mx"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-teal-600 hover:text-teal-700 hover:underline"
                        >
                            → Portal del SAT (Servicio de Administración Tributaria)
                        </a>
                        <a
                            href="https://www.sat.gob.mx/consulta/23972/conoce-el-regimen-simplificado-de-confianza"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-teal-600 hover:text-teal-700 hover:underline"
                        >
                            → Más información sobre RESICO
                        </a>
                    </div>
                </section>

                <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 text-center">
                    <p>
                        Esta es una guía informativa general. Para asesoría fiscal personalizada, consulta con un contador certificado.
                        Las tasas y regulaciones pueden cambiar. Verifica siempre la información más reciente en el portal del SAT.
                    </p>
                </div>
            </div>
        </div>
    );
}
