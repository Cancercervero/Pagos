'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, Check, AlertCircle, FileText } from 'lucide-react';

interface RecipeFileUploadProps {
    onClose: () => void;
    onSave: (recipe: any) => Promise<void>;
    businessId: string;
    categories: string[];
}

interface ExtractedRecipe {
    name: string;
    category: string;
    ingredients: Array<{ name: string; quantity: string; unit: string }>;
    procedure: string[];
}

export default function RecipeFileUpload({ onClose, onSave, businessId, categories }: RecipeFileUploadProps) {
    const [step, setStep] = useState<'upload' | 'processing' | 'preview'>('upload');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedRecipe | null>(null);
    const [finalImage, setFinalImage] = useState<string>('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ];

            if (!validTypes.includes(file.type)) {
                setError('Tipo de archivo no válido. Usa PDF, Word o Excel.');
                return;
            }

            setSelectedFile(file);
            processFile(file);
        }
    };

    const processFile = async (file: File) => {
        setStep('processing');
        setError('');

        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                const response = await fetch('/api/recipes/process-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileData: base64,
                        fileName: file.name,
                        fileType: file.type
                    })
                });

                if (!response.ok) {
                    throw new Error('Error al procesar archivo');
                }

                const data = await response.json();
                setExtractedData(data.recipe);
                setStep('preview');
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            console.error('Error processing file:', err);
            setError(err.message || 'Error al procesar archivo');
            setStep('upload');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (!extractedData) return;

        try {
            const recipeData = {
                name: extractedData.name,
                code: `REC-${Date.now()}`,
                category: extractedData.category || 'General',
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
                ingredients: extractedData.ingredients.map(ing => ({
                    name: ing.name,
                    quantity: parseFloat(ing.quantity) || 0,
                    unit: ing.unit,
                    cost: 0
                })),
                laborSteps: [],
                procedure: extractedData.procedure,
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
                        <h2 className="text-xl font-bold text-gray-900">📂 Subir Archivo de Receta</h2>
                        <p className="text-sm text-gray-500">
                            {step === 'upload' && 'Selecciona PDF, Word o Excel'}
                            {step === 'processing' && 'Procesando archivo con IA...'}
                            {step === 'preview' && 'Revisa y ajusta los datos extraídos'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Upload Step */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-900">Error</p>
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".pdf,.doc,.docx,.xls,.xlsx"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-32 border-4 border-dashed border-gray-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-4 text-gray-600 hover:text-blue-700"
                            >
                                <Upload className="w-16 h-16" />
                                <div className="text-center">
                                    <p className="text-lg font-semibold">Seleccionar Archivo</p>
                                    <p className="text-sm mt-1">PDF, Word (.doc, .docx) o Excel (.xls, .xlsx)</p>
                                </div>
                            </button>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-800">
                                    💡 <strong>Formatos aceptados:</strong>
                                </p>
                                <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                                    <li>PDF con receta completa</li>
                                    <li>Word con ingredientes y pasos</li>
                                    <li>Excel con tabla de ingredientes</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Processing Step */}
                    {step === 'processing' && (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                            <p className="text-lg font-semibold text-gray-900">Procesando archivo...</p>
                            <p className="text-sm text-gray-500 mt-2">Extrayendo información con IA</p>
                            {selectedFile && (
                                <div className="mt-6 flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <FileText className="w-8 h-8 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">{selectedFile.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(selectedFile.size / 1024).toFixed(0)} KB
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Step */}
                    {step === 'preview' && extractedData && (
                        <div className="space-y-6">
                            {/* Success Message */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-green-900">¡Archivo procesado exitosamente!</p>
                                    <p className="text-sm text-green-700">Revisa los datos y agrega foto del platillo</p>
                                </div>
                            </div>

                            {/* Extracted Data */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        value={extractedData.name}
                                        onChange={(e) => setExtractedData({ ...extractedData, name: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                                    <select
                                        value={extractedData.category}
                                        onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.filter(c => c !== 'Todos').map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ingredientes ({extractedData.ingredients.length})
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {extractedData.ingredients.map((ing, i) => (
                                            <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                                                <span className="font-medium">{ing.name}</span>
                                                <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Procedimiento ({extractedData.procedure.length} pasos)
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {extractedData.procedure.map((step, i) => (
                                            <div key={i} className="p-3 bg-gray-50 rounded-lg flex gap-3">
                                                <span className="font-bold text-blue-600">{i + 1}.</span>
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
                                        ref={imageInputRef}
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition flex items-center justify-center gap-2 text-gray-600"
                                    >
                                        <Upload className="w-5 h-5" />
                                        {finalImage ? 'Cambiar foto' : 'Subir foto del platillo'}
                                    </button>
                                    {finalImage && (
                                        <div className="mt-3 relative w-full h-48 rounded-xl overflow-hidden border border-gray-200">
                                            <img
                                                src={finalImage}
                                                alt="Final dish"
                                                className="w-full h-full object-cover"
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
                                setStep('upload');
                                setExtractedData(null);
                                setSelectedFile(null);
                            }}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900"
                        >
                            ← Subir otro archivo
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center gap-2"
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
