'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImportStep = 'upload' | 'processing' | 'review' | 'completed';

export function ImportWizard() {
    const [step, setStep] = useState<ImportStep>('upload');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(Array.from(e.dataTransfer.files));
        }
    };

    const startProcessing = async () => {
        setStep('processing');

        const formData = new FormData();
        formData.append('file', files[0]); // Process first file for now

        try {
            // Dynamically import the action to avoid client-side issues if any
            const { processUploadedFile } = await import('@/app/actions/import-actions');
            const result = await processUploadedFile(formData);

            if (result.success) {
                setExtractedData(result.data);
                setStep('review');
            } else {
                alert('Error al procesar el archivo');
                setStep('upload');
            }
        } catch (error) {
            console.error(error);
            alert('Error inesperado');
            setStep('upload');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-2xl mx-auto">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">Importación Inteligente</h2>
                <p className="text-sm text-gray-500">Sube tus archivos (Excel, PDF, Imágenes) y la IA organizará tu negocio.</p>
            </div>

            <div className="p-8">
                {step === 'upload' && (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                            isDragging ? "border-teal-500 bg-teal-50" : "border-gray-300 hover:border-teal-400 hover:bg-gray-50"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept=".xlsx,.xls,.csv,.pdf,.jpg,.png"
                        />
                        <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Arrastra tus archivos aquí</h3>
                        <p className="text-sm text-gray-500 mb-6">o haz clic para buscar en tu computadora</p>

                        {files.length > 0 && (
                            <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-sm mx-auto text-left">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Archivos seleccionados:</p>
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                                        <FileText className="w-4 h-4 text-teal-500" />
                                        <span className="truncate">{f.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {files.length > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startProcessing();
                                }}
                                className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition shadow-sm"
                            >
                                Procesar con IA
                            </button>
                        )}
                    </div>
                )}

                {step === 'processing' && (
                    <div className="text-center py-12">
                        <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
                            <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-teal-600 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Analizando tus documentos...</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Nuestra IA está leyendo tus archivos para identificar productos, precios y proveedores. Esto puede tomar unos segundos.
                        </p>
                    </div>
                )}

                {step === 'review' && extractedData && (
                    <div>
                        <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                            <Check className="w-5 h-5" />
                            <p className="font-medium">¡Análisis completado! He encontrado lo siguiente:</p>
                        </div>

                        <div className="space-y-6">
                            {/* Products */}
                            {extractedData.products && extractedData.products.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-medium text-gray-700">Productos Detectados ({extractedData.products.length})</h4>
                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">Alta Confianza</span>
                                    </div>
                                    <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                                        {extractedData.products.map((prod: any, i: number) => (
                                            <div key={i} className="p-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium text-gray-900">{prod.name}</p>
                                                    <p className="text-xs text-gray-500">Categoría: {prod.category || 'N/A'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium text-gray-900">${prod.price || 0}</p>
                                                    <p className="text-xs text-gray-500">Stock: {prod.stock || 0} {prod.unit || ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Suppliers */}
                            {extractedData.suppliers && extractedData.suppliers.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-medium text-gray-700">Proveedores Detectados ({extractedData.suppliers.length})</h4>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {extractedData.suppliers.map((sup: any, i: number) => (
                                            <div key={i} className="p-3">
                                                <p className="font-medium text-gray-900">{sup.name}</p>
                                                <p className="text-xs text-gray-500">RFC: {sup.rfc || 'N/A'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setStep('upload')}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setStep('completed')}
                                className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition flex items-center gap-2"
                            >
                                Confirmar e Importar
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 'completed' && (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Importación Exitosa!</h3>
                        <p className="text-gray-500 mb-8">
                            Se han agregado {extractedData?.products?.length || 0} productos y {extractedData?.suppliers?.length || 0} proveedores a tu base de datos.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition"
                        >
                            Volver al Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
