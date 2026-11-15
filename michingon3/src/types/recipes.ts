// TypeScript types for Michingon3 Recipe and Costing System
// Supports all business types: restaurants, salons, workshops, etc.

import { BusinessType } from './business-types';

// ═══════════════════════════════════════════════════════════════
// RECETA / FÓRMULA BASE
// ═══════════════════════════════════════════════════════════════

export interface Recipe {
    id: string;
    businessId: string;

    // Información básica
    name: string;
    description: string;
    code: string;                      // Código interno (TAC-001, TIN-002, etc.)
    category: string;

    // Rendimiento
    yield: number;                     // Cuántas unidades produce
    yieldUnit: string;                 // "tacos", "servicios", "piezas"

    // Ingredientes/Materiales
    ingredients: RecipeIngredient[];

    // Mano de obra
    laborSteps: LaborStep[];

    // Procedimiento
    procedure: string[];               // Pasos del procedimiento

    // Tiempos
    prepTime?: number;                 // Minutos de preparación
    cookTime?: number;                 // Minutos de cocción (restaurantes)
    applicationTime?: number;          // Minutos de aplicación (estéticas)
    totalTime: number;                 // Tiempo total en minutos

    // Dificultad
    difficulty: 'facil' | 'medio' | 'dificil';

    // Campos específicos por tipo de negocio
    specificFields?: {
        // Restaurante
        temperature?: number;            // Temperatura de cocción
        calories?: number;

        // Estética
        formula?: string;                // Fórmula del tinte
        developerVolume?: number;        // Volumen del oxidante (10, 20, 30, 40)
        toneLevel?: string;              // Nivel de tono

        // Panadería
        fermentationTime?: number;       // Tiempo de fermentación
        ovenTemp?: number;               // Temperatura del horno

        // Taller mecánico
        vehicleType?: string;
        partsRequired?: string[];
    };

    // Imágenes
    images: RecipeImage[];

    // Estado
    isActive: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface RecipeIngredient {
    id: string;
    productId?: string;                // Referencia al producto en inventario
    name: string;
    quantity: number;
    unit: string;                      // kg, g, ml, pieza, etc.

    // Costo (se calcula automáticamente si hay productId)
    unitCost?: number;                 // Costo por unidad
    totalCost?: number;                // Costo total de este ingrediente

    // Referencia a factura (para trazabilidad)
    invoiceRef?: string;
    invoiceDate?: Date;

    // Es sustituible
    substitutes?: string[];            // IDs de productos que pueden sustituirlo

    notes?: string;
}

export interface LaborStep {
    id: string;
    description: string;               // "Cortar la carne", "Aplicar tinte", etc.
    timeMinutes: number;               // Tiempo en minutos
    employeeRole?: string;             // "Cocinero", "Estilista", etc.
    hourlyRate?: number;               // Tarifa por hora (se jala de config)
    cost?: number;                     // Costo calculado de este paso
}

export interface RecipeImage {
    id: string;
    url: string;
    type: 'main' | 'step' | 'before' | 'after' | 'result';
    caption?: string;
    order: number;
}

// ═══════════════════════════════════════════════════════════════
// COSTEO PROFESIONAL (4 PILARES)
// ═══════════════════════════════════════════════════════════════

export interface CostingConfig {
    businessId: string;

    // Costos fijos mensuales (Infraestructura)
    fixedCosts: {
        rent: number;                    // Renta mensual
        electricity: number;             // Luz
        gas: number;                     // Gas
        water: number;                   // Agua
        internet: number;                // Internet/Teléfono
        insurance: number;               // Seguros
        other: number;                   // Otros gastos fijos
    };

    // Configuración de mano de obra
    labor: {
        averageHourlyRate: number;       // Tarifa promedio por hora
        workDaysPerMonth: number;        // Días laborales al mes
        hoursPerDay: number;             // Horas por día
    };

    // Configuración de almacenaje
    storage: {
        dailyCostPerUnit: number;        // Costo diario de almacenaje
        averageStorageDays: number;      // Días promedio en almacén
    };

    // Producción estimada
    production: {
        unitsPerMonth: number;           // Unidades producidas al mes
        fixedCostPerUnit?: number;       // Se calcula automático
    };

    updatedAt: Date;
}

export interface RecipeCostBreakdown {
    // 1. Insumos
    ingredients: {
        items: {
            name: string;
            quantity: number;
            unit: string;
            unitCost: number;
            totalCost: number;
            invoiceRef?: string;
        }[];
        subtotal: number;
        percentage: number;
    };

    // 2. Mano de obra
    labor: {
        items: {
            description: string;
            timeMinutes: number;
            hourlyRate: number;
            cost: number;
        }[];
        subtotal: number;
        percentage: number;
    };

    // 3. Almacenaje
    storage: {
        items: {
            ingredient: string;
            storageDays: number;
            dailyCost: number;
            cost: number;
        }[];
        subtotal: number;
        percentage: number;
    };

    // 4. Infraestructura (prorrateo)
    infrastructure: {
        items: {
            concept: string;
            monthlyCost: number;
            costPerUnit: number;
        }[];
        subtotal: number;
        percentage: number;
    };

    // Totales
    totalCost: number;
    costPerUnit: number;

    // Precio y rentabilidad
    suggestedPrice: number;            // Precio sugerido (mínimo 50% margen)
    userPrice?: number;                // Precio definido por usuario
    profit?: number;                   // Ganancia por unidad
    margin?: number;                   // Margen de ganancia %
    breakEvenUnits?: number;           // Punto de equilibrio (unidades/día)
}

// ═══════════════════════════════════════════════════════════════
// FICHA TÉCNICA
// ═══════════════════════════════════════════════════════════════

export interface TechnicalSheet {
    id: string;
    recipeId: string;
    businessId: string;

    // Información general
    code: string;
    name: string;
    category: string;

    // Rendimiento
    yield: number;
    yieldUnit: string;
    totalTime: number;
    difficulty: string;

    // Costeo completo
    costing: RecipeCostBreakdown;

    // Precio de venta (DEFINIDO POR USUARIO)
    sellingPrice: number;

    // Rentabilidad calculada
    profitPerUnit: number;
    marginPercentage: number;
    dailyBreakEven: number;            // Cuántos vender al día para cubrir costos

    // Procedimiento
    procedure: string[];

    // Imágenes
    mainImage?: string;
    beforeImage?: string;              // Para estéticas
    afterImage?: string;               // Para estéticas

    // Estado
    isAvailable: boolean;              // Si hay stock de todos los ingredientes
    lastCostUpdate: Date;

    // Histórico de costos
    costHistory: {
        date: Date;
        totalCost: number;
        reason?: string;                 // "Actualización factura", "Cambio proveedor", etc.
    }[];

    createdAt: Date;
    updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// ALERTAS DE COSTEO
// ═══════════════════════════════════════════════════════════════

export type CostAlertType =
    | 'price_increase'       // Precio de insumo subió
    | 'low_margin'           // Margen menor al mínimo
    | 'out_of_stock'         // Ingrediente agotado
    | 'high_margin'          // Margen muy alto (oportunidad)
    | 'cost_trend'           // Tendencia de costos al alza
    | 'new_invoice';         // Nueva factura que afecta costos

export interface CostAlert {
    id: string;
    businessId: string;
    recipeId?: string;
    productId?: string;

    type: CostAlertType;
    severity: 'info' | 'warning' | 'critical';

    title: string;
    message: string;

    // Datos del cambio
    previousValue?: number;
    newValue?: number;
    changePercentage?: number;

    // Acciones sugeridas
    suggestedActions?: string[];

    isRead: boolean;
    isResolved: boolean;

    createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS Y CALCULADORAS
// ═══════════════════════════════════════════════════════════════

export function calculateRecipeCost(
    recipe: Recipe,
    config: CostingConfig
): RecipeCostBreakdown {
    // 1. Calcular costo de insumos
    const ingredientsCost = recipe.ingredients.reduce((sum, ing) => {
        return sum + (ing.totalCost || 0);
    }, 0);

    // 2. Calcular costo de mano de obra
    const laborCost = recipe.laborSteps.reduce((sum, step) => {
        const rate = step.hourlyRate || config.labor.averageHourlyRate;
        return sum + (step.timeMinutes / 60) * rate;
    }, 0);

    // 3. Calcular costo de almacenaje
    const storageCost = recipe.ingredients.reduce((sum, ing) => {
        if (!ing.productId) return sum;
        return sum + (config.storage.dailyCostPerUnit * config.storage.averageStorageDays);
    }, 0);

    // 4. Calcular costo de infraestructura (prorrateo)
    const totalFixedCosts = Object.values(config.fixedCosts).reduce((a, b) => a + b, 0);
    const infrastructureCostPerUnit = totalFixedCosts / config.production.unitsPerMonth;

    // Total
    const totalCost = ingredientsCost + laborCost + storageCost + infrastructureCostPerUnit;
    const costPerUnit = totalCost / recipe.yield;

    return {
        ingredients: {
            items: recipe.ingredients.map(ing => ({
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                unitCost: ing.unitCost || 0,
                totalCost: ing.totalCost || 0,
                invoiceRef: ing.invoiceRef
            })),
            subtotal: ingredientsCost,
            percentage: (ingredientsCost / totalCost) * 100
        },
        labor: {
            items: recipe.laborSteps.map(step => ({
                description: step.description,
                timeMinutes: step.timeMinutes,
                hourlyRate: step.hourlyRate || config.labor.averageHourlyRate,
                cost: (step.timeMinutes / 60) * (step.hourlyRate || config.labor.averageHourlyRate)
            })),
            subtotal: laborCost,
            percentage: (laborCost / totalCost) * 100
        },
        storage: {
            items: [],
            subtotal: storageCost,
            percentage: (storageCost / totalCost) * 100
        },
        infrastructure: {
            items: Object.entries(config.fixedCosts).map(([concept, monthly]) => ({
                concept,
                monthlyCost: monthly,
                costPerUnit: monthly / config.production.unitsPerMonth
            })),
            subtotal: infrastructureCostPerUnit,
            percentage: (infrastructureCostPerUnit / totalCost) * 100
        },
        totalCost,
        costPerUnit,
        suggestedPrice: costPerUnit * 1.5 // 50% margen mínimo
    };
}

export function calculateMargin(cost: number, sellingPrice: number): number {
    return ((sellingPrice - cost) / sellingPrice) * 100;
}

export function calculateBreakEven(
    fixedCostsDaily: number,
    pricePerUnit: number,
    costPerUnit: number
): number {
    const contributionMargin = pricePerUnit - costPerUnit;
    if (contributionMargin <= 0) return Infinity;
    return Math.ceil(fixedCostsDaily / contributionMargin);
}
