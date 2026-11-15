'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Check,
    Calendar,
    DollarSign,
    Clock,
    User,
    Mail,
    Phone,
    MapPin,
    FileText,
    Calculator
} from 'lucide-react';

export default function PayrollPage() {
    const { employees } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showPayrollModal, setShowPayrollModal] = useState(false);
    const [showBenefitsModal, setShowBenefitsModal] = useState(false);
    const [benefitsTab, setBenefitsTab] = useState<'aguinaldo' | 'ptu'>('aguinaldo');
    const [aguinaldoCalculated, setAguinaldoCalculated] = useState(false);
    const [ptuAmount, setPtuAmount] = useState('0');
    const [ptuCalculated, setPtuCalculated] = useState(false);
    const [payrollStartDate, setPayrollStartDate] = useState(new Date(2025, 11, 1));
    const [payrollEndDate, setPayrollEndDate] = useState(new Date(2025, 11, 15));
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Mock attendance data
    const todayAttendance = [
        { employeeId: 'emp-1', name: 'Juan Pérez', role: 'Carnicero Principal', status: 'present', vacationDays: 14, absences: 0 },
        { employeeId: 'emp-2', name: 'Ana García', role: 'Cajera / Ayudante', status: 'present', vacationDays: 12, absences: 0 }
    ];

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

    // Payroll calculations
    const calculatePayroll = () => {
        setShowPayrollModal(true);
    };

    // Benefits calculations
    const aguinaldoData = [
        { employee: 'Juan Pérez', daysToPay: 15.00, amount: 6000.00 },
        { employee: 'Ana García', daysToPay: 11.01, amount: 3120.55 }
    ];

    const ptuData = [
        { employee: 'Juan Pérez', bySalary: 0.29, byDays: 0.25, total: 0.54 },
        { employee: 'Ana García', bySalary: 0.21, byDays: 0.25, total: 0.46 }
    ];

    const payrollData = [
        {
            employee: 'Juan Pérez',
            daysWorked: 13,
            absences: 0,
            grossSalary: 5200.00,
            deductions: 552.76,
            netSalary: 4647.24
        },
        {
            employee: 'Ana García',
            daysWorked: 13,
            absences: 0,
            grossSalary: 3683.33,
            deductions: 345.28,
            netSalary: 3338.05
        }
    ];

    const totals = {
        grossSalary: payrollData.reduce((sum, p) => sum + p.grossSalary, 0),
        deductions: payrollData.reduce((sum, p) => sum + p.deductions, 0),
        netSalary: payrollData.reduce((sum, p) => sum + p.netSalary, 0)
    };

    const aguinaldoTotal = aguinaldoData.reduce((sum, a) => sum + a.amount, 0);
    const ptuTotal = ptuData.reduce((sum, p) => sum + p.total, 0);

    const [newEmployee, setNewEmployee] = useState({
        name: '',
        role: '',
        hireDate: new Date().toISOString().split('T')[0],
        phone: '',
        email: '',
        address: '',
        salary: '',
        vacationDays: '0'
    });

    const handleAddEmployee = async () => {
        if (!newEmployee.name || !newEmployee.email || !newEmployee.role || !newEmployee.salary) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        try {
            await useData().addEmployee({
                name: newEmployee.name,
                email: newEmployee.email,
                role: newEmployee.role,
                salary: Number(newEmployee.salary),
                hireDate: new Date(newEmployee.hireDate),
                status: 'active'
            });

            setShowEmployeeModal(false);
            setNewEmployee({
                name: '',
                role: '',
                hireDate: new Date().toISOString().split('T')[0],
                phone: '',
                email: '',
                address: '',
                salary: '',
                vacationDays: '0'
            });
            alert('Empleado agregado exitosamente');
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('Error al agregar empleado');
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">👷 Nómina y Recursos Humanos</h1>
                    <p className="text-gray-500 text-sm mt-1">Gestiona tu equipo, asistencias y pagos</p>
                </div>
                <button
                    onClick={() => setShowEmployeeModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Empleado
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm">Nómina Mensual</span>
                        <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(22000)}</p>
                    <p className="text-xs text-gray-500 mt-1">Estimado</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm">Empleados Activos</span>
                        <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{todayAttendance.length}</p>
                    <p className="text-xs text-gray-500 mt-1">En plantilla</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm">Asistencia Hoy</span>
                        <Check className="w-5 h-5 text-teal-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {todayAttendance.filter(e => e.status === 'present').length}/{todayAttendance.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Presentes</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm">Próximo Pago</span>
                        <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">15 Ene</p>
                    <p className="text-xs text-gray-500 mt-1">Quincenal</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calendario de Asistencia */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Calendario de Asistencia</h2>
                    <p className="text-sm text-gray-500 mb-6">Marca o modifica las asistencias del mes.</p>

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-medium text-gray-900 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full transition">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full transition">
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

                    <div className="grid grid-cols-7 gap-1">
                        {paddingDays.map((_, i) => (
                            <div key={`padding-${i}`} />
                        ))}

                        {daysInMonth.map((day) => {
                            const isToday = isSameDay(day, new Date());
                            const isPast = day < new Date();

                            return (
                                <button
                                    key={day.toString()}
                                    className={`
                                        h-10 w-full flex items-center justify-center rounded text-sm transition relative
                                        ${isToday ? 'bg-teal-500 text-white font-bold' :
                                            isPast ? 'bg-green-50 text-gray-700' :
                                                'hover:bg-gray-100 text-gray-700'}
                                    `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-100 rounded"></div>
                            <span className="text-gray-600">Asistió</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-100 rounded"></div>
                            <span className="text-gray-600">Falta</span>
                        </div>
                    </div>
                </div>

                {/* Panel de Acciones */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Asistencia de Hoy */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Asistencia de Hoy</h2>
                        <div className="space-y-3">
                            {todayAttendance.map((employee) => (
                                <div key={employee.employeeId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                            <span className="text-teal-700 font-bold text-sm">
                                                {employee.name.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{employee.name}</p>
                                            <p className="text-xs text-gray-500">{employee.role}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Vacaciones</p>
                                            <p className="text-sm font-medium text-gray-900">{employee.vacationDays} días</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'present'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {employee.status === 'present' ? '✓ Presente' : '✗ Falta'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={calculatePayroll}
                            className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition group text-left"
                        >
                            <Calculator className="w-8 h-8 text-teal-600 mb-3" />
                            <h3 className="font-semibold text-gray-900 group-hover:text-teal-700">
                                Calcular Prenómina
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Genera reporte quincenal
                            </p>
                        </button>

                        <button
                            onClick={() => setShowBenefitsModal(true)}
                            className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group text-left"
                        >
                            <DollarSign className="w-8 h-8 text-blue-600 mb-3" />
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                                Prestaciones
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Aguinaldo y PTU
                            </p>
                        </button>

                        <button
                            className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition group text-left"
                        >
                            <FileText className="w-8 h-8 text-purple-600 mb-3" />
                            <h3 className="font-semibold text-gray-900 group-hover:text-purple-700">
                                Reportes
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Historial y análisis
                            </p>
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Employee Modal */}
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Añadir Nuevo Empleado</h2>
                                <p className="text-sm text-gray-500">Registra un nuevo empleado con toda su información.</p>
                            </div>
                            <button onClick={() => setShowEmployeeModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.name}
                                        onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.role}
                                        onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Contratación</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.hireDate}
                                        onChange={e => setNewEmployee({ ...newEmployee, hireDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.phone}
                                        onChange={e => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.email}
                                        onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.address}
                                        onChange={e => setNewEmployee({ ...newEmployee, address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Mensual</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.salary}
                                        onChange={e => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Días de Vacaciones</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        value={newEmployee.vacationDays}
                                        onChange={e => setNewEmployee({ ...newEmployee, vacationDays: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowEmployeeModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button onClick={handleAddEmployee} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                                Guardar Empleado
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Report Modal */}
            {showPayrollModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Reporte de Prenómina Quincenal</h2>
                                <p className="text-sm text-gray-500">Selecciona un período para calcular la prenómina basada en la asistencia registrada. Esto te dará un estimado de los pagos a realizar.</p>
                            </div>
                            <button onClick={() => setShowPayrollModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="mb-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm">{format(payrollStartDate, 'd MMM', { locale: es })} - {format(payrollEndDate, 'd MMM, yyyy', { locale: es })}</span>
                                    </div>
                                    <button
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                                    >
                                        Generar Reporte
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Empleado</th>
                                            <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Días Trab.</th>
                                            <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Faltas</th>
                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Sueldo Bruto</th>
                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Deducciones</th>
                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Sueldo Neto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payrollData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="py-3 px-2 text-sm font-medium text-gray-900">{row.employee}</td>
                                                <td className="py-3 px-2 text-sm text-gray-600 text-center">{row.daysWorked}</td>
                                                <td className="py-3 px-2 text-sm text-red-600 text-center">{row.absences}</td>
                                                <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(row.grossSalary)}</td>
                                                <td className="py-3 px-2 text-sm text-gray-600 text-right">{formatCurrency(row.deductions)}</td>
                                                <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(row.netSalary)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 font-bold">
                                            <td className="py-3 px-2 text-sm text-gray-900">Totales</td>
                                            <td className="py-3 px-2"></td>
                                            <td className="py-3 px-2"></td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">{formatCurrency(totals.grossSalary)}</td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">{formatCurrency(totals.deductions)}</td>
                                            <td className="py-3 px-2 text-sm text-gray-900 text-right">{formatCurrency(totals.netSalary)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6 p-4 bg-teal-50 border border-teal-100 rounded-lg">
                                <p className="text-sm font-medium text-gray-700 mb-1">Costo Total para la Empresa en este período:</p>
                                <p className="text-3xl font-bold text-teal-600">{formatCurrency(totals.netSalary)}</p>
                                <p className="text-xs text-gray-500 mt-1">(Sueldo Bruto + Aportaciones Patronales)</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Annual Benefits Modal */}
            {showBenefitsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Cálculo de Prestaciones Anuales</h2>
                                <p className="text-sm text-gray-500">Calcula el Aguinaldo y el Reparto de Utilidades (PTU) para tu equipo.</p>
                            </div>
                            <button onClick={() => setShowBenefitsModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 shrink-0">
                            <button
                                onClick={() => {
                                    setBenefitsTab('aguinaldo');
                                    setAguinaldoCalculated(false);
                                }}
                                className={`flex-1 px-6 py-3 text-sm font-medium transition ${benefitsTab === 'aguinaldo'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Aguinaldo
                            </button>
                            <button
                                onClick={() => {
                                    setBenefitsTab('ptu');
                                    setPtuCalculated(false);
                                }}
                                className={`flex-1 px-6 py-3 text-sm font-medium transition ${benefitsTab === 'ptu'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Utilidades (PTU)
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            {benefitsTab === 'aguinaldo' && (
                                <div>
                                    <div className="mb-6">
                                        <h3 className="font-bold text-gray-900 mb-2">Cálculo de Aguinaldo</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Se calcula automáticamente con base en 15 días de salario, proporcional a los días trabajados en el año por cada empleado.
                                        </p>
                                        <button
                                            onClick={() => setAguinaldoCalculated(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                                        >
                                            <Calculator className="w-4 h-4" />
                                            Calcular Aguinaldo
                                        </button>
                                    </div>

                                    {aguinaldoCalculated && (
                                        <>
                                            <div className="overflow-x-auto mb-6">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-gray-200">
                                                            <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Empleado</th>
                                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Días a Pagar</th>
                                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Monto</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {aguinaldoData.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                <td className="py-3 px-2 text-sm font-medium text-gray-900">{row.employee}</td>
                                                                <td className="py-3 px-2 text-sm text-gray-600 text-right">{row.daysToPay.toFixed(2)}</td>
                                                                <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(row.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg">
                                                <p className="text-sm font-medium text-gray-700 mb-1">Total a Pagar de Aguinaldo</p>
                                                <p className="text-3xl font-bold text-teal-600">{formatCurrency(aguinaldoTotal)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {benefitsTab === 'ptu' && (
                                <div>
                                    <div className="mb-6">
                                        <h3 className="font-bold text-gray-900 mb-2">Reparto de Utilidades (PTU)</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            El sistema sugiere el 10% de la ganancia neta del año anterior. Puedes ajustar este monto si tu utilidad fiscal es diferente.
                                        </p>

                                        {!ptuCalculated && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Monto Sugerido a Repartir (Editable)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={ptuAmount}
                                                    onChange={(e) => setPtuAmount(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-4"
                                                />
                                                <button
                                                    onClick={() => setPtuCalculated(true)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                                                >
                                                    <Calculator className="w-4 h-4" />
                                                    Calcular PTU
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {ptuCalculated && (
                                        <>
                                            <div className="overflow-x-auto mb-6">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-gray-200">
                                                            <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Empleado</th>
                                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Por Salario</th>
                                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Por Días</th>
                                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Total a Recibir</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {ptuData.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                <td className="py-3 px-2 text-sm font-medium text-gray-900">{row.employee}</td>
                                                                <td className="py-3 px-2 text-sm text-gray-600 text-right">{formatCurrency(row.bySalary)}</td>
                                                                <td className="py-3 px-2 text-sm text-gray-600 text-right">{formatCurrency(row.byDays)}</td>
                                                                <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(row.total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg">
                                                <p className="text-sm font-medium text-gray-700 mb-1">Total Repartido</p>
                                                <p className="text-3xl font-bold text-teal-600">{formatCurrency(ptuTotal)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
