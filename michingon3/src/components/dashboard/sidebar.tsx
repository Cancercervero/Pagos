'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';
import {
    ChevronDown,
    LogOut,
    Package,
    ChevronRight
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUserBusinesses } from '@/hooks/useUserBusinesses';

interface SidebarProps {
    businessId: string;
}

export function Sidebar({ businessId }: SidebarProps) {
    const { user, userProfile } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { businesses, loading: loadingBusinesses } = useUserBusinesses(user?.uid);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };

        if (isUserDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isUserDropdownOpen]);

    const navigationGroups = [
        {
            id: 'main',
            title: 'Principal',
            emoji: '🚀',
            items: [
                { name: 'Inicio', href: `/business/${businessId}`, emoji: '🏠', tutorialId: 'dashboard-kpis' },
            ]
        },
        {
            id: 'operations',
            title: 'Operaciones',
            emoji: '⚙️',
            items: [
                { name: 'Pedidos', href: `/business/${businessId}/orders`, emoji: '📝' },
                { name: 'Inventario', href: `/business/${businessId}/inventory`, emoji: '📦', tutorialId: 'inventory' },
                { name: 'Cargar inventario', href: `/business/${businessId}/inventory/cargar`, emoji: '📥' },
                { name: 'Agente WhatsApp', href: `/business/${businessId}/whatsapp`, emoji: '💬' },
                { name: 'Recetas', href: `/business/${businessId}/recipes`, emoji: '👨‍🍳', tutorialId: 'recipes' },
                { name: 'Caja (POS)', href: `/business/${businessId}/pos`, emoji: '🏪', tutorialId: 'pos' },
            ]
        },
        {
            id: 'finance',
            title: 'Finanzas',
            emoji: '💰',
            items: [
                { name: 'Ventas', href: `/business/${businessId}/sales`, emoji: '💵' },
                { name: 'Facturación', href: `/business/${businessId}/invoicing`, emoji: '🧾', tutorialId: 'invoicing' },
            ]
        },
        {
            id: 'management',
            title: 'Gestión',
            emoji: '👥',
            items: [
                { name: 'Personal', href: `/business/${businessId}/staff`, emoji: '👔' },
                { name: 'Activos', href: `/business/${businessId}/assets`, emoji: '🏢' },
                { name: 'Nómina', href: `/business/${businessId}/payroll`, emoji: '👷' },
                { name: 'Configuración', href: `/business/${businessId}/settings`, emoji: '⚙️', tutorialId: 'settings' },
            ]
        }
    ];

    const handleLogout = async () => {
        await logOut();
    };

    const getRoleLabel = (role?: string) => {
        const roleMap: Record<string, { label: string; color: string }> = {
            'owner': { label: '👑 OWNER', color: 'text-yellow-400' },
            'admin': { label: '⚡ ADMIN', color: 'text-red-400' },
            'manager': { label: '📊 MANAGER', color: 'text-blue-400' },
            'cashier': { label: '💰 CAJERO', color: 'text-green-400' },
            'warehouse': { label: '📦 ALMACÉN', color: 'text-orange-400' },
            'staff': { label: '🔒 STAFF', color: 'text-slate-400' }
        };
        return roleMap[role || ''] || { label: '👤 USER', color: 'text-slate-400' };
    };

    const getRoleGradient = (role?: string) => {
        const gradients: Record<string, string> = {
            'owner': 'from-yellow-500 to-yellow-600',
            'admin': 'from-red-500 to-red-600',
            'manager': 'from-blue-500 to-blue-600',
            'cashier': 'from-green-500 to-green-600',
            'warehouse': 'from-orange-500 to-orange-600',
            'staff': 'from-slate-500 to-slate-600'
        };
        return gradients[role || ''] || 'from-blue-500 to-purple-600';
    };

    const roleInfo = getRoleLabel(userProfile?.role);
    const activeGroup = navigationGroups.find(g => g.id === hoveredGroupId);

    return (
        <>
            {/* Backdrop oscuro cuando dropdown está abierto */}
            {isUserDropdownOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
                    onClick={() => setIsUserDropdownOpen(false)}
                />
            )}

            <div
                className="fixed inset-y-0 left-0 z-40 flex pointer-events-none"
                onMouseLeave={() => setHoveredGroupId(null)}
            >
                {/* Thin Sidebar (Icon Bar) */}
                <aside
                    className="w-20 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-white/5 shadow-2xl font-sans pointer-events-auto relative z-50"
                >
                    <div className="p-4 border-b border-white/5 flex justify-center">
                        <button
                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                            className={`w-12 h-12 bg-gradient-to-br ${getRoleGradient(userProfile?.role)} rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-white/10 hover:ring-white/20 transition-all hover:scale-110 active:scale-95`}
                        >
                            <Package className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    <nav className="flex-1 py-6 flex flex-col items-center gap-4">
                        {navigationGroups.map((group) => (
                            <div
                                key={group.id}
                                onMouseEnter={() => setHoveredGroupId(group.id)}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl cursor-pointer transition-all duration-300 ${hoveredGroupId === group.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'hover:bg-white/5 text-slate-400'
                                    }`}
                            >
                                {group.emoji}
                            </div>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-white/5 flex justify-center">
                        <button onClick={handleLogout} className="w-12 h-12 rounded-2xl flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors">
                            <LogOut className="w-6 h-6" />
                        </button>
                    </div>
                </aside>

                {/* Fly-out Menu Panel (The "Mega Menu" style) */}
                <div
                    className={`h-full w-64 bg-slate-950/95 backdrop-blur-2xl border-r border-white/10 shadow-2xl transition-all duration-500 ease-out flex flex-col pointer-events-auto ${hoveredGroupId ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 scale-95 pointer-events-none'
                        }`}
                >
                    {activeGroup && (
                        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Panel Header */}
                            <div className="p-6 border-b border-white/5">
                                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1">
                                    {activeGroup.title}
                                </h3>
                                <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    Explorar {activeGroup.title.toLowerCase()} {activeGroup.emoji}
                                </p>
                            </div>

                            {/* Group Items */}
                            <div className="flex-1 p-4 space-y-2">
                                {activeGroup.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setHoveredGroupId(null)}
                                            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className={`text-xl transition-transform duration-300 group-hover:scale-110 ${isActive ? 'rotate-12' : ''}`}>
                                                {item.emoji}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold">{item.name}</span>
                                                <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
                                                    Gestión de {item.name.toLowerCase()}
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Footer del Panel */}
                            <div className="p-6 mt-auto bg-white/5 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getRoleGradient(userProfile?.role)} flex items-center justify-center flex-shrink-0 animate-pulse`}>
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{userProfile?.fullName || 'Administrador'}</p>
                                        <p className={`text-[9px] uppercase tracking-tighter font-bold ${roleInfo.color}`}>{roleInfo.label}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Dropdown Panel (Fly-out from the top identity box) */}
                {isUserDropdownOpen && (
                    <div
                        className="fixed left-24 top-4 w-72 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-3xl pointer-events-auto animate-in zoom-in-95 duration-200 overflow-hidden z-20"
                        ref={dropdownRef}
                    >
                        <div className="p-6 border-b border-white/10 bg-white/5">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Mis Negocios</p>

                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {loadingBusinesses ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        Cargando negocios...
                                    </div>
                                ) : businesses.map(business => {
                                    const isCurrent = business.id === businessId;
                                    return (
                                        <button
                                            key={business.id}
                                            onClick={() => {
                                                if (!isCurrent) router.push(`/business/${business.id}`);
                                                setIsUserDropdownOpen(false);
                                            }}
                                            className={`w-full p-3 rounded-2xl flex items-center gap-4 transition-all ${isCurrent ? 'bg-blue-600/20 ring-1 ring-blue-500/50' : 'hover:bg-white/5'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isCurrent ? 'from-blue-500 to-purple-600' : 'from-slate-700 to-slate-800'} flex items-center justify-center shadow-inner`}>
                                                <Package className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="text-left min-w-0 flex-1">
                                                <p className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-300'}`}>{business.name}</p>
                                                {isCurrent && <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Seleccionado</p>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => {
                                    router.push('/create-business');
                                    setIsUserDropdownOpen(false);
                                }}
                                className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-xl shadow-blue-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span>➕</span> Crear Nuevo Negocio
                            </button>
                        </div>
                        <div className="p-4 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-red-400 font-bold text-xs uppercase tracking-widest py-2">
                                <LogOut className="w-4 h-4" /> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
