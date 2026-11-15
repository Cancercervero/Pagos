'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { parseInvoiceAction } from '@/app/actions/invoice-actions';
import Image from 'next/image';

interface InvoiceScanProps {
    onInvoiceScanned: (data: any) => void;
}

export default function InvoiceScan({ onInvoiceScanned }: InvoiceScanProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setPreviewUrl(base64String);
            processImage(base64String);
        };
        reader.readAsDataURL(file);
    };

    const processImage = async (base64Image: string) => {
        setIsScanning(true);
        setError(null);

        try {
            const result = await parseInvoiceAction(base64Image);

            if (result.success) {
                onInvoiceScanned(result.data);
            } else {
                setError(result.error || 'Error al procesar la factura');
            }
        } catch (err) {
            setError('Error de conexión o procesamiento');
            console.error(err);
        } finally {
            setIsScanning(false);
        }
    };

    const clearSelection = () => {
        setPreviewUrl(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full">
            {!previewUrl ? (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition group"
                    >
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-teal-500 mb-2" />
                        <span className="text-sm font-medium text-gray-600 group-hover:text-teal-700">Subir Imagen</span>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()} // Mobile browsers often handle camera via file input with capture
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition group"
                    >
                        <Camera className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mb-2" />
                        <span className="text-sm font-medium text-gray-600 group-hover:text-purple-700">Tomar Foto</span>
                    </button>
                </div>
            ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <div className="aspect-video relative">
                        <Image
                            src={previewUrl}
                            alt="Invoice Preview"
                            fill
                            className="object-contain"
                        />
                    </div>

                    {isScanning && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                            <Loader2 className="w-10 h-10 animate-spin mb-3 text-teal-400" />
                            <p className="font-medium">Analizando factura con IA...</p>
                        </div>
                    )}

                    {!isScanning && !error && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                            <CheckCircle className="w-4 h-4" />
                            Procesado
                        </div>
                    )}

                    {!isScanning && error && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 text-white p-4 backdrop-blur-sm flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={clearSelection}
                        className="absolute top-2 left-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
