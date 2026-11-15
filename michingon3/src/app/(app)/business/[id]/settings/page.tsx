'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Camera, Upload, Trash2, Building, Plug, Calculator, FileUp } from 'lucide-react';
import Image from 'next/image';
import ApiIntegrations from '@/components/settings/api-integrations';
import CostingSettings from '@/components/settings/costing-settings';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

// Tab types
type SettingsTab = 'business' | 'integrations' | 'costing' | 'import';

export default function SettingsPage() {
    const params = useParams();
    const businessId = params.id as string;
    const [activeTab, setActiveTab] = useState<SettingsTab>('business');
    const [businessData, setBusinessData] = useState({
        name: '',
        description: '',
        promotion: '',
        rfc: '',
        clabe: '',
        fiscalAddress: '',
        imageUrl: ''
    });

    const [savedMessage, setSavedMessage] = useState(false);

    const handleSave = () => {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 3000);
    };

    const handleChange = (field: string, value: string) => {
        setBusinessData({ ...businessData, [field]: value });
    };

    const tabs = [
        { id: 'business' as SettingsTab, name: 'Mi Negocio', emoji: '🏪', icon: Building },
        { id: 'integrations' as SettingsTab, name: 'Integraciones', emoji: '🔌', icon: Plug },
        { id: 'costing' as SettingsTab, name: 'Costos Fijos', emoji: '🧮', icon: Calculator },
        { id: 'import' as SettingsTab, name: 'Importar Datos', emoji: '📤', icon: FileUp },
    ];

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">⚙️ Configuración</h1>
            <p className="text-gray-500 mb-6">Personaliza tu negocio y conecta servicios externos</p>

            {savedMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    ✓ Cambios guardados exitosamente
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto pb-px">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                            ? 'text-teal-600 border-teal-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <span className="text-lg">{tab.emoji}</span>
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'business' && (
                <BusinessTab
                    businessId={businessId}
                    businessData={businessData}
                    handleChange={handleChange}
                    handleSave={handleSave}
                />
            )}

            {activeTab === 'integrations' && (
                <ApiIntegrations
                    businessId="demo"
                    onSave={(keys) => console.log('API keys saved:', keys)}
                />
            )}

            {activeTab === 'costing' && (
                <CostingSettings
                    businessId="demo"
                    onSave={(config) => console.log('Costing config saved:', config)}
                />
            )}

            {activeTab === 'import' && (
                <ImportTab />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS TAB (Original settings content)
// ═══════════════════════════════════════════════════════════════

interface BusinessTabProps {
    businessId: string;
    businessData: {
        name: string;
        description: string;
        promotion: string;
        rfc: string;
        clabe: string;
        fiscalAddress: string;
        imageUrl: string;
    };
    handleChange: (field: string, value: string) => void;
    handleSave: () => void;
}

function BusinessTab({ businessId, businessData, handleChange, handleSave }: BusinessTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
                {/* Business Image */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="relative group">
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                            {businessData.imageUrl ? (
                                <Image
                                    src={businessData.imageUrl}
                                    alt="Business"
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <Camera className="w-12 h-12" />
                                </div>
                            )}

                            <button
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
                                aria-label="Eliminar imagen"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Subir Imagen
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            const url = URL.createObjectURL(e.target.files[0]);
                                            handleChange('imageUrl', url);
                                        }
                                    }}
                                />
                            </label>
                            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium cursor-pointer">
                                <Camera className="w-4 h-4" />
                                Tomar Foto
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            const url = URL.createObjectURL(e.target.files[0]);
                                            handleChange('imageUrl', url);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Business Info */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre del Negocio
                        </label>
                        <input
                            type="text"
                            value={businessData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Descripción Corta
                        </label>
                        <textarea
                            value={businessData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={3}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                        />
                    </div>
                </div>

                {/* Fiscal and Banking Data */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Datos Fiscales y Bancarios</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Esta información se usará para la facturación y los reportes.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">RFC</label>
                            <input
                                type="text"
                                value={businessData.rfc}
                                onChange={(e) => handleChange('rfc', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta CLABE</label>
                            <input
                                type="text"
                                value={businessData.clabe}
                                onChange={(e) => handleChange('clabe', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dirección Fiscal</label>
                            <input
                                type="text"
                                value={businessData.fiscalAddress}
                                onChange={(e) => handleChange('fiscalAddress', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-base font-medium"
                >
                    Guardar Cambios
                </button>

                {/* Reset Tutorial Button */}
                <button
                    onClick={async () => {
                        try {
                            await updateDoc(doc(db, 'businesses', businessId), {
                                tutorialCompleted: false
                            });
                            window.location.reload();
                        } catch (err) {
                            console.error('Error resetting tutorial:', err);
                            alert('Error al reiniciar el tutorial');
                        }
                    }}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-base font-medium border border-gray-200 flex items-center justify-center gap-2"
                >
                    <span>🎓</span>
                    Reiniciar Tutorial
                </button>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                {/* Promotions */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Promociones y Ofertas</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Escribe aquí las ofertas que quieres que tus clientes vean.
                    </p>

                    <textarea
                        value={businessData.promotion}
                        onChange={(e) => handleChange('promotion', e.target.value)}
                        rows={4}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
                        placeholder="Ej: Martes de la Milanesa: 2kg de carne molida especial por $700. ¡Aprovecha!"
                    />
                </div>

                {/* Share Business */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Comparte tu Negocio</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Tus clientes pueden escanear este código QR para registrar tus datos fiscales.
                    </p>

                    <div className="flex flex-col items-center">
                        <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg p-3 mb-4">
                            <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                QR Code
                            </div>
                        </div>

                        <p className="text-center font-bold text-gray-900">{businessData.name}</p>
                        <p className="text-center text-sm text-gray-500">{businessData.rfc}</p>

                        <button className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium">
                            Descargar QR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// IMPORT TAB
// ═══════════════════════════════════════════════════════════════

function ImportTab() {
    const [files, setFiles] = useState<File[]>([]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles(prev => [...prev, ...droppedFiles]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900">📤 Importar Datos</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Sube archivos Excel, PDF o CSV con tus datos y los organizamos automáticamente
                </p>
            </div>

            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-teal-400 transition-colors cursor-pointer bg-gray-50"
            >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2 text-lg">
                    Suelta tus archivos aquí
                </p>
                <p className="text-sm text-gray-400 mb-6">
                    Excel (.xlsx), PDF, CSV o imágenes
                </p>
                <label className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg cursor-pointer transition">
                    Seleccionar archivos
                    <input
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </label>
            </div>

            {files.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Archivos seleccionados ({files.length})</h3>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">
                                        {file.type.includes('pdf') ? '📄' :
                                            file.type.includes('image') ? '🖼️' : '📊'}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                >
                                    Quitar
                                </button>
                            </div>
                        ))}
                    </div>

                    <button className="mt-6 w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium">
                        🧠 Procesar con IA
                    </button>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">💡 ¿Qué datos puedo importar?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Listas de clientes (nombre, teléfono, email)</li>
                    <li>Catálogo de proveedores</li>
                    <li>Inventario de productos</li>
                    <li>Facturas de servicios (luz, gas, agua) para calcular costos</li>
                </ul>
            </div>
        </div>
    );
}
