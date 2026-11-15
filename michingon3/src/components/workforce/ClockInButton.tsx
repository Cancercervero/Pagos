'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, MapPin, Camera, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { WorkShift, GeoLocation, isWithinBusinessArea } from '@/types/workforce-types';
import { formatCurrency } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// COMPONENTE DE CHECK-IN/OUT CON GEOLOCALIZACIÓN
// ═══════════════════════════════════════════════════════════════

interface ClockInButtonProps {
    businessId: string;
    className?: string;
}

export function ClockInButton({ businessId, className = '' }: ClockInButtonProps) {
    const { userProfile, user } = useAuth();
    const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);

    // Estado del día
    const [todayStats, setTodayStats] = useState({
        salesGenerated: 0,
        transactionCount: 0,
        tasksCompleted: 0
    });

    // ─────────────────────────────────────────────────────────────
    // CARGAR TURNO ACTIVO
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        // TODO: Escuchar turno activo en Firestore
        // const unsubscribe = onSnapshot(
        //   query(collection(db, `businesses/${businessId}/shifts`), 
        //     where('userId', '==', user.uid),
        //     where('status', '==', 'active')
        //   ),
        //   (snapshot) => {
        //     if (!snapshot.empty) {
        //       setActiveShift(snapshot.docs[0].data() as WorkShift);
        //     }
        //   }
        // );
        // return () => unsubscribe();
    }, [user, businessId]);

    // ─────────────────────────────────────────────────────────────
    // OBTENER UBICACIÓN ACTUAL
    // ─────────────────────────────────────────────────────────────
    const getCurrentLocation = (): Promise<GeoLocation> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location: GeoLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date()
                    };
                    resolve(location);
                },
                (error) => {
                    let message = 'Error obteniendo ubicación';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Permiso de ubicación denegado. Por favor habilítalo en configuración.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Ubicación no disponible. Intenta de nuevo.';
                            break;
                        case error.TIMEOUT:
                            message = 'Tiempo de espera agotado. Intenta de nuevo.';
                            break;
                    }
                    reject(new Error(message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    };

    // ─────────────────────────────────────────────────────────────
    // CHECK-IN (Entrada)
    // ─────────────────────────────────────────────────────────────
    const handleClockIn = async () => {
        if (!userProfile || !user) return;

        setLoading(true);
        setLocationError(null);

        try {
            // 1. Obtener ubicación
            const location = await getCurrentLocation();
            setCurrentLocation(location);

            // 2. Validar que esté en el negocio
            // TODO: Obtener BusinessLocation de Firestore
            const businessLocation = {
                id: 'main',
                businessId,
                name: 'Local Principal',
                centerLat: 19.4326, // Placeholder
                centerLng: -99.1332,
                radiusMeters: 100,
                address: 'CDMX',
                isActive: true,
                createdAt: new Date()
            };

            const withinRange = isWithinBusinessArea(location, businessLocation);
            setIsWithinRange(withinRange);

            if (!withinRange) {
                throw new Error('No estás en el área del negocio. Acércate al local para marcar entrada.');
            }

            // 3. Crear WorkShift en Firestore
            const now = new Date();
            const newShift: Partial<WorkShift> = {
                userId: user.uid,
                businessId,
                clockInTime: now,
                clockInLocation: location,
                clockInDevice: getDeviceType(),
                clockInMethod: 'biometric', // O 'password' dependiendo
                isLate: false, // TODO: Calcular vs. horario esperado
                status: 'active',
                createdAt: now,
                updatedAt: now
            };

            // TODO: Guardar en Firestore
            // const docRef = await addDoc(
            //   collection(db, `businesses/${businessId}/shifts`),
            //   newShift
            // );

            console.log('Check-in exitoso:', newShift);

            // Simular
            setActiveShift(newShift as WorkShift);

        } catch (error: any) {
            console.error('Error en check-in:', error);
            setLocationError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // CHECK-OUT (Salida)
    // ─────────────────────────────────────────────────────────────
    const handleClockOut = async () => {
        if (!activeShift || !user) return;

        setLoading(true);
        setLocationError(null);

        try {
            // 1. Obtener ubicación de salida
            const location = await getCurrentLocation();
            setCurrentLocation(location);

            // 2. Actualizar el shift
            const now = new Date();
            const updatedShift = {
                ...activeShift,
                clockOutTime: now,
                clockOutLocation: location,
                clockOutDevice: getDeviceType(),
                status: 'completed' as const,
                updatedAt: now,
                dailyStats: {
                    salesGenerated: todayStats.salesGenerated,
                    transactionCount: todayStats.transactionCount,
                    tasksCompleted: todayStats.tasksCompleted,
                    customersServed: todayStats.transactionCount
                }
            };

            // TODO: Actualizar en Firestore
            // await updateDoc(
            //   doc(db, `businesses/${businessId}/shifts/${activeShift.id}`),
            //   updatedShift
            // );

            console.log('Check-out exitoso:', updatedShift);

            setActiveShift(null);

        } catch (error: any) {
            console.error('Error en check-out:', error);
            setLocationError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Detectar tipo de dispositivo
    // ─────────────────────────────────────────────────────────────
    const getDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    };

    // ─────────────────────────────────────────────────────────────
    // CALCULAR TIEMPO TRABAJADO
    // ─────────────────────────────────────────────────────────────
    const getElapsedTime = (): string => {
        if (!activeShift) return '0h 0m';

        const now = new Date();
        const diffMs = now.getTime() - activeShift.clockInTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    };

    // ─────────────────────────────────────────────────────────────
    // SI NO HAY USUARIO, NO MOSTRAR
    // ─────────────────────────────────────────────────────────────
    if (!userProfile) return null;

    // Si el usuario no tiene permiso de clock_in, no mostrar
    // (Por ejemplo, analyst solo ve reportes, no checa entrada)
    // TODO: Verificar con hasPermission('clock_in')

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">
                        {activeShift ? 'Turno Activo' : 'Marcar Entrada'}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {activeShift ? getElapsedTime() : 'Listo para iniciar'}
                    </p>
                </div>
            </div>

            {/* Si hay turno activo, mostrar estadísticas del día */}
            {activeShift && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-xs text-green-600 font-medium">Ventas</p>
                        <p className="text-lg font-bold text-green-700">
                            {formatCurrency(todayStats.salesGenerated)}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-xs text-purple-600 font-medium">Tickets</p>
                        <p className="text-lg font-bold text-purple-700">
                            {todayStats.transactionCount}
                        </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                        <p className="text-xs text-orange-600 font-medium">Tareas</p>
                        <p className="text-lg font-bold text-orange-700">
                            {todayStats.tasksCompleted}
                        </p>
                    </div>
                </div>
            )}

            {/* Ubicación actual */}
            {currentLocation && (
                <div className="flex items-start gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-xs text-gray-600">Ubicación detectada</p>
                        <p className="text-sm font-mono text-gray-800">
                            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500">
                            Precisión: ±{Math.round(currentLocation.accuracy)}m
                        </p>
                    </div>
                    {isWithinRange !== null && (
                        <div>
                            {isWithinRange ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error de ubicación */}
            {locationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{locationError}</p>
                </div>
            )}

            {/* Botón principal */}
            {!activeShift ? (
                <button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Obteniendo ubicación...
                        </>
                    ) : (
                        <>
                            <Clock className="w-5 h-5" />
                            Marcar Entrada
                        </>
                    )}
                </button>
            ) : (
                <button
                    onClick={handleClockOut}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Finalizando turno...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            Marcar Salida
                        </>
                    )}
                </button>
            )}

            {/* Info adicional */}
            <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                    {activeShift
                        ? 'Tu productividad se está rastreando automáticamente'
                        : 'Usaremos tu ubicación para validar que estés en el negocio'}
                </p>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MINI COMPONENTE: Vista rápida en header
// ═══════════════════════════════════════════════════════════════

export function QuickClockStatus() {
    const { userProfile } = useAuth();
    const [activeShift, setActiveShift] = useState<WorkShift | null>(null);

    // TODO: Cargar turno activo

    if (!userProfile) return null;

    const getElapsedTime = (): string => {
        if (!activeShift) return '';

        const now = new Date();
        const diffMs = now.getTime() - activeShift.clockInTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    };

    if (!activeShift) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm text-gray-600">No activo</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">{getElapsedTime()}</span>
        </div>
    );
}
