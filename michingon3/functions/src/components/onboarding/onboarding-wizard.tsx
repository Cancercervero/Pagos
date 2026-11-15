'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import {
    BUSINESS_FAMILIES,
    BUSINESS_TYPES,
    SAT_REGIMES,
    BusinessFamily,
    BusinessType,
    SATRegime,
    getBusinessTypesByFamily
} from '@/types/business-types';
import {
    COUNTRIES,
    CURRENCIES,
    LANGUAGES,
    CountryCode,
    getCountriesArray,
    getCurrenciesArray,
    getLanguagesArray,
    SupportedLanguage,
    requiresSATConfig
} from '@/types/localization-types';
import { ChevronLeft, ChevronRight, Upload, Check, Sparkles, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

interface OnboardingData {
    countryCode: CountryCode | null;
    language: SupportedLanguage | null;
    currencyCode: string | null;
    businessName: string;
    businessFamily: BusinessFamily | null;
    businessType: BusinessType | null;
    satRegime: SATRegime | null;
    hasWhatsApp: boolean;
    whatsappApiKey: string;
    hasDataToImport: boolean;
    importedFiles: File[];
}

const INITIAL_DATA: OnboardingData = {
    countryCode: null,
    language: null,
    currencyCode: null,
    businessName: '',
    businessFamily: null,
    businessType: null,
    satRegime: null,
    hasWhatsApp: false,
    whatsappApiKey: '',
    hasDataToImport: false,
    importedFiles: []
};

const TOTAL_STEPS = 10;

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export function OnboardingWizard() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const updateData = (updates: Partial<OnboardingData>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    const nextStep = () => {
        if (step < TOTAL_STEPS) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    // Check if we should skip SAT step (only for Mexico)
    const shouldShowSAT = data.countryCode ? requiresSATConfig(data.countryCode) : false;

    const canProceed = (): boolean => {
        switch (step) {
            case 1: return data.countryCode !== null;
            case 2: return data.language !== null;
            case 3: return data.currencyCode !== null;
            case 4: return data.businessName.trim().length >= 2;
            case 5: return data.businessFamily !== null;
            case 6: return data.businessType !== null;
            case 7: return shouldShowSAT ? data.satRegime !== null : true; // SAT only for Mexico
            case 8: return true; // WhatsApp is optional
            case 9: return true; // Import is optional
            case 10: return true;
            default: return false;
        }
    };

    const handleNextStep = () => {
        // Skip SAT step if country doesn't require it
        if (step === 6 && !shouldShowSAT) {
            setStep(8); // Skip to WhatsApp
        } else {
            nextStep();
        }
    };

    const handlePrevStep = () => {
        // Skip SAT step when going back if country doesn't require it
        if (step === 8 && !shouldShowSAT) {
            setStep(6); // Skip back to business type
        } else {
            prevStep();
        }
    };

    const handleComplete = async () => {
        if (!user) {
            setError('Debes iniciar sesión primero');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const businessId = `business_${user.uid}_${Date.now()}`;

            // Get country info for currency
            const countryInfo = data.countryCode ? COUNTRIES[data.countryCode] : null;

            // Create business document with all onboarding data
            await setDoc(doc(db, 'businesses', businessId), {
                name: data.businessName,
                owner: user.uid,
                // Localization - use user-selected values
                countryCode: data.countryCode,
                currencyCode: data.currencyCode || 'MXN',
                language: data.language || 'es',
                // Business classification
                businessFamily: data.businessFamily,
                businessType: data.businessType,
                // SAT (only for Mexico)
                satRegime: shouldShowSAT ? data.satRegime : null,
                // WhatsApp
                whatsappApiKey: data.whatsappApiKey || null,
                whatsappConnected: data.hasWhatsApp && data.whatsappApiKey.length > 0,
                // Status
                onboardingCompleted: true,
                tutorialCompleted: false,
                costingConfigured: false,
                createdAt: new Date().toISOString(),
            });

            // Update user document
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName || '',
                businessId: businessId,
                createdAt: new Date().toISOString(),
            });

            // Process imported files with AI
            if (data.importedFiles.length > 0) {
                console.log('📁 Processing imported files:', data.importedFiles.length);

                // Store files info in Firebase for later processing
                // (Full AI processing will happen asynchronously)
                for (const file of data.importedFiles) {
                    await addDoc(collection(db, 'businesses', businessId, 'pendingImports'), {
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                    });
                }
                console.log('✅ Files queued for AI processing');
            }

            // Redirect to dashboard (tutorial will start there)
            router.push(`/business/${businessId}`);
        } catch (err) {
            console.error('Error creating business:', err);
            setError('Error al crear el negocio. Intenta de nuevo.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header with progress */}
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-6 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <Sparkles className="w-8 h-8" />
                        <h1 className="text-2xl font-bold">¡Bienvenido a Michingon!</h1>
                    </div>
                    <p className="text-teal-100 text-sm mb-4">
                        Paso {step} de {TOTAL_STEPS}: {getStepTitle(step)}
                    </p>
                    {/* Progress bar */}
                    <div className="w-full bg-teal-400/30 rounded-full h-2">
                        <div
                            className="bg-white rounded-full h-2 transition-all duration-300"
                            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Step content */}
                    {step === 1 && <Step1Country data={data} updateData={updateData} />}
                    {step === 2 && <Step2Language data={data} updateData={updateData} />}
                    {step === 3 && <Step3Currency data={data} updateData={updateData} />}
                    {step === 4 && <Step4Name data={data} updateData={updateData} />}
                    {step === 5 && <Step5Family data={data} updateData={updateData} />}
                    {step === 6 && <Step6Type data={data} updateData={updateData} />}
                    {step === 7 && shouldShowSAT && <Step7SAT data={data} updateData={updateData} />}
                    {step === 7 && !shouldShowSAT && <Step8WhatsApp data={data} updateData={updateData} />}
                    {step === 8 && <Step8WhatsApp data={data} updateData={updateData} />}
                    {step === 9 && <Step9Import data={data} updateData={updateData} />}
                    {step === 10 && <Step10Summary data={data} showSAT={shouldShowSAT} />}

                    {/* Navigation */}
                    <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                        <button
                            onClick={handlePrevStep}
                            disabled={step === 1}
                            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Atrás
                        </button>

                        {step < TOTAL_STEPS ? (
                            <button
                                onClick={handleNextStep}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                            >
                                Siguiente
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                            >
                                {loading ? 'Creando...' : '¡Empezar!'}
                                <Check className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 pb-6">
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${i + 1 === step
                                ? 'bg-teal-500 w-4'
                                : i + 1 < step
                                    ? 'bg-teal-300'
                                    : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════

function getStepTitle(step: number): string {
    const titles: Record<number, string> = {
        1: '¿Dónde opera tu negocio?',
        2: '¿En qué idioma prefieres usar la app?',
        3: '¿Qué moneda usas?',
        4: '¿Cómo se llama tu negocio?',
        5: '¿Qué tipo de negocio tienes?',
        6: '¿Cuál describe mejor tu negocio?',
        7: '¿Estás dado de alta en el SAT?',
        8: '¿Tienes WhatsApp Business?',
        9: '¿Tienes datos que importar?',
        10: '¡Todo listo!'
    };
    return titles[step] || '';
}

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
}

// Step 1: Country Selection (NEW)
function Step1Country({ data, updateData }: StepProps) {
    const countries = getCountriesArray();

    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Selecciona el país donde opera tu negocio. Esto nos ayuda a configurar
                la moneda y los impuestos correctamente.
            </p>
            <div className="grid grid-cols-2 gap-4">
                {countries.map((country) => (
                    <button
                        key={country.code}
                        onClick={() => updateData({ countryCode: country.code })}
                        className={`p-6 rounded-xl border-2 text-center transition-all ${data.countryCode === country.code
                            ? 'border-teal-500 bg-teal-50 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <span className="text-5xl mb-3 block">{country.flag}</span>
                        <h3 className="font-bold text-lg text-gray-900">{country.name}</h3>
                        <p className="text-sm text-gray-500">{country.currencyCode}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 2: Language Selection
function Step2Language({ data, updateData }: StepProps) {
    const languages = getLanguagesArray();

    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Selecciona el idioma en el que prefieres usar Michingon.
            </p>
            <div className="grid grid-cols-2 gap-4">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => updateData({ language: lang.code })}
                        className={`p-6 rounded-xl border-2 text-center transition-all ${data.language === lang.code
                            ? 'border-teal-500 bg-teal-50 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <span className="text-5xl mb-3 block">{lang.code === 'es' ? '🇪🇸' : '🇺🇸'}</span>
                        <h3 className="font-bold text-lg text-gray-900">{lang.nativeName}</h3>
                        <p className="text-sm text-gray-500">{lang.name}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 3: Currency Selection
function Step3Currency({ data, updateData }: StepProps) {
    const currencies = getCurrenciesArray();

    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Selecciona la moneda que usas en tu negocio.
            </p>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {currencies.map((currency) => (
                    <button
                        key={currency.code}
                        onClick={() => updateData({ currencyCode: currency.code })}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${data.currencyCode === currency.code
                            ? 'border-teal-500 bg-teal-50 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <span className="text-3xl mb-2 block">{currency.symbol}</span>
                        <h3 className="font-bold text-gray-900">{currency.code}</h3>
                        <p className="text-xs text-gray-500">{currency.name}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 4: Business Name
function Step4Name({ data, updateData }: StepProps) {
    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Este nombre aparecerá en tu dashboard y en los tickets de venta.
            </p>
            <input
                type="text"
                value={data.businessName}
                onChange={(e) => updateData({ businessName: e.target.value })}
                placeholder="Ej: Carnicería La Superior"
                className="w-full px-4 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 outline-none transition"
                autoFocus
            />
        </div>
    );
}

// Step 5: Business Family

function Step5Family({ data, updateData }: StepProps) {
    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Selecciona la categoría que mejor describe lo que haces.
            </p>
            <div className="grid grid-cols-2 gap-4">
                {Object.values(BUSINESS_FAMILIES).map((family) => (
                    <button
                        key={family.id}
                        onClick={() => updateData({ businessFamily: family.id, businessType: null })}
                        className={`p-6 rounded-xl border-2 text-left transition-all ${data.businessFamily === family.id
                            ? 'border-teal-500 bg-teal-50 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <span className="text-4xl mb-3 block">{family.emoji}</span>
                        <h3 className="font-bold text-lg text-gray-900">{family.name}</h3>
                        <p className="text-sm text-gray-500">{family.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 6: Business Type
function Step6Type({ data, updateData }: StepProps) {
    const types = data.businessFamily
        ? getBusinessTypesByFamily(data.businessFamily)
        : [];

    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Ahora elige el tipo específico de tu negocio.
            </p>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {types.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => updateData({ businessType: type.id })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${data.businessType === type.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <span className="text-2xl mb-2 block">{type.emoji}</span>
                        <h3 className="font-semibold text-sm text-gray-900">{type.name}</h3>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 7: SAT Regime (only for Mexico)
function Step7SAT({ data, updateData }: StepProps) {
    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Esto nos ayuda a calcular mejor tus impuestos y generar reportes fiscales.
            </p>
            <div className="space-y-3">
                {Object.values(SAT_REGIMES).map((regime) => (
                    <button
                        key={regime.id}
                        onClick={() => updateData({ satRegime: regime.id })}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${data.satRegime === regime.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <h3 className="font-semibold text-gray-900">{regime.name}</h3>
                        <p className="text-sm text-gray-500">{regime.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Step 8: WhatsApp
function Step8WhatsApp({ data, updateData }: StepProps) {
    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Conecta WhatsApp para enviar tickets, recordatorios y mensajes a tus clientes.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => updateData({ hasWhatsApp: true })}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${data.hasWhatsApp
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                >
                    <span className="text-3xl mb-2 block">✅</span>
                    <span className="font-semibold">Sí, tengo API key</span>
                </button>
                <button
                    onClick={() => updateData({ hasWhatsApp: false, whatsappApiKey: '' })}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${!data.hasWhatsApp
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                >
                    <span className="text-3xl mb-2 block">⏭️</span>
                    <span className="font-semibold">Lo configuro después</span>
                </button>
            </div>

            {data.hasWhatsApp && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        API Key de WhatsApp Business
                    </label>
                    <input
                        type="password"
                        value={data.whatsappApiKey}
                        onChange={(e) => updateData({ whatsappApiKey: e.target.value })}
                        placeholder="Pega tu API key aquí"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 outline-none"
                    />
                    <p className="text-xs text-gray-500">
                        💡 Puedes configurar esto después en Configuración → Integraciones
                    </p>
                </div>
            )}
        </div>
    );
}

// Step 9: Import Data
function Step9Import({ data, updateData }: StepProps) {
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        updateData({ importedFiles: [...data.importedFiles, ...files], hasDataToImport: true });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            updateData({ importedFiles: [...data.importedFiles, ...files], hasDataToImport: true });
        }
    };

    const removeFile = (index: number) => {
        const newFiles = data.importedFiles.filter((_, i) => i !== index);
        updateData({ importedFiles: newFiles, hasDataToImport: newFiles.length > 0 });
    };

    return (
        <div className="space-y-6">
            <p className="text-gray-600">
                Si ya tienes listas de clientes, proveedores o productos, suéltalas aquí
                y las organizamos por ti.
            </p>

            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
            >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                    Suelta tus archivos aquí
                </p>
                <p className="text-sm text-gray-400 mb-4">
                    Excel, PDF, CSV o imágenes
                </p>
                <label className="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition">
                    O selecciona archivos
                    <input
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </label>
            </div>

            {data.importedFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                        Archivos seleccionados:
                    </p>
                    {data.importedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600 truncate">{file.name}</span>
                            <button
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700 text-sm"
                            >
                                Quitar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={() => updateData({ hasDataToImport: false, importedFiles: [] })}
                className="text-sm text-gray-500 hover:text-gray-700"
            >
                ⏭️ Saltar este paso
            </button>
        </div>
    );
}

// Step 10: Summary
function Step10Summary({ data, showSAT }: { data: OnboardingData; showSAT: boolean }) {
    const countryInfo = data.countryCode ? COUNTRIES[data.countryCode] : null;
    const currencyInfo = data.currencyCode ? CURRENCIES[data.currencyCode] : null;
    const languageInfo = data.language ? LANGUAGES[data.language] : null;
    const familyInfo = data.businessFamily ? BUSINESS_FAMILIES[data.businessFamily] : null;
    const typeInfo = data.businessType ? BUSINESS_TYPES[data.businessType] : null;
    const satInfo = data.satRegime ? SAT_REGIMES[data.satRegime] : null;

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <span className="text-6xl mb-4 block">🎉</span>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    ¡{data.businessName} está listo!
                </h2>
                <p className="text-gray-600">
                    Revisa que todo esté correcto antes de continuar.
                </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">País:</span>
                    <span className="font-semibold">
                        {countryInfo?.flag} {countryInfo?.name}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Idioma:</span>
                    <span className="font-semibold">
                        {languageInfo?.nativeName || 'Español'}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Moneda:</span>
                    <span className="font-semibold">
                        {currencyInfo?.symbol} {currencyInfo?.code} ({currencyInfo?.name})
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Negocio:</span>
                    <span className="font-semibold">{data.businessName}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-semibold">
                        {typeInfo?.emoji} {typeInfo?.name}
                    </span>
                </div>
                {showSAT && (
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Régimen SAT:</span>
                        <span className="font-semibold">{satInfo?.name || 'No aplica'}</span>
                    </div>
                )}
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">WhatsApp:</span>
                    <span className="font-semibold">
                        {data.hasWhatsApp && data.whatsappApiKey ? '✅ Conectado' : '⏸️ Pendiente'}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Archivos importados:</span>
                    <span className="font-semibold">{data.importedFiles.length} archivo(s)</span>
                </div>
            </div>

            <p className="text-sm text-center text-gray-500">
                Al dar clic en "¡Empezar!" te mostraremos un tutorial rápido
                para que aprendas a usar la app.
            </p>
        </div>
    );
}

export default OnboardingWizard;
