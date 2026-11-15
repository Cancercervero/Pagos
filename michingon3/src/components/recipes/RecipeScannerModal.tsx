'use client';

import { useState, useRef } from 'react';
import { X, Camera, Loader2, Check, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface RecipeScannerModalProps {
    onClose: () => void;
    onSave: (recipe: any) => Promise<void>;
    businessId: string;
    categories: string[];
}

interface ScannedRecipe {
    name: string;
    category: string;
    ingredients: Array<{ name: string; quantity: string; unit: string }>;
    procedure: string[];
}

export default function RecipeScannerModal({ onClose, onSave, businessId, categories }: RecipeScannerModalProps) {
    const [step, setStep] = useState<'capture' | 'processing' | 'preview'>('capture');
    const [imagePreview, setImagePreview] = useState<string>('');
    const [scannedData, setScannedData] = useState<ScannedRecipe | null>(null);
    const [finalImage, setFinalImage] = useState<string>('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const finalImageInputRef = useRef<HTMLInputElement>(null);

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                processRecipeImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const processRecipeImage = async (imageData: string) => {
        setStep('processing');
        setError('');

        try {
            const response = await fetch('/api/recipes/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: imageData })
            });

            if (!response.ok) {
                throw new Error('Error al procesar imagen');
            }

            const data = await response.json();
            setScannedData(data.recipe);
            setStep('preview');
        } catch (err: any) {
            console.error('Error scanning recipe:', err);
            setError(err.message || 'Error al escanear receta');
            setStep('capture');
        }
    };

    const handleFinalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFinalImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!scannedData) return;

        try {
            const recipeData = {
                name: scannedData.name,
                code: `REC-${Date.now()}`,
                category: scannedData.category || 'General',
                emoji: '📋',
                yield: 1,
                yieldUnit: 'porción',
                totalTime: 0,
                difficulty: 'medio',
                costPerUnit: 0,
                sellingPrice: 0,
                margin: 0,
                isActive: true,
                lastUpdate: new Date().toISOString().split('T')[0],
                ingredients: scannedData.ingredients.map(ing => ({
                    name: ing.name,
                    quantity: parseFloat(ing.quantity) || 0,
                    unit: ing.unit,
                    cost: 0
                })),
                laborSteps: [],
                procedure: scannedData.procedure,
                imageUrl: finalImage,
                businessId
            };

            await onSave(recipeData);
            onClose();
        } catch (error) {
            console.error('Error saving recipe:', error);
            alert('Error al guardar receta');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">📷 Escanear Receta</h2>
                        <p className="text-sm text-gray-500">
                            {step === 'capture' && 'Toma foto de tu receta escrita o impresa'}
                            {step === 'processing' && 'Procesando con IA...'}
                            {step === 'preview' && 'Revisa y ajusta los datos extraídos'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Capture Step */}
                    {step === 'capture' && (
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-900">Error al procesar</p>
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageCapture}
                                className="hidden"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-32 border-4 border-dashed border-gray-300 rounded-2xl hover:border-purple-500 hover:bg-purple-50/50 transition flex flex-col items-center justify-center gap-4 text-gray-600 hover:text-purple-700"
                            >
                                <Camera className="w-16 h-16" />
                                <div className="text-center">
                                    <p className="text-lg font-semibold">Tomar Foto de Receta</p>
                                    <p className="text-sm mt-1">Escrita a mano o impresa</p>
                                </div>
                            </button>

                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                <p className="text-sm text-purple-800">
                                    💡 <strong>Tips para mejor resultado:</strong>
                                </p>
                                <ul className="text-sm text-purple-700 mt-2 space-y-1 ml-4 list-disc">
                                    <li>Buena iluminación</li>
                                    <li>Receta completa en el encuadre</li>
                                    <li>Letra clara y legible</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Processing Step */}
                    {step === 'processing' && (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="w-16 h-16 text-purple-600 animate-spin mb-4" />
                            <p className="text-lg font-semibold text-gray-900">Procesando con IA...</p>
                            <p className="text-sm text-gray-500 mt-2">Extrayendo ingredientes y pasos</p>
                            {imagePreview && (
                                <div className="mt-6 w-64 h-64 relative rounded-xl overflow-hidden border border-gray-200">
                                    <Image
                                        src={imagePreview}
                                        alt="Processing"
                                        fill
                                        className="object-cover opacity-50"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Step */}
                    {step === 'preview' && scannedData && (
                        <div className="space-y-6">
                            {/* Success Message */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-green-900">¡Receta extraída exitosamente!</p>
                                    <p className="text-sm text-green-700">Revisa los datos y agrega foto del platillo</p>
                                </div>
                            </div>

                            {/* Scanned Data */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        value={scannedData.name}
                                        onChange={(e) => setScannedData({ ...scannedData, name: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                                    <select
                                        value={scannedData.category}
                                        onChange={(e) => setScannedData({ ...scannedData, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.filter(c => c !== 'Todos').map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ingredientes ({scannedData.ingredients.length})
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {scannedData.ingredients.map((ing, i) => (
                                            <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                                                <span className="font-medium">{ing.name}</span>
                                                <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Procedimiento ({scannedData.procedure.length} pasos)
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {scannedData.procedure.map((step, i) => (
                                            <div key={i} className="p-3 bg-gray-50 rounded-lg flex gap-3">
                                                <span className="font-bold text-purple-600">{i + 1}.</span>
                                                <span className="text-gray-700">{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Foto del Platillo Final
                                    </label>
                                    <input
                                        type="file"
                                        ref={finalImageInputRef}
                                        accept="image/*"
                                        onChange={handleFinalImageUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => finalImageInputRef.current?.click()}
                                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 transition flex items-center justify-center gap-2 text-gray-600"
                                    >
                                        <Camera className="w-5 h-5" />
                                        {finalImage ? 'Cambiar foto' : 'Subir foto del platillo'}
                                    </button>
                                    {finalImage && (
                                        <div className="mt-3 relative w-full h-48 rounded-xl overflow-hidden border border-gray-200">
                                            <Image
                                                src={finalImage}
                                                alt="Final dish"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="flex items-center justify-between p-6 border-t border-gray-200">
                        <button
                            onClick={() => {
                                setStep('capture');
                                setScannedData(null);
                                setImagePreview('');
                            }}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900"
                        >
                            ← Escanear otra
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl flex items-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Guardar Receta
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
