'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function CreateBusinessPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        businessName: '',
        countryCode: 'MX',
        currencyCode: 'MXN',
        language: 'es',
        businessFamily: '',
        businessType: '',
        rfc: '',
        razonSocial: '',
        direccionFiscal: '',
        satRegime: '',
        whatsappApiKey: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            alert('Debes estar logueado');
            return;
        }

        try {
            setLoading(true);

            // Crear ID único para el negocio
            const businessId = `business_${Date.now()}`;

            // Crear documento del negocio
            await setDoc(doc(db, 'businesses', businessId), {
                name: formData.businessName,
                owner: user.uid,
                owners: [user.uid],
                countryCode: formData.countryCode,
                currencyCode: formData.currencyCode,
                language: formData.language,
                businessFamily: formData.businessFamily,
                businessType: formData.businessType,
                rfc: formData.rfc || null,
                razonSocial: formData.razonSocial || null,
                direccionFiscal: formData.direccionFiscal || null,
                satRegime: formData.satRegime || null,
                whatsappApiKey: formData.whatsappApiKey || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Actualizar usuario: agregar businessId al array de businesses
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                businesses: arrayUnion(businessId),
                currentBusinessId: businessId,
                updatedAt: new Date().toISOString()
            });

            // Redirect al nuevo negocio
            router.push(`/business/${businessId}`);
        } catch (error) {
            console.error('Error creating business:', error);
            alert('Error al crear el negocio. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!user || userProfile?.role !== 'owner') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-slate-700/50">
                    <h2 className="text-2xl font-bold text-white mb-4">Acceso Denegado</h2>
                    <p className="text-slate-300">Solo los owners pueden crear nuevos negocios.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 max-w-2xl w-full border border-slate-700/50 shadow-2xl">
                <h1 className="text-3xl font-bold text-white mb-2">Crear Nuevo Negocio</h1>
                <p className="text-slate-400 mb-8">Configura un nuevo negocio para administrar</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Nombre del Negocio */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Nombre del Negocio *
                        </label>
                        <input
                            type="text"
                            value={formData.businessName}
                            onChange={(e) => updateFormData('businessName', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: Taquería El Güero"
                            required
                        />
                    </div>

                    {/* País y Moneda */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                País *
                            </label>
                            <select
                                value={formData.countryCode}
                                onChange={(e) => updateFormData('countryCode', e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="MX">México</option>
                                <option value="US">Estados Unidos</option>
                                <option value="CA">Canadá</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Moneda *
                            </label>
                            <select
                                value={formData.currencyCode}
                                onChange={(e) => updateFormData('currencyCode', e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="MXN">MXN - Peso Mexicano</option>
                                <option value="USD">USD - Dólar</option>
                                <option value="CAD">CAD - Dólar Canadiense</option>
                            </select>
                        </div>
                    </div>

                    {/* RFC (México) */}
                    {formData.countryCode === 'MX' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    RFC
                                </label>
                                <input
                                    type="text"
                                    value={formData.rfc}
                                    onChange={(e) => updateFormData('rfc', e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="XAXX010101000"
                                    maxLength={13}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Razón Social
                                </label>
                                <input
                                    type="text"
                                    value={formData.razonSocial}
                                    onChange={(e) => updateFormData('razonSocial', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: TACOS EL GÜERO SA DE CV"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Dirección Fiscal
                                </label>
                                <input
                                    type="text"
                                    value={formData.direccionFiscal}
                                    onChange={(e) => updateFormData('direccionFiscal', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Calle, Número, Colonia, CP"
                                />
                            </div>
                        </>
                    )}

                    {/* Botones */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !formData.businessName}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creando...' : 'Crear Negocio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
