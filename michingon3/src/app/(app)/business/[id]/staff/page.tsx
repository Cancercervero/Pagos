'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    Users,
    UserPlus,
    Crown,
    Briefcase,
    DollarSign,
    Clock,
    TrendingUp,
    Award,
    MoreVertical,
    Mail,
    Phone,
    Calendar,
    AlertCircle
} from 'lucide-react';
import InviteEmployeeModal from '@/components/workforce/InviteEmployeeModal';
import { UserProfile } from '@/types/user-types';
import { ROLE_METADATA, getRoleLevel } from '@/types/auth-types';
import { formatCurrency } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// PÁGINA: GESTIÓN DE EMPLEADOS
// Solo accesible para Owner y Manager
// ═══════════════════════════════════════════════════════════════

export default function StaffPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { userProfile, hasPermission } = useAuth();
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const businessId = params.id;

    // Verificar permisos
    useEffect(() => {
        if (!userProfile) return;

        // TEMPORAL: Comentado mientras se configura el sistema de permisos
        // if (!hasPermission('manage_staff') && !hasPermission('view_staff')) {
        //     // No tiene permiso, redirect
        //     router.push(`/business/${params.id}`);
        // }
    }, [userProfile, hasPermission, router, params.id]);

    // Cargar empleados
    useEffect(() => {
        const loadEmployees = async () => {
            try {
                setLoading(true);

                // TODO: Cargar de Firestore
                // const employeesQuery = query(
                //   collection(db, 'users'),
                //   where('businessId', '==', params.id)
                // );
                // const snapshot = await getDocs(employeesQuery);
                // ...

                // Datos de ejemplo
                const mockEmployees: Partial<UserProfile>[] = [
                    {
                        uid: '1',
                        fullName: 'Juan Pérez',
                        email: 'juan@ejemplo.com',
                        phone: '5512345678',
                        role: 'cashier',
                        isActive: true,
                        photoUrl: undefined,
                        performanceMetrics: {
                            totalSales: 45000,
                            transactions: 120,
                            avgTicket: 375,
                            bestSaleAmount: 2500,
                            attendanceScore: 95,
                            totalShifts: 20,
                            lateArrivals: 1,
                            onTimeArrivals: 19,
                            missedShifts: 0,
                            tasksCompleted: 45,
                            lastActive: new Date(),
                            accountAge: 30,
                            overallScore: 92,
                            productsAdded: 0,
                            stockUpdates: 0,
                            suppliersManaged: 0
                        },
                        biometricCredentials: [],
                        prefersBiometric: false,
                        needsPasswordReset: false,
                        notificationSettings: {
                            emailNotifications: true,
                            pushNotifications: true,
                            smsNotifications: false,
                            notifyOnSale: false,
                            notifyOnLowStock: true,
                            notifyOnPayroll: true
                        },
                        employment: {
                            hireDate: new Date('2024-01-15'),
                            position: 'Cajero Principal',
                            contractType: 'full_time',
                            salary: 10000
                        },
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];

                setEmployees(mockEmployees as UserProfile[]);
            } catch (error) {
                console.error('Error cargando empleados:', error);
            } finally {
                setLoading(false);
            }
        };

        loadEmployees();
    }, [params.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600">Cargando empleados...</p>
                </div>
            </div>
        );
    }

    // Ordenar por rol (jerarquía)
    const sortedEmployees = [...employees].sort((a, b) =>
        getRoleLevel(a.role) - getRoleLevel(b.role)
    );

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-600" />
                        Equipo de Trabajo
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona tu personal y monitorea su productividad
                    </p>
                    {/* Diagnostic labels in dev */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-2 flex gap-2">
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">Role: {userProfile?.role}</span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">Can Manage: {hasPermission('manage_staff') ? 'Yes' : 'No'}</span>
                        </div>
                    )}
                </div>

                {(hasPermission('manage_staff') || userProfile?.role === 'owner') && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-3 shadow-lg hover:shadow-indigo-500/20"
                    >
                        <UserPlus className="w-6 h-6" />
                        <span className="text-lg">Invitar Empleado</span>
                    </button>
                )}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Empleados</p>
                            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Activos Hoy</p>
                            <p className="text-2xl font-bold text-green-600">
                                {employees.filter(e => e.isActive).length}
                            </p>
                        </div>
                        <Clock className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Score Promedio</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {Math.round(
                                    employees.reduce((sum, e) => sum + (e.performanceMetrics?.overallScore || 0), 0) /
                                    employees.length
                                )}%
                            </p>
                        </div>
                        <Award className="w-8 h-8 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Nómina Mensual</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {formatCurrency(
                                    employees.reduce((sum, e) => sum + (e.employment?.salary || 0), 0)
                                )}
                            </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Employees List */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Empleado
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ventas Totales
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Score
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Asistencia
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sortedEmployees.map((employee) => {
                                const roleMetadata = ROLE_METADATA[employee.role];
                                const metrics = employee.performanceMetrics;

                                return (
                                    <tr key={employee.uid} className="hover:bg-gray-50 transition-colors">
                                        {/* Empleado */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                                                    {employee.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{employee.fullName}</p>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                                        <Mail className="w-3 h-3" />
                                                        {employee.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Rol */}
                                        <td className="px-6 py-4">
                                            <div
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                                                style={{
                                                    backgroundColor: `${roleMetadata.color}15`,
                                                    color: roleMetadata.color
                                                }}
                                            >
                                                <span>{roleMetadata.icon}</span>
                                                {roleMetadata.name}
                                            </div>
                                        </td>

                                        {/* Ventas */}
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {formatCurrency(metrics?.totalSales || 0)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {metrics?.transactions || 0} tickets
                                                </p>
                                            </div>
                                        </td>

                                        {/* Score */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                                                    <div
                                                        className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                                                        style={{ width: `${metrics?.overallScore || 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {metrics?.overallScore || 0}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* Asistencia */}
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {metrics?.attendanceScore || 0}%
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {metrics?.lateArrivals || 0} retardos
                                                </p>
                                            </div>
                                        </td>

                                        {/* Estado */}
                                        <td className="px-6 py-4">
                                            {employee.isActive ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                                    Inactivo
                                                </span>
                                            )}
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                                <MoreVertical className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sin empleados */}
            {employees.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No hay empleados registrados
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Invita a tu primer empleado para empezar a gestionar tu equipo
                    </p>
                    {hasPermission('manage_staff') && (
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                        >
                            Invitar Empleado
                        </button>
                    )}
                </div>
            )}

            {/* Modal de Invitación */}
            <InviteEmployeeModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                businessId={businessId}
                businessName={"Mi Negocio"}
                currentUser={{
                    uid: userProfile?.uid || '',
                    displayName: userProfile?.fullName || null,
                    email: userProfile?.email || null
                }}
            />
        </div>
    );
}
