'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Upload,
    Camera,
    History,
    ArrowLeft
} from 'lucide-react';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanInventoryCount } from '@/app/actions/scan-actions';

export default function ReconciliationPage() {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleScanCount = async (file: File) => {
        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanInventoryCount(formData);

            if (result.success && result.data) {
                console.log('Scanned Data:', result.data);
                alert('Conteo escaneado exitosamente (Simulación: Ver consola)');
                // Here we would typically redirect to a "Review Count" page or open a modal with the results
            } else {
                alert('No se pudo escanear el conteo. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    // Calendar Logic (Reused pattern)
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const startingDayIndex = getDay(firstDayOfMonth);
    const adjustedStartingDayIndex = startingDayIndex === 0 ? 6 : startingDayIndex - 1;
    const paddingDays = Array.from({ length: adjustedStartingDayIndex });
    const weekDays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Mock Data for Calendar Status
    const reconciliationHistory = [
        { date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 2), status: 'matched' }, // Cuadrado
        { date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5), status: 'discrepancy' }, // Con Discrepancias
    ];

    const getStatusForDay = (day: Date) => {
        return reconciliationHistory.find(h => isSameDay(h.date, day))?.status;
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                    aria-label="Volver"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Conciliación de Inventario</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel: Load Physical Count */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm h-fit">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <History className="w-5 h-5 text-teal-600" />
                            Cargar Conteo Físico
                        </h2>
                        <p className="text-sm text-gray-500 mt-2">
                            Toma o sube una foto de tu lista de inventario escrita a mano. La IA la analizará y la comparará con el stock del sistema.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg flex items-center justify-center gap-3 transition shadow-sm">
                            <Upload className="w-5 h-5" />
                            Subir Foto de la Lista
                        </button>
                        <button
                            onClick={() => setShowCamera(true)}
                            className="w-full py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-3 transition"
                            disabled={isScanning}
                        >
                            <Camera className="w-5 h-5 text-gray-600" />
                            {isScanning ? 'Procesando...' : 'Tomar Foto con Cámara'}
                        </button>
                    </div>
                </div>

                {/* Right Panel: History Calendar */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Historial de Conteos</h2>
                        <p className="text-sm text-gray-500 mt-1">Selecciona una fecha para ver o crear una conciliación.</p>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium text-gray-900 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full transition" aria-label="Mes anterior">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full transition" aria-label="Mes siguiente">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-2 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {paddingDays.map((_, i) => (
                            <div key={`padding-${i}`} />
                        ))}

                        {daysInMonth.map((day) => {
                            const status = getStatusForDay(day);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <button
                                    key={day.toString()}
                                    className={`
                    h-10 w-10 mx-auto flex items-center justify-center rounded-full text-sm transition
                    ${status === 'matched' ? 'bg-teal-500 text-white font-bold' : ''}
                    ${status === 'discrepancy' ? 'bg-red-500 text-white font-bold' : ''}
                    ${!status ? 'hover:bg-gray-100 text-gray-700' : ''}
                    ${isToday && !status ? 'border border-teal-500 text-teal-600 font-bold' : ''}
                  `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-8 flex items-center gap-6 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            <span>Cuadrado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span>Con Discrepancias</span>
                        </div>
                    </div>
                </div>
            </div>
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanCount}
            />
        </div>
    );
}
