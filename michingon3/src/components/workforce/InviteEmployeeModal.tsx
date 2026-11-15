'use client';

import { useState } from 'react';
import { X, Copy, Check, UserPlus, Send, Clock, MapPin } from 'lucide-react';
import { generateInvitationCode, generateWhatsAppMessage, calculateExpirationDate } from '@/types/invitation-types';

interface InviteEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    businessId: string;
    businessName: string;
    currentUser: {
        uid: string;
        displayName: string | null;
        email: string | null;
    };
}

interface FormData {
    fullName: string;
    phoneNumber: string;
    role: 'manager' | 'cashier' | 'inventory' | 'staff' | 'analyst';
    requiresGPS: boolean;
    gpsRadius: number;
    requiresSchedule: boolean;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'M' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 0, label: 'D' }
];

const ROLES = [
    { value: 'manager', label: 'Manager', desc: 'Acceso total excepto configuración' },
    { value: 'cashier', label: 'Cajero', desc: 'Ventas y facturación' },
    { value: 'inventory', label: 'Inventario', desc: 'Gestión de productos' },
    { value: 'staff', label: 'Personal', desc: 'Acceso básico' },
    { value: 'analyst', label: 'Analista', desc: 'Solo visualización y reportes' }
];

export default function InviteEmployeeModal({
    isOpen,
    onClose,
    businessId,
    businessName,
    currentUser
}: InviteEmployeeModalProps) {
    const [step, setStep] = useState<'form' | 'link'>('form');
    const [invitationLink, setInvitationLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        fullName: '',
        phoneNumber: '',
        role: 'staff',
        requiresGPS: false,
        gpsRadius: 100,
        requiresSchedule: false,
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00'
    });

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!formData.fullName || !formData.phoneNumber) {
            alert('Por favor completa nombre y teléfono');
            return;
        }

        setCreating(true);
        try {
            const code = generateInvitationCode();
            const expiresAt = calculateExpirationDate();

            const response = await fetch('/api/workforce/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    code,
                    invitedBy: currentUser.uid,
                    inviterName: currentUser.displayName || currentUser.email || 'Administrador',
                    employeeData: {
                        fullName: formData.fullName,
                        phoneNumber: formData.phoneNumber,
                        role: formData.role,
                        requireGPS: formData.requiresGPS,
                        requireSchedule: formData.requiresSchedule,
                        schedule: formData.requiresSchedule ? {
                            daysOfWeek: formData.daysOfWeek,
                            startTime: formData.startTime,
                            endTime: formData.endTime
                        } : undefined
                    },
                    expiresAt
                })
            });

            if (!response.ok) {
                throw new Error('Error al crear invitación');
            }

            const data = await response.json();
            setInvitationLink(data.link);
            setStep('link');
        } catch (error) {
            console.error('Error creating invitation:', error);
            alert('Error al crear invitación');
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(invitationLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        const message = generateWhatsAppMessage(
            formData.fullName,
            businessName,
            invitationLink
        );

        const phone = formData.phoneNumber.replace(/\s/g, '');
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };

    const toggleDay = (day: number) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...prev.daysOfWeek, day].sort()
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <UserPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Invitar Empleado</h2>
                            <p className="text-blue-100 text-sm">Sin email, solo FaceID</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {step === 'form' ? (
                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre Completo *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                        placeholder="Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Teléfono (WhatsApp) *
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                        placeholder="+52 123 456 7890"
                                    />
                                </div>
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Rol en el Negocio
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {ROLES.map(role => (
                                        <button
                                            key={role.value}
                                            onClick={() => setFormData({ ...formData, role: role.value as any })}
                                            className={`p-4 border-2 rounded-xl text-left transition ${formData.role === role.value
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="font-semibold text-gray-900">{role.label}</div>
                                            <div className="text-xs text-gray-500 mt-1">{role.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* GPS Restriction */}
                            <div className="border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-gray-600" />
                                        <span className="font-medium text-gray-900">Restricción de Ubicación</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.requiresGPS}
                                            onChange={(e) => setFormData({ ...formData, requiresGPS: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {formData.requiresGPS && (
                                    <p className="text-sm text-gray-500">
                                        El empleado solo podrá usar la app dentro de {formData.gpsRadius}m del negocio
                                    </p>
                                )}
                            </div>

                            {/* Schedule Restriction */}
                            <div className="border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-gray-600" />
                                        <span className="font-medium text-gray-900">Restricción de Horario</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.requiresSchedule}
                                            onChange={(e) => setFormData({ ...formData, requiresSchedule: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {formData.requiresSchedule && (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            {DAYS_OF_WEEK.map(day => (
                                                <button
                                                    key={day.value}
                                                    onClick={() => toggleDay(day.value)}
                                                    className={`flex-1 py-2 rounded-lg font-medium transition ${formData.daysOfWeek.includes(day.value)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Hora Inicio</label>
                                                <input
                                                    type="time"
                                                    value={formData.startTime}
                                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Hora Fin</label>
                                                <input
                                                    type="time"
                                                    value={formData.endTime}
                                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-green-900">¡Invitación Creada!</h3>
                                        <p className="text-sm text-green-700">Link generado para {formData.fullName}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Link de Invitación
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={invitationLink}
                                        readOnly
                                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                                    >
                                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-600" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleWhatsApp}
                                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
                            >
                                <Send className="w-5 h-5" />
                                Enviar por WhatsApp
                            </button>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                                <p className="font-medium mb-1">📌 Importante:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>El link expira en 7 días</li>
                                    <li>Solo se puede usar 1 vez</li>
                                    <li>El empleado registrará su rostro (FaceID)</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'form' && (
                    <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={creating || !formData.fullName || !formData.phoneNumber}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
                        >
                            {creating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    Crear Invitación
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
