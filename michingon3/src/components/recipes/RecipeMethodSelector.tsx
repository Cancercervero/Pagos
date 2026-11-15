'use client';

import { X } from 'lucide-react';

interface RecipeMethodSelectorProps {
    onSelectMethod: (method: 'manual' | 'scan' | 'upload') => void;
    onClose: () => void;
}

export default function RecipeMethodSelector({ onSelectMethod, onClose }: RecipeMethodSelectorProps) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Nueva Receta</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-3">
                    <p className="text-gray-600 text-center mb-4">
                        ¿Cómo quieres crear tu receta?
                    </p>

                    {/* Manual Entry Option */}
                    <button
                        onClick={() => onSelectMethod('manual')}
                        className="w-full p-5 border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition group text-left"
                    >
                        <div className="text-4xl mb-2">📝</div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-teal-700">
                            Entrada Rápida
                        </h3>
                        <p className="text-xs text-gray-500">
                            Escribe ingredientes, cantidades y pasos.
                            Nosotros calculamos los costos.
                        </p>
                    </button>

                    {/* Upload File Option */}
                    <button
                        onClick={() => onSelectMethod('upload')}
                        className="w-full p-5 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group text-left"
                    >
                        <div className="text-4xl mb-2">📂</div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-700">
                            Subir Archivo
                        </h3>
                        <p className="text-xs text-gray-500">
                            PDF, Word o Excel con tu receta.
                            IA extrae toda la información.
                        </p>
                    </button>

                    {/* Scan Option */}
                    <button
                        onClick={() => onSelectMethod('scan')}
                        className="w-full p-5 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition group text-left"
                    >
                        <div className="text-4xl mb-2">📷</div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-purple-700">
                            Escanear Receta
                        </h3>
                        <p className="text-xs text-gray-500">
                            Toma foto de receta escrita o impresa.
                            IA extrae todo automáticamente.
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
}
