'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/types/user-types';
import { EmployeeCard } from '@/components/workforce/EmployeeCard';
import { EmployeeDetailModal } from '@/components/workforce/EmployeeDetailModal';
import { Users, Loader2 } from 'lucide-react';

export default function PersonalPage() {
    const params = useParams();
    const businessId = params.id as string;

    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);

    useEffect(() => {
        async function loadEmployees() {
            try {
                const q = query(
                    collection(db, 'users'),
                    where('businessId', '==', businessId),
                    where('isActive', '==', true)
                );

                const snapshot = await getDocs(q);
                const employeeData = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    uid: doc.id
                })) as UserProfile[];

                setEmployees(employeeData);
            } catch (error) {
                console.error('Error cargando empleados:', error);
            } finally {
                setLoading(false);
            }
        }

        if (businessId) {
            loadEmployees();
        }
    }, [businessId]);

    // Agrupar por jerarquía
    const groupedEmployees = {
        owner: employees.filter(e => e.role === 'owner'),
        manager: employees.filter(e => e.role === 'manager'),
        cashier: employees.filter(e => e.role === 'cashier'),
        inventory: employees.filter(e => e.role === 'inventory'),
        analyst: employees.filter(e => e.role === 'analyst'),
        staff: employees.filter(e => e.role === 'staff'),
    };

    const roleGroups = [
        { key: 'owner', label: '👑 Dueños', color: 'purple', employees: groupedEmployees.owner },
        { key: 'manager', label: '👔 Gerencia', color: 'blue', employees: groupedEmployees.manager },
        { key: 'cashier', label: '💰 Cajeros', color: 'green', employees: groupedEmployees.cashier },
        { key: 'inventory', label: '📦 Inventario', color: 'orange', employees: groupedEmployees.inventory },
        { key: 'analyst', label: '📊 Analistas', color: 'pink', employees: groupedEmployees.analyst },
        { key: 'staff', label: '👤 Personal', color: 'gray', employees: groupedEmployees.staff },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando personal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Personal</h1>
                    </div>
                    <p className="text-gray-600 ml-16">
                        {employees.length} {employees.length === 1 ? 'empleado activo' : 'empleados activos'}
                    </p>
                </div>

                {/* Groups por jerarquía */}
                <div className="space-y-8">
                    {roleGroups.map(group => {
                        if (group.employees.length === 0) return null;

                        return (
                            <div key={group.key} className="space-y-4">
                                {/* Título del grupo */}
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-gray-900">{group.label}</h2>
                                    <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-medium text-gray-700">
                                        {group.employees.length}
                                    </span>
                                </div>

                                {/* Grid de tarjetas */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {group.employees.map(employee => (
                                        <EmployeeCard
                                            key={employee.uid}
                                            employee={employee}
                                            onClick={() => setSelectedEmployee(employee)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Mensaje si no hay empleados */}
                {employees.length === 0 && (
                    <div className="text-center py-20">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">
                            No hay empleados registrados
                        </h3>
                        <p className="text-gray-500">
                            Invita a tu primer empleado desde la pestaña Staff
                        </p>
                    </div>
                )}
            </div>

            {/* Modal de detalle */}
            <EmployeeDetailModal
                employee={selectedEmployee}
                onClose={() => setSelectedEmployee(null)}
            />
        </div>
    );
}
