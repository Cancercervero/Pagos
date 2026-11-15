'use client';

import { UserProfile } from '@/types/user-types';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';

interface EmployeeCardProps {
    employee: UserProfile;
    onClick: () => void;
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
    const score = employee.performanceMetrics.overallScore;
    const fullStars = Math.floor(score / 20);
    const hasHalfStar = score % 20 >= 10;

    // Determinar color del badge según rol
    const roleColors = {
        owner: 'bg-purple-100 text-purple-800 border-purple-300',
        manager: 'bg-blue-100 text-blue-800 border-blue-300',
        cashier: 'bg-green-100 text-green-800 border-green-300',
        inventory: 'bg-orange-100 text-orange-800 border-orange-300',
        staff: 'bg-gray-100 text-gray-800 border-gray-300',
        analyst: 'bg-pink-100 text-pink-800 border-pink-300',
    };

    const roleLabels = {
        owner: '👑 Dueño',
        manager: '👔 Gerente',
        cashier: '💰 Cajero',
        inventory: '📦 Inventario',
        staff: '👤 Personal',
        analyst: '📊 Analista',
    };

    return (
        <button
            onClick={onClick}
            className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 p-6 border-2 border-gray-100 hover:border-purple-300 hover:-translate-y-2 cursor-pointer w-full"
        >
            {/* Badge de rol */}
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold border-2 ${roleColors[employee.role]}`}>
                {roleLabels[employee.role]}
            </div>

            {/* Foto */}
            <div className="flex flex-col items-center mb-4">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-200 group-hover:border-purple-400 transition-colors">
                        <img
                            src={employee.photoUrl || `https://i.pravatar.cc/150?u=${employee.uid}`}
                            alt={employee.fullName}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {/* Indicador activo */}
                    {employee.isActive && (
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
                    )}
                </div>
            </div>

            {/* Nombre */}
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1 group-hover:text-purple-600 transition-colors">
                {employee.fullName}
            </h3>

            {/* Posición */}
            <p className="text-sm text-gray-600 text-center mb-3">
                {employee.employment?.position || 'Sin cargo'}
            </p>

            {/* Score con estrellas */}
            <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        className={`w-5 h-5 ${i < fullStars
                                ? 'fill-yellow-400 text-yellow-400'
                                : i === fullStars && hasHalfStar
                                    ? 'fill-yellow-200 text-yellow-400'
                                    : 'fill-gray-200 text-gray-300'
                            }`}
                    />
                ))}
            </div>

            {/* Score numérico */}
            <div className="text-center mb-4">
                <span className="text-2xl font-bold text-purple-600">{score}</span>
                <span className="text-sm text-gray-500">/100</span>
            </div>

            {/* Stats rápidas */}
            <div className="grid grid-cols-2 gap-3 text-center">
                {/* Ventas o tareas según rol */}
                {(employee.role === 'cashier' || employee.role === 'manager') && (
                    <>
                        <div className="bg-purple-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Ventas</p>
                            <p className="text-sm font-bold text-purple-600">
                                ${(employee.performanceMetrics.totalSales / 1000).toFixed(0)}k
                            </p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Ticket Prom</p>
                            <p className="text-sm font-bold text-blue-600">
                                ${employee.performanceMetrics.avgTicket}
                            </p>
                        </div>
                    </>
                )}

                {/* Asistencia siempre */}
                <div className={`bg-green-50 rounded-lg p-2 ${employee.role === 'cashier' || employee.role === 'manager' ? 'col-span-2' : ''}`}>
                    <p className="text-xs text-gray-600">Asistencia</p>
                    <p className="text-sm font-bold text-green-600">
                        {employee.performanceMetrics.attendanceScore}%
                    </p>
                </div>

                {/* Tareas para otros roles */}
                {employee.role !== 'cashier' && employee.role !== 'manager' && (
                    <div className="bg-orange-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">Tareas</p>
                        <p className="text-sm font-bold text-orange-600">
                            {employee.performanceMetrics.tasksCompleted}
                        </p>
                    </div>
                )}
            </div>

            {/* Tendencia */}
            <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-center gap-1 text-xs">
                    {score >= 80 ? (
                        <>
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-green-600 font-medium">Excelente</span>
                        </>
                    ) : score >= 60 ? (
                        <>
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <span className="text-blue-600 font-medium">Bueno</span>
                        </>
                    ) : (
                        <>
                            <TrendingDown className="w-4 h-4 text-orange-500" />
                            <span className="text-orange-600 font-medium">Mejorable</span>
                        </>
                    )}
                </div>
            </div>
        </button>
    );
}
