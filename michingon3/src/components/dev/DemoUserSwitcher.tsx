'use client';

import { useState } from 'react';
import { Users, ChevronDown, Crown, Briefcase, DollarSign, Package, User } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// SWITCHER DE USUARIOS DEMO (Solo en desarrollo)
// Permite cambiar entre diferentes usuarios demo sin FaceID
// ═══════════════════════════════════════════════════════════════

interface DemoUser {
    uid: string;
    name: string;
    email: string;
    role: 'owner' | 'manager' | 'cashier' | 'inventory' | 'staff' | 'analyst';
    icon: any;
    color: string;
}

const DEMO_USERS: DemoUser[] = [
    {
        uid: 'demo-owner',
        name: 'Carlos Dueño',
        email: 'owner@demo.michingon.com',
        role: 'owner',
        icon: Crown,
        color: 'bg-red-500'
    },
    {
        uid: 'demo-cashier-juan',
        name: 'Juan Pérez (Cajero)',
        email: 'juan@demo.michingon.com',
        role: 'cashier',
        icon: DollarSign,
        color: 'bg-cyan-500'
    },
    {
        uid: 'demo-cashier-maria',
        name: 'María García (Cajera)',
        email: 'maria@demo.michingon.com',
        role: 'cashier',
        icon: DollarSign,
        color: 'bg-cyan-500'
    },
    {
        uid: 'demo-inventory-pedro',
        name: 'Pedro Martínez (Almacén)',
        email: 'pedro@demo.michingon.com',
        role: 'inventory',
        icon: Package,
        color: 'bg-green-500'
    },
    {
        uid: 'demo-staff-luis',
        name: 'Luis Rodríguez (Empleado)',
        email: 'luis@demo.michingon.com',
        role: 'staff',
        icon: User,
        color: 'bg-gray-500'
    }
];

export function DemoUserSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<DemoUser>(DEMO_USERS[0]);

    const handleSwitchUser = async (user: DemoUser) => {
        console.log('🔄 Cambiando a usuario demo:', user.name);

        // TODO: Aquí harías el login automático con Firebase
        // Por ahora solo cambia el estado local
        setCurrentUser(user);
        setIsOpen(false);

        // Simular login
        alert(`✅ Cambiado a: ${user.name}\nRol: ${user.role}\n\n(Recarga la página para ver los cambios)`);
    };

    // Solo mostrar en desarrollo
    if (process.env.NODE_ENV === 'production') return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Botón flotante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all font-medium"
            >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline">DEMO: {currentUser.name.split(' ')[0]}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown de usuarios */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute bottom-16 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                            <h3 className="font-bold text-lg">🧪 Modo Demo</h3>
                            <p className="text-sm text-purple-100 mt-1">
                                Cambia entre usuarios sin FaceID
                            </p>
                        </div>

                        {/* Lista de usuarios */}
                        <div className="max-h-96 overflow-y-auto">
                            {DEMO_USERS.map((user) => {
                                const Icon = user.icon;
                                const isActive = user.uid === currentUser.uid;

                                return (
                                    <button
                                        key={user.uid}
                                        onClick={() => handleSwitchUser(user)}
                                        className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${isActive ? 'bg-purple-50' : ''
                                            }`}
                                    >
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-full ${user.color} flex items-center justify-center text-white flex-shrink-0`}>
                                            <Icon className="w-6 h-6" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-900">{user.name}</p>
                                                {isActive && (
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                                        Activo
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                            <p className="text-xs text-gray-400 uppercase mt-1">{user.role}</p>
                                        </div>

                                        {/* Checkmark */}
                                        {isActive && (
                                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200">
                            <p className="text-xs text-gray-500 text-center">
                                ⚠️ Solo visible en development mode
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
