import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw } from 'lucide-react';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefer back camera on mobile
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setIsStreaming(true);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsStreaming(false);
        }
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw video frame to canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to blob/file
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
                        stopCamera(); // Explicitly stop camera streams immediately
                        onCapture(file);
                        onClose();
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg bg-black rounded-xl overflow-hidden relative shadow-2xl border border-gray-800">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent">
                    <h3 className="text-white font-medium">Tomar Foto</h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-2 bg-black/20 rounded-full backdrop-blur-sm">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Video Viewport */}
                <div className="relative aspect-[3/4] bg-gray-900 flex items-center justify-center">
                    {error ? (
                        <div className="text-center p-6">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button
                                onClick={startCamera}
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 mx-auto"
                            >
                                <RefreshCw className="w-4 h-4" /> Reintentar
                            </button>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Controls */}
                <div className="p-6 bg-gray-900 flex justify-center items-center gap-8">
                    <button
                        onClick={handleCapture}
                        disabled={!isStreaming}
                        className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-105 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="w-14 h-14 rounded-full bg-white border-2 border-black"></div>
                    </button>
                </div>
            </div>
        </div>
    );
}
