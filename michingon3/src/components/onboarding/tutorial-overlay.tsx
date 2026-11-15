'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Package, ShoppingCart, FileText, Calculator, Settings, Brain, Sparkles } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface TutorialStep {
    id: string;
    title: string;
    message: string;
    emoji: string;
    icon?: React.ReactNode;
}

interface TutorialOverlayProps {
    businessType?: string;
    onComplete: () => void;
    onSkip: () => void;
}

// ═══════════════════════════════════════════════════════════════
// TUTORIAL STEPS - Simplified without element targeting
// ═══════════════════════════════════════════════════════════════

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: '¡Bienvenido a Michingon!',
        message: 'Te mostraremos las funciones más importantes de tu app en solo 30 segundos.',
        emoji: '🎉'
    },
    {
        id: 'inventory',
        title: '📦 Inventario',
        message: 'En el menú izquierdo encontrarás "Inventario" donde agregas productos, controlas stock y ves qué te falta pedir.',
        emoji: '📦'
    },
    {
        id: 'pos',
        title: '🏪 Punto de Venta (POS)',
        message: 'En "Caja (POS)" puedes cobrar rápido. Escanea productos con la cámara o búscalos por nombre.',
        emoji: '🏪'
    },
    {
        id: 'invoicing',
        title: '📑 Facturación',
        message: 'En "Facturación" subes las facturas de tus compras. La IA las lee y actualiza tus costos automáticamente.',
        emoji: '📑'
    },
    {
        id: 'tax-guide',
        title: '⚖️ Guía de Impuestos',
        message: 'En "Impuestos" te ayudamos a entender tus obligaciones fiscales y calcular lo que debes declarar.',
        emoji: '⚖️'
    },
    {
        id: 'settings',
        title: '⚙️ Configuración',
        message: 'En "Configuración" conectas WhatsApp, configuras costos fijos y personalizas tu negocio.',
        emoji: '⚙️'
    },
    {
        id: 'brain',
        title: '🧠 Cerebro IA (Mao)',
        message: 'En "Cerebro (IA)" o haciendo clic en Mao (arriba a la derecha 🐱) puedes preguntarme lo que quieras. ¡Soy tu asistente personal para reportes, análisis y consejos!',
        emoji: '🐱'
    },
    {
        id: 'complete',
        title: '¡Listo para empezar!',
        message: 'Lo demás es intuitivo. Explora el menú y recuerda que siempre puedes preguntar al Cerebro IA.',
        emoji: '🚀'
    }
];

// ═══════════════════════════════════════════════════════════════
// TUTORIAL OVERLAY COMPONENT - Simplified centered modal
// ═══════════════════════════════════════════════════════════════

export function TutorialOverlay({ onComplete, onSkip }: TutorialOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const step = TUTORIAL_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

    const nextStep = useCallback(() => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    }, [isLastStep, onComplete]);

    const prevStep = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    }, [isFirstStep]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                nextStep();
            } else if (e.key === 'ArrowLeft') {
                prevStep();
            } else if (e.key === 'Escape') {
                onSkip();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextStep, prevStep, onSkip]);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Background overlay */}
            <div
                className="absolute inset-0 bg-black/70"
                onClick={nextStep}
            />

            {/* Modal card */}
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-[420px] max-w-[90vw] animate-in fade-in zoom-in duration-300">
                {/* Close button */}
                <button
                    onClick={onSkip}
                    aria-label="Cerrar tutorial"
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Emoji */}
                <div className="text-6xl text-center mb-4">
                    {step.emoji}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                    {step.title}
                </h2>

                {/* Message */}
                <p className="text-gray-600 text-center leading-relaxed mb-8 text-lg">
                    {step.message}
                </p>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mb-6">
                    {TUTORIAL_STEPS.map((_, index) => (
                        <div
                            key={index}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentStep
                                ? 'w-8 bg-teal-500'
                                : index < currentStep
                                    ? 'w-2 bg-teal-300'
                                    : 'w-2 bg-gray-200'
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={prevStep}
                        disabled={isFirstStep}
                        className="flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Atrás
                    </button>

                    <button
                        onClick={onSkip}
                        className="text-sm text-gray-400 hover:text-gray-600 transition"
                    >
                        Saltar
                    </button>

                    <button
                        onClick={nextStep}
                        className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition shadow-lg shadow-teal-600/20"
                    >
                        {isLastStep ? '¡Empezar!' : 'Siguiente'}
                        {!isLastStep && <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* Step counter */}
                <div className="text-center text-gray-400 text-sm mt-6">
                    Paso {currentStep + 1} de {TUTORIAL_STEPS.length}
                </div>
            </div>
        </div>
    );
}

export default TutorialOverlay;
