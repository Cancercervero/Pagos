'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useData } from './DataContext';
import {
    BusinessFamily,
    BusinessType,
    BusinessFeature,
    BUSINESS_FAMILIES,
    BUSINESS_TYPES,
    getBusinessTypeConfig,
    hasFeature
} from '@/types/business-types';

// ═══════════════════════════════════════════════════════════════
// BUSINESS TYPE CONTEXT
// ═══════════════════════════════════════════════════════════════

interface BusinessTypeContextValue {
    // Current business classification
    businessFamily: BusinessFamily | null;
    businessType: BusinessType | null;

    // Configuration for current type
    config: ReturnType<typeof getBusinessTypeConfig> | null;

    // Feature checks
    hasFeature: (feature: BusinessFeature) => boolean;

    // Available options based on current type
    productUnits: string[];
    productCategories: string[];
    expenseCategories: string[];
    recipeFields: string[];

    // Helpers
    isOnboardingComplete: boolean;
    isTutorialComplete: boolean;

    // All families/types for selectors
    allFamilies: typeof BUSINESS_FAMILIES;
    allTypes: typeof BUSINESS_TYPES;
    getTypesByFamily: (family: BusinessFamily) => ReturnType<typeof getBusinessTypeConfig>[];
}

const BusinessTypeContext = createContext<BusinessTypeContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════

export function BusinessTypeProvider({ children }: { children: React.ReactNode }) {
    // Get current business from DataContext
    // Note: We'll need to add business info to DataContext
    const dataContext = useData();

    // For now, we'll use a placeholder - this will be replaced when we integrate
    const businessFamily = (dataContext as any).business?.businessFamily as BusinessFamily | undefined;
    const businessType = (dataContext as any).business?.businessType as BusinessType | undefined;
    const isOnboardingComplete = (dataContext as any).business?.onboardingCompleted ?? false;
    const isTutorialComplete = (dataContext as any).business?.tutorialCompleted ?? false;

    const value = useMemo<BusinessTypeContextValue>(() => {
        const config = businessType ? getBusinessTypeConfig(businessType) : null;

        return {
            businessFamily: businessFamily || null,
            businessType: businessType || null,
            config,

            hasFeature: (feature: BusinessFeature) => {
                if (!businessType) return false;
                return hasFeature(businessType, feature);
            },

            productUnits: config?.productUnits || ['pieza', 'kg', 'litro'],
            productCategories: config?.productCategories || ['General'],
            expenseCategories: config?.expenseCategories || ['Operación', 'Materiales', 'Servicios'],
            recipeFields: config?.recipeFields || [],

            isOnboardingComplete,
            isTutorialComplete,

            allFamilies: BUSINESS_FAMILIES,
            allTypes: BUSINESS_TYPES,

            getTypesByFamily: (family: BusinessFamily) => {
                return Object.values(BUSINESS_TYPES).filter(t => t.family === family);
            }
        };
    }, [businessFamily, businessType, isOnboardingComplete, isTutorialComplete]);

    return (
        <BusinessTypeContext.Provider value={value}>
            {children}
        </BusinessTypeContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useBusinessType() {
    const context = useContext(BusinessTypeContext);
    if (!context) {
        throw new Error('useBusinessType must be used within a BusinessTypeProvider');
    }
    return context;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE GATE COMPONENT
// ═══════════════════════════════════════════════════════════════

interface FeatureGateProps {
    feature: BusinessFeature;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Only renders children if the current business type has the specified feature
 * 
 * @example
 * <FeatureGate feature="recipes">
 *   <RecipesSection />
 * </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
    const { hasFeature } = useBusinessType();

    if (hasFeature(feature)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
