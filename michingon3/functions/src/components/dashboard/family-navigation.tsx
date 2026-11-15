'use client';

import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { BUSINESS_FAMILIES, BUSINESS_TYPES, BusinessFamily, getBusinessTypesByFamily } from '@/types/business-types';

// ═══════════════════════════════════════════════════════════════
// FAMILY NAVIGATION COMPONENT
// ═══════════════════════════════════════════════════════════════

interface FamilyNavigationProps {
    currentFamily?: BusinessFamily;
    currentType?: string;
    onFamilyChange?: (family: BusinessFamily) => void;
    onTypeChange?: (type: string) => void;
}

export function FamilyNavigation({
    currentFamily,
    currentType,
    onFamilyChange,
    onTypeChange
}: FamilyNavigationProps) {
    const [selectedFamily, setSelectedFamily] = useState<BusinessFamily | null>(currentFamily || null);

    const handleFamilySelect = (family: BusinessFamily) => {
        setSelectedFamily(family);
        onFamilyChange?.(family);
    };

    const families = Object.values(BUSINESS_FAMILIES);

    return (
        <div className="space-y-6">
            {/* Family Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {families.map((family) => (
                    <button
                        key={family.id}
                        onClick={() => handleFamilySelect(family.id)}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group overflow-hidden ${selectedFamily === family.id
                                ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-emerald-50 shadow-lg shadow-teal-100 scale-[1.02]'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                            }`}
                    >
                        {/* Background decoration */}
                        <div className={`absolute -right-4 -bottom-4 text-8xl opacity-10 transition-transform group-hover:scale-110 ${selectedFamily === family.id ? 'opacity-20' : ''
                            }`}>
                            {family.emoji}
                        </div>

                        <span className="text-4xl mb-3 block relative z-10">{family.emoji}</span>
                        <h3 className={`font-bold text-lg relative z-10 ${selectedFamily === family.id ? 'text-teal-700' : 'text-gray-900'
                            }`}>
                            {family.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 relative z-10">{family.description}</p>

                        {/* Active indicator */}
                        {selectedFamily === family.id && (
                            <div className="absolute top-3 right-3 w-3 h-3 bg-teal-500 rounded-full animate-pulse" />
                        )}
                    </button>
                ))}
            </div>

            {/* Type Carousel */}
            {selectedFamily && (
                <FamilyCarousel
                    family={selectedFamily}
                    currentType={currentType}
                    onTypeSelect={onTypeChange}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// FAMILY CAROUSEL COMPONENT
// ═══════════════════════════════════════════════════════════════

interface FamilyCarouselProps {
    family: BusinessFamily;
    currentType?: string;
    onTypeSelect?: (type: string) => void;
}

export function FamilyCarousel({ family, currentType, onTypeSelect }: FamilyCarouselProps) {
    const [scrollPosition, setScrollPosition] = useState(0);
    const types = getBusinessTypesByFamily(family);
    const familyInfo = BUSINESS_FAMILIES[family];

    const scroll = (direction: 'left' | 'right') => {
        const container = document.getElementById(`carousel-${family}`);
        if (container) {
            const scrollAmount = 300;
            const newPosition = direction === 'left'
                ? Math.max(0, scrollPosition - scrollAmount)
                : scrollPosition + scrollAmount;

            container.scrollTo({ left: newPosition, behavior: 'smooth' });
            setScrollPosition(newPosition);
        }
    };

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{familyInfo.emoji}</span>
                    <div>
                        <h3 className="font-bold text-gray-900">{familyInfo.name}</h3>
                        <p className="text-sm text-gray-500">{types.length} tipos de negocio</p>
                    </div>
                </div>

                {/* Navigation arrows */}
                <div className="flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Carousel */}
            <div
                id={`carousel-${family}`}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent scroll-smooth"
                style={{ scrollbarWidth: 'thin' }}
            >
                {types.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => onTypeSelect?.(type.id)}
                        className={`flex-shrink-0 w-40 p-4 rounded-xl border-2 text-left transition-all hover:shadow-lg ${currentType === type.id
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                    >
                        <span className="text-3xl mb-2 block">{type.emoji}</span>
                        <h4 className="font-semibold text-gray-900 text-sm">{type.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {type.features.slice(0, 2).join(', ')}
                        </p>
                    </button>
                ))}
            </div>

            {/* Gradient fade on edges */}
            <div className="absolute right-0 top-12 bottom-4 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD FAMILY GRID (Compact version for main dashboard)
// ═══════════════════════════════════════════════════════════════

interface DashboardFamilyGridProps {
    businessFamily?: BusinessFamily;
    businessType?: string;
}

export function DashboardFamilyGrid({ businessFamily, businessType }: DashboardFamilyGridProps) {
    const families = Object.values(BUSINESS_FAMILIES);
    const currentFamilyInfo = businessFamily ? BUSINESS_FAMILIES[businessFamily] : null;
    const currentTypeInfo = businessType ? BUSINESS_TYPES[businessType as keyof typeof BUSINESS_TYPES] : null;

    return (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white mb-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold">Tu Negocio</h2>
                    {currentTypeInfo ? (
                        <p className="text-slate-400 flex items-center gap-2 mt-1">
                            <span className="text-xl">{currentTypeInfo.emoji}</span>
                            {currentTypeInfo.name}
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500">{currentFamilyInfo?.name}</span>
                        </p>
                    ) : (
                        <p className="text-slate-400 text-sm">Selecciona tu tipo de negocio</p>
                    )}
                </div>

                {currentTypeInfo && (
                    <div className="text-6xl opacity-30">
                        {currentTypeInfo.emoji}
                    </div>
                )}
            </div>

            {/* Quick access to families */}
            <div className="grid grid-cols-4 gap-3">
                {families.map((family) => (
                    <div
                        key={family.id}
                        className={`p-4 rounded-xl text-center transition-all cursor-pointer ${businessFamily === family.id
                                ? 'bg-teal-500/20 border border-teal-500/50'
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                            }`}
                    >
                        <span className="text-2xl block mb-1">{family.emoji}</span>
                        <span className="text-xs font-medium text-slate-300">{family.name}</span>
                    </div>
                ))}
            </div>

            {/* Features for current type */}
            {currentTypeInfo && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                    <p className="text-sm text-slate-400 mb-3">Funcionalidades activas:</p>
                    <div className="flex flex-wrap gap-2">
                        {currentTypeInfo.features.map((feature) => (
                            <span
                                key={feature}
                                className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-medium rounded-full"
                            >
                                {getFeatureEmoji(feature)} {feature}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to get emoji for features
function getFeatureEmoji(feature: string): string {
    const emojiMap: Record<string, string> = {
        'inventory': '📦',
        'pos': '💰',
        'orders': '📝',
        'invoicing': '🧾',
        'expenses': '💸',
        'clients': '👥',
        'suppliers': '🚛',
        'recipes': '👨‍🍳',
        'merma': '📉',
        'employees': '👷',
        'appointments': '📅',
        'services': '✂️',
        'production': '🏭'
    };
    return emojiMap[feature] || '✨';
}

export default FamilyNavigation;
