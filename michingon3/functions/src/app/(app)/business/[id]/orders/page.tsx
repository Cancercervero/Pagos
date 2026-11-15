'use client';

import { useState, useRef, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Mic,
    Camera,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Check,
    X as XIcon,
    Package
} from 'lucide-react';
import { NewOrderDialog } from '@/components/orders/new-order-dialog';
import { CameraModal } from '@/components/ui/camera-modal';

import { scanOrder, processOrderText } from '@/app/actions/scan-actions';

export default function OrdersPage() {
    const { orders, updateOrderStatus, completeOrder, addOrder } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [orderText, setOrderText] = useState('');
    const [viewMode, setViewMode] = useState<'pending' | 'rejected'>('pending');
    const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);

    // Scanning State
    const [isScanning, setIsScanning] = useState(false);
    const [scannedOrderData, setScannedOrderData] = useState<any>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showScanResultModal, setShowScanResultModal] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    // Voice Dictation State
    const [isListening, setIsListening] = useState(false);
    const [isProcessingText, setIsProcessingText] = useState(false);

    // Calendar Logic
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

    const startingDayIndex = getDay(firstDayOfMonth);
    const adjustedStartingDayIndex = startingDayIndex === 0 ? 6 : startingDayIndex - 1;
    const paddingDays = Array.from({ length: adjustedStartingDayIndex });
    const weekDays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Filter orders by selected date and status
    const selectedOrders = selectedDate
        ? orders.filter(order => {
            try {
                const orderDate = order.deliveryDate instanceof Date
                    ? order.deliveryDate
                    : new Date(order.deliveryDate);
                return isSameDay(orderDate, selectedDate) &&
                    (viewMode === 'pending' ? order.status === 'pending' || order.status === 'preparing' : order.status === 'rejected');
            } catch {
                return false;
            }
        })
        : [];

    // Check if a date has orders
    const hasOrdersOnDate = (date: Date) => {
        return orders.some(order => {
            try {
                const orderDate = order.deliveryDate instanceof Date
                    ? order.deliveryDate
                    : new Date(order.deliveryDate);
                return isSameDay(orderDate, date);
            } catch {
                return false;
            }
        });
    };

    const handleAccept = async (id: string) => {
        await updateOrderStatus(id, 'preparing');
    };

    const handleReject = async (id: string) => {
        await updateOrderStatus(id, 'rejected');
    };

    const handleComplete = async (id: string) => {
        await completeOrder(id);
    };

    const handleScanOrder = async (file: File) => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setShowScanResultModal(true);
        setIsScanning(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanOrder(formData);

            if (result.success && result.data) {
                setScannedOrderData(result.data);
            } else {
                alert('Error al escanear el pedido');
                setShowScanResultModal(false);
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
            setShowScanResultModal(false);
        } finally {
            setIsScanning(false);
        }
    };

    const recognitionRef = useRef<any>(null);

    const handleVoiceDictation = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Tu navegador no soporta dictado por voz. Intenta usar Chrome.');
            return;
        }

        if (isListening) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                setIsListening(false);
            }
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-MX';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognitionRef.current = recognition;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setOrderText(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.start();
    };

    // Cleanup speech recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleProcessText = async () => {
        if (!orderText.trim()) return;

        setIsProcessingText(true);
        try {
            const result = await processOrderText(orderText);
            if (result.success && result.data) {
                setScannedOrderData(result.data);
                setShowScanResultModal(true);
            } else {
                alert('No se pudo procesar el texto. Intenta ser más específico.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar el texto con IA');
        } finally {
            setIsProcessingText(false);
        }
    };

    const handleCreateOrder = async () => {
        if (!scannedOrderData) return;

        try {
            await addOrder({
                clientName: scannedOrderData.clientName || 'Cliente General',
                deliveryDate: scannedOrderData.deliveryDate ? new Date(scannedOrderData.deliveryDate) : new Date(),
                deliveryTime: scannedOrderData.deliveryTime || '12:00',
                status: 'pending',
                items: scannedOrderData.items.map((item: any) => ({
                    productId: 'temp-id', // In a real app, we'd match product names to IDs
                    productName: item.productName,
                    quantity: item.quantity,
                    notes: item.notes
                })),
                notes: scannedOrderData.notes || ''
            });

            setShowScanResultModal(false);
            setScannedOrderData(null);
            setPreviewUrl(null);
            setOrderText('');
            alert('Pedido creado exitosamente');
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error al crear el pedido');
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowNewOrderDialog(true)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium flex items-center gap-2"
                    >
                        <Package className="w-4 h-4" />
                        Nuevo Pedido
                    </button>
                    {/* View Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('pending')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'pending' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
                                }`}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setViewMode('rejected')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'rejected' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
                                }`}
                        >
                            Rechazados
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel: AI Assistant */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col h-[600px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            Asistente de Pedidos con IA
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Pega texto, dicta por voz o sube una foto de una nota. La IA lo analizará y creará el pedido por ti.
                        </p>
                    </div>

                    <div className="flex-1 mb-4">
                        <textarea
                            className="w-full h-full p-4 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                            placeholder="Ej: 'Hola, para mañana necesito 2 kilos de bistec y 1 de chorizo. A nombre de Taquería El Califa. Gracias!'"
                            value={orderText}
                            onChange={(e) => setOrderText(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleProcessText}
                            disabled={isProcessingText || !orderText.trim()}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
                        >
                            <Sparkles className="w-5 h-5" />
                            {isProcessingText ? 'Procesando...' : 'Procesar Texto con IA'}
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleVoiceDictation}
                                className={`py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 transition ${isListening ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white'}`}
                            >
                                <Mic className={`w-5 h-5 ${isListening ? 'text-red-500' : 'text-gray-500'}`} />
                                {isListening ? 'Escuchando...' : 'Dictar por Voz'}
                            </button>
                            <button
                                onClick={() => setShowCamera(true)}
                                className="py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 transition"
                            >
                                <Camera className="w-5 h-5 text-gray-500" />
                                Escanear Nota
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Calendar */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm h-[600px]">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition" aria-label="Mes anterior">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition" aria-label="Mes siguiente">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-4">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                        {paddingDays.map((_, i) => (
                            <div key={`padding-${i}`} />
                        ))}

                        {daysInMonth.map((day) => {
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const hasOrders = hasOrdersOnDate(day);

                            return (
                                <button
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                    relative h-14 w-full flex flex-col items-center justify-center rounded-xl transition
                    ${isSelected ? 'bg-gray-200 text-gray-900 font-semibold' : 'hover:bg-gray-50 text-gray-700'}
                    ${isToday && !isSelected ? 'text-teal-600 font-bold' : ''}
                  `}
                                >
                                    <span className="text-sm">{format(day, 'd')}</span>
                                    {hasOrders && (
                                        <span className="mt-1 w-1 h-1 bg-red-500 rounded-full"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Order Details Modal */}
            {selectedDate && selectedOrders.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(undefined)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Pedidos para el {format(selectedDate, 'd [de] MMMM, yyyy', { locale: es })}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {viewMode === 'pending' ? 'Pendientes y preparándose' : 'Rechazados'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedDate(undefined)}
                                className="text-gray-400 hover:text-gray-600 transition"
                                aria-label="Cerrar"
                            >
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <div className="p-6 bg-gray-50 space-y-4">
                            {selectedOrders.map((order) => (
                                <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{order.clientName}</h4>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <span className="w-4 h-4 flex items-center justify-center border border-gray-300 rounded-full text-[10px]">🕒</span>
                                                Entrega a las: {order.deliveryTime}
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${order.status === 'pending' ? 'bg-red-100 text-red-600' :
                                            order.status === 'preparing' ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {order.status === 'pending' ? 'pendiente' : order.status === 'preparing' ? 'preparando' : 'rechazado'}
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
                                            {order.items.map((item, idx) => (
                                                <li key={idx}>
                                                    {item.quantity} unidades de {item.productName}
                                                    {item.notes && <span className="text-gray-500 italic ml-2">({item.notes})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                        {order.notes && (
                                            <p className="text-xs text-gray-500 italic">
                                                Nota: {order.notes}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {order.status === 'pending' && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                                            <button
                                                onClick={() => handleAccept(order.id)}
                                                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                                            >
                                                <Check className="w-4 h-4" />
                                                Aceptar
                                            </button>
                                            <button
                                                onClick={() => handleReject(order.id)}
                                                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                                            >
                                                <XIcon className="w-4 h-4" />
                                                Rechazar
                                            </button>
                                        </div>
                                    )}
                                    {order.status === 'preparing' && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                                            <button
                                                onClick={() => handleComplete(order.id)}
                                                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                                            >
                                                <Package className="w-4 h-4" />
                                                Marcar como Entregado
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <NewOrderDialog open={showNewOrderDialog} onClose={() => setShowNewOrderDialog(false)} />

            {/* Scan Result Modal */}
            {showScanResultModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Procesando Pedido</h2>
                            <button
                                onClick={() => {
                                    setShowScanResultModal(false);
                                    setScannedOrderData(null);
                                    setPreviewUrl(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Cerrar"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {previewUrl && (
                                <div className="flex justify-center">
                                    <img src={previewUrl} alt="Nota escaneada" className="max-h-48 rounded shadow-sm" />
                                </div>
                            )}

                            {isScanning ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-3"></div>
                                    <p className="text-gray-600 font-medium">Leyendo nota...</p>
                                </div>
                            ) : scannedOrderData ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <h3 className="font-bold text-green-800 mb-2">¡Pedido Identificado!</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="font-medium">Cliente:</span> {scannedOrderData.clientName}</p>
                                            {scannedOrderData.deliveryDate && <p><span className="font-medium">Fecha Entrega:</span> {scannedOrderData.deliveryDate}</p>}
                                            {scannedOrderData.deliveryTime && <p><span className="font-medium">Hora:</span> {scannedOrderData.deliveryTime}</p>}

                                            <div className="mt-2">
                                                <p className="font-medium text-green-700 mb-1">Productos:</p>
                                                <ul className="list-disc list-inside text-green-800">
                                                    {scannedOrderData.items.map((item: any, i: number) => (
                                                        <li key={i}>
                                                            {item.quantity}x {item.productName}
                                                            {item.notes && <span className="text-xs italic ml-1">({item.notes})</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            {scannedOrderData.notes && (
                                                <p className="mt-2 text-xs italic text-green-700">Nota: {scannedOrderData.notes}</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCreateOrder}
                                        className="w-full py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition"
                                    >
                                        Crear Pedido
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanOrder}
            />
        </div>
    );
}
