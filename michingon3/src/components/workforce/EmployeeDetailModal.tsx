'use client';

import { UserProfile } from '@/types/user-types';
import { X, Mail, Phone, Calendar, DollarSign, Clock, Target, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface EmployeeDetailModalProps {
    employee: UserProfile | null;
    onClose: () => void;
}

export function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
    if (!employee) return null;

    const score = employee.performanceMetrics.overallScore;
    const metrics = employee.performanceMetrics;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-purple-600 to-blue-600 p-8 text-white rounded-t-3xl">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Foto grande */}
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl">
                                <img
                                    src={employee.photoUrl || `https://i.pravatar.cc/150?u=${employee.uid}`}
                                    alt={employee.fullName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {employee.isActive && (
                                <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
                            )}
                        </div>

                        {/* Info básica */}
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-3xl font-bold mb-2">{employee.fullName}</h2>
                            <p className="text-xl text-purple-100 mb-4">{employee.employment?.position || 'Sin cargo'}</p>

                            <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    <span className="text-sm">{employee.email}</span>
                                </div>
                                {employee.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        <span className="text-sm">{employee.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Score grande */}
                        <div className="text-center bg-white/20 backdrop-blur-sm rounded-2xl p-6">
                            <div className="text-5xl font-bold mb-2">{score}</div>
                            <div className="text-sm text-purple-100">Score General</div>
                            <div className="flex gap-1 mt-2 justify-center">
                                {[...Array(5)].map((_, i) => (
                                    <Award
                                        key={i}
                                        className={`w-5 h-5 ${i < Math.floor(score / 20) ? 'fill-yellow-300 text-yellow-300' : 'fill-white/30 text-white/30'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-8 space-y-6">
                    {/* Métricas principales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Ventas (si aplica) */}
                        {(employee.role === 'cashier' || employee.role === 'manager') && (
                            <>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <DollarSign className="w-8 h-8 text-purple-600" />
                                        <div>
                                            <p className="text-sm text-gray-600">Ventas Totales</p>
                                            <p className="text-2xl font-bold text-purple-600">
                                                ${(metrics.totalSales / 1000).toFixed(1)}k
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <p>Transacciones: <span className="font-semibold">{metrics.transactions}</span></p>
                                        <p>Ticket promedio: <span className="font-semibold">${metrics.avgTicket}</span></p>
                                        <p>Mejor venta: <span className="font-semibold">${metrics.bestSaleAmount}</span></p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Asistencia */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <Clock className="w-8 h-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-gray-600">Asistencia</p>
                                    <p className="text-2xl font-bold text-green-600">{metrics.attendanceScore}%</p>
                                </div>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                                <p>Días trabajados: <span className="font-semibold">{metrics.totalShifts}</span></p>
                                <p>A tiempo: <span className="font-semibold text-green-600">{metrics.onTimeArrivals}</span></p>
                                <p>Llegadas tarde: <span className="font-semibold text-orange-600">{metrics.lateArrivals}</span></p>
                                <p>Faltas: <span className="font-semibold text-red-600">{metrics.missedShifts}</span></p>
                            </div>
                        </div>

                        {/* Tareas */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <Target className="w-8 h-8 text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-600">Tareas</p>
                                    <p className="text-2xl font-bold text-blue-600">{metrics.tasksCompleted}</p>
                                </div>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                                <p>Completadas: <span className="font-semibold">{metrics.tasksCompleted}</span></p>
                                <p>Promedio/día: <span className="font-semibold">{(metrics.tasksCompleted / metrics.totalShifts).toFixed(1)}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Información laboral */}
                    {employee.employment && (
                        <div className="bg-gray-50 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-purple-600" />
                                Información Laboral
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Fecha de contratación</p>
                                    <p className="font-semibold">
                                        {employee.employment.hireDate instanceof Date
                                            ? employee.employment.hireDate.toLocaleDateString('es-MX')
                                            : (employee.employment.hireDate as any).toDate
                                                ? (employee.employment.hireDate as any).toDate().toLocaleDateString('es-MX')
                                                : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Tipo de contrato</p>
                                    <p className="font-semibold capitalize">{employee.employment.contractType || 'Full Time'}</p>
                                </div>
                                {employee.employment.schedule && (
                                    <div>
                                        <p className="text-gray-600">Horario</p>
                                        <p className="font-semibold">
                                            {employee.employment.schedule.start} - {employee.employment.schedule.end}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-gray-600">Días de la semana</p>
                                    <p className="font-semibold">
                                        {employee.employment.schedule?.daysOfWeek.length || 5} días
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Alertas/Badges */}
                    <div className="flex flex-wrap gap-3">
                        {metrics.attendanceScore >= 95 && (
                            <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                                <Award className="w-4 h-4" />
                                Puntualidad Excelente
                            </div>
                        )}
                        {metrics.totalSales > 500000 && (
                            <div className="flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
                                <TrendingUp className="w-4 h-4" />
                                Top Vendedor
                            </div>
                        )}
                        {metrics.missedShifts > 10 && (
                            <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium">
                                <AlertCircle className="w-4 h-4" />
                                Revisar Asistencia
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 rounded-b-3xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
