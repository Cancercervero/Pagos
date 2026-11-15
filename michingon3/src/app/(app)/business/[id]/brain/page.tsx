'use client';

import { useState } from 'react';
import { Upload, FileText, FileSpreadsheet, X, CheckCircle } from 'lucide-react';

export default function BrainPage() {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

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
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles(prev => [...prev, ...droppedFiles]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleProcess = () => {
        setIsProcessing(true);
        // Simulate processing
        setTimeout(() => {
            setIsProcessing(false);
            setUploadSuccess(true);
            setFiles([]);
            setTimeout(() => setUploadSuccess(false), 3000);
        }, 2000);
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="text-4xl">🧠</span> Cerebro del Negocio
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Alimenta a tu IA con información. Arrastra facturas, inventarios (Excel) o documentos (PDF).
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Zone */}
                <div className="lg:col-span-2 space-y-6">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
                            relative border-4 border-dashed rounded-3xl p-12 text-center transition-all duration-300
                            ${isDragging
                                ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }
                        `}
                    >
                        <input
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />

                        <div className="flex flex-col items-center gap-4 pointer-events-none">
                            <div className={`
                                w-20 h-20 rounded-full flex items-center justify-center
                                ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
                            `}>
                                <Upload className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-700">
                                    Arrastra archivos aquí
                                </h3>
                                <p className="text-gray-400 mt-1">
                                    o haz clic para buscar en tu computadora
                                </p>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                                    <FileSpreadsheet className="w-3 h-3" /> Excel
                                </span>
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> PDF
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-700">Archivos listos ({files.length})</h3>
                                <button
                                    onClick={() => setFiles([])}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {files.map((file, index) => (
                                    <div key={index} className="p-4 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                {file.name.endsWith('.csv') || file.name.endsWith('.xlsx')
                                                    ? <FileSpreadsheet className="w-5 h-5" />
                                                    : <FileText className="w-5 h-5" />
                                                }
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 truncate max-w-[200px]">{file.name}</p>
                                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing}
                                    className={`
                                        w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98]
                                        ${isProcessing
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/30'
                                        }
                                    `}
                                >
                                    {isProcessing ? 'Procesando...' : '🧠 Alimentar al Cerebro'}
                                </button>
                            </div>
                        </div>
                    )}

                    {uploadSuccess && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700 animate-in slide-in-from-bottom-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">¡Información procesada correctamente! La IA está aprendiendo.</span>
                        </div>
                    )}
                </div>

                {/* Info / Stats */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-3xl p-6 text-white shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="text-2xl">🤖</span> Estado de la IA
                        </h3>
                        <div className="space-y-4">
                            <div className="bg-white/10 rounded-xl p-4">
                                <p className="text-xs text-blue-200 uppercase tracking-wider font-bold">Conocimiento</p>
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-3xl font-bold">85%</span>
                                    <span className="text-sm text-green-400 mb-1">▲ Creciendo</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div className="bg-blue-400 h-full rounded-full w-[85%]"></div>
                                </div>
                            </div>

                            <div className="bg-white/10 rounded-xl p-4">
                                <p className="text-xs text-purple-200 uppercase tracking-wider font-bold">Última Actualización</p>
                                <p className="text-lg font-medium mt-1">Hace 2 horas</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4">¿Qué puedo subir?</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Listas de precios de proveedores</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Estados de cuenta bancarios</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Inventarios físicos en Excel</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Manuales de operación (PDF)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
