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
import { useState } from 'react';

interface SidebarProps {
    businessId: string;
}

export function Sidebar({ businessId }: SidebarProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        'main': true,
        'operations': true,
        'finance': true,
        'management': true
    });

    const toggleGroup = (group: string) => {
        setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

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
                { name: 'Recetas', href: `/business/${businessId}/recipes`, emoji: '👨‍🍳', tutorialId: 'recipes' },
                { name: 'Caja (POS)', href: `/business/${businessId}/pos`, emoji: '🏪', tutorialId: 'pos' },
                { name: 'Clientes', href: `/business/${businessId}/clients`, emoji: '👥' },
                { name: 'Proveedores', href: `/business/${businessId}/suppliers`, emoji: '🚛' },
            ]
        },
        {
            id: 'finance',
            title: 'Finanzas',
            emoji: '💰',
            items: [
                { name: 'Rentabilidad', href: `/business/${businessId}/profitability`, emoji: '📈' },
                { name: 'Reportes', href: `/business/${businessId}/reports`, emoji: '📊' },
                { name: 'Flujo', href: `/business/${businessId}/cashflow`, emoji: '💸' },
                { name: 'Gastos', href: `/business/${businessId}/expenses`, emoji: '🧾' },
                { name: 'Facturación', href: `/business/${businessId}/invoicing`, emoji: '📑', tutorialId: 'invoicing' },
                { name: 'Impuestos', href: `/business/${businessId}/tax-guide`, emoji: '⚖️', tutorialId: 'tax-guide' },
            ]
        },
        {
            id: 'management',
            title: 'Gestión',
            emoji: '👔',
            items: [
                { name: 'Activos', href: `/business/${businessId}/assets`, emoji: '🏢' },
                { name: 'Nómina', href: `/business/${businessId}/payroll`, emoji: '👷' },
                { name: 'Cerebro (IA)', href: `/business/${businessId}/brain`, emoji: '🧠', tutorialId: 'brain' },
                { name: 'Configuración', href: `/business/${businessId}/settings`, emoji: '⚙️', tutorialId: 'settings' },
            ]
        }
    ];

    const handleLogout = async () => {
        await logOut();
    };

    return (
        <aside data-tutorial="sidebar" className="w-64 bg-[#0f172a] text-slate-300 flex flex-col fixed h-full border-r border-slate-800/50 shadow-xl z-40 font-sans">
            {/* Business Selector / Brand */}
            <div className="p-5 border-b border-slate-800/50">
                <button className="w-full flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                            <Package className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="font-semibold text-sm text-white tracking-tight">Mi Negocio</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Enterprise</span>
                        </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {navigationGroups.map((group) => {
                    const isOpen = openGroups[group.id];

                    return (
                        <div key={group.id} className="space-y-1">
                            {group.title && (
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between px-3 py-3 text-xs uppercase tracking-widest font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 rounded-lg transition-colors group/header"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base filter drop-shadow-sm" role="img" aria-label={group.title}>
                                            {group.emoji}
                                        </span>
                                        <span>{group.title}</span>
                                    </div>
                                    <ChevronRight
                                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90 text-slate-300' : 'text-slate-500'}`}
                                    />
                                </button>
                            )}

                            <div className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                {group.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            data-tutorial={(item as any).tutorialId}
                                            className={`group flex items-center gap-4 px-3 py-3 rounded-xl text-base font-medium transition-all duration-200 relative ${isActive
                                                ? 'text-white bg-slate-800/80 shadow-md'
                                                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                                                }`}
                                        >
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                                            )}
                                            <span className="text-2xl filter drop-shadow-sm transition-transform group-hover:scale-110" role="img" aria-label={item.name}>
                                                {item.emoji}
                                            </span>
                                            <span className="tracking-wide">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-slate-800/50 bg-[#0f172a]">
                <div className="flex items-center gap-3 mb-3 px-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-900/20 ring-2 ring-[#0f172a]">
                        {user?.email?.[0].toUpperCase() || 'M'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">Mao</p>
                        <p className="text-slate-500 text-xs truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-all text-xs font-medium border border-transparent hover:border-red-500/20"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
