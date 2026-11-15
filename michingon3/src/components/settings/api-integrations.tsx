'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Link2, Unlink, HelpCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ApiIntegration {
    id: string;
    name: string;
    emoji: string;
    description: string;
    apiKey: string;
    isConnected: boolean;
    helpUrl?: string;
}

interface ApiIntegrationsProps {
    businessId: string;
    onSave: (integrations: Record<string, string>) => void;
}

// ═══════════════════════════════════════════════════════════════
// API INTEGRATIONS COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ApiIntegrations({ businessId, onSave }: ApiIntegrationsProps) {
    const [integrations, setIntegrations] = useState<ApiIntegration[]>([
        {
            id: 'whatsapp',
            name: 'WhatsApp Business API',
            emoji: '💬',
            description: 'Envía tickets, recordatorios y mensajes a tus clientes',
            apiKey: '',
            isConnected: false,
            helpUrl: 'https://business.whatsapp.com/products/business-api'
        },
        {
            id: 'email',
            name: 'Email (SendGrid)',
            emoji: '📧',
            description: 'Envía facturas y notificaciones por correo',
            apiKey: '',
            isConnected: false,
            helpUrl: 'https://sendgrid.com/'
        },
        {
            id: 'payments',
            name: 'Pagos (Stripe/Conekta)',
            emoji: '💳',
            description: 'Acepta pagos con tarjeta',
            apiKey: '',
            isConnected: false,
            helpUrl: 'https://conekta.com/'
        },
        {
            id: 'sat',
            name: 'SAT (Facturación)',
            emoji: '🧾',
            description: 'Genera facturas electrónicas automáticamente',
            apiKey: '',
            isConnected: false,
            helpUrl: 'https://www.sat.gob.mx/'
        }
    ]);

    const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
    const [testing, setTesting] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const toggleShowApiKey = (id: string) => {
        setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const updateApiKey = (id: string, value: string) => {
        setIntegrations(prev => prev.map(i =>
            i.id === id ? { ...i, apiKey: value } : i
        ));
    };

    const testConnection = async (id: string) => {
        setTesting(id);
        // Simulate API test
        await new Promise(resolve => setTimeout(resolve, 1500));

        const integration = integrations.find(i => i.id === id);
        const isValid = (integration?.apiKey?.length ?? 0) > 10; // Simple validation

        setIntegrations(prev => prev.map(i =>
            i.id === id ? { ...i, isConnected: isValid } : i
        ));
        setTesting(null);
    };

    const handleSave = () => {
        const apiKeys: Record<string, string> = {};
        integrations.forEach(i => {
            if (i.apiKey) apiKeys[i.id] = i.apiKey;
        });
        onSave(apiKeys);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">🔌 Integraciones / APIs</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Conecta servicios externos para potenciar tu negocio
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition"
                >
                    {saved ? <Check className="w-4 h-4" /> : null}
                    {saved ? 'Guardado' : 'Guardar'}
                </button>
            </div>

            <div className="space-y-4">
                {integrations.map((integration) => (
                    <div
                        key={integration.id}
                        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{integration.emoji}</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                                    <p className="text-sm text-gray-500">{integration.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {integration.isConnected ? (
                                    <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                        <Link2 className="w-4 h-4" />
                                        Conectado
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-sm text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                                        <Unlink className="w-4 h-4" />
                                        No conectado
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                API Key
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showApiKey[integration.id] ? 'text' : 'password'}
                                        value={integration.apiKey}
                                        onChange={(e) => updateApiKey(integration.id, e.target.value)}
                                        placeholder="Pega tu API key aquí"
                                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleShowApiKey(integration.id)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showApiKey[integration.id] ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={() => testConnection(integration.id)}
                                    disabled={!integration.apiKey || testing === integration.id}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 font-medium rounded-lg transition whitespace-nowrap"
                                >
                                    {testing === integration.id ? 'Probando...' : 'Probar'}
                                </button>
                            </div>

                            {integration.helpUrl && (
                                <a
                                    href={integration.helpUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                    ¿Cómo obtener mi API key?
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">💡 Tip:</p>
                    <p>
                        Las API keys se guardan de forma segura y nunca se comparten.
                        Puedes configurarlas cuando las necesites.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ApiIntegrations;
