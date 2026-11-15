// ═══════════════════════════════════════════════════════════════
// CATEGORÍAS DINÁMICAS POR TIPO DE NEGOCIO
// Sistema que adapta el contenido según la categoría del negocio
// ═══════════════════════════════════════════════════════════════

export interface BusinessCategory {
    id: string;
    name: string;
    icon: string;
    recipeCategories: string[];
    productCategories: string[];
    commonSuppliers: string[];
}

// Definición de categorías por tipo de negocio
export const BUSINESS_CATEGORIES: Record<string, BusinessCategory> = {
    // ALIMENTOS Y BEBIDAS
    'grocery': {
        id: 'grocery',
        name: 'Abarrotería',
        icon: '🏪',
        recipeCategories: [],
        productCategories: ['Abarrotes Secos', 'Lácteos', 'Carnes y Embutidos', 'Frutas y Verduras', 'Bebidas', 'Limpieza', 'Cuidado Personal'],
        commonSuppliers: ['Bimbo', 'Coca-Cola', 'Lala', 'Sigma']
    },
    'restaurant': {
        id: 'restaurant',
        name: 'Restaurante',
        icon: '🍽️',
        recipeCategories: ['Entradas', 'Platos Fuertes', 'Postres', 'Bebidas', 'Guarniciones'],
        productCategories: ['Proteínas', 'Vegetales', 'Granos', 'Lácteos', 'Especias', 'Bebidas'],
        commonSuppliers: ['Sysco', 'US Foods', 'Distribuidora Local']
    },
    'cafe': {
        id: 'cafe',
        name: 'Cafetería',
        icon: '☕',
        recipeCategories: ['Bebidas Calientes', 'Bebidas Frías', 'Repostería', 'Desayunos', 'Snacks'],
        productCategories: ['Café', 'Leches', 'Endulzantes', 'Repostería', 'Snacks'],
        commonSuppliers: ['Starbucks', 'Nestlé', 'Mayoreo de Café']
    },
    'bakery': {
        id: 'bakery',
        name: 'Panadería',
        icon: '🥐',
        recipeCategories: ['Pan Dulce', 'Pan Salado', 'Pasteles', 'Galletas', 'Especialidades'],
        productCategories: ['Harinas', 'Levaduras', 'Lácteos', 'Grasas', 'Decoraciones', 'Frutas'],
        commonSuppliers: ['Gruma', 'Levapan', 'Distribuidora de Insumos']
    },
    'bar': {
        id: 'bar',
        name: 'Bar',
        icon: '🍺',
        recipeCategories: ['Cocteles', 'Shots', 'Bebidas sin Alcohol', 'Botanas'],
        productCategories: ['Licores', 'Cervezas', 'Mixers', 'Garnish', 'Hielo', 'Botanas'],
        commonSuppliers: ['Diageo', 'Mahou', 'Distribuidora de Licores']
    },

    // BELLEZA Y CUIDADO PERSONAL
    'salon': {
        id: 'salon',
        name: 'Salón de Belleza',
        icon: '💇',
        recipeCategories: ['Tintes', 'Tratamientos Capilares', 'Servicios de Corte', 'Peinados'],
        productCategories: ['Tintes', 'Shampoos', 'Tratamientos', 'Herramientas', 'Químicos'],
        commonSuppliers: ['Loreal', 'Wella', 'Schwarzkopf']
    },
    'spa': {
        id: 'spa',
        name: 'Spa',
        icon: '🧖',
        recipeCategories: ['Tratamientos Faciales', 'Tratamientos Corporales', 'Masajes'],
        productCategories: ['Cremas', 'Aceites', 'Mascarillas', 'Exfoliantes', 'Aromaterapia'],
        commonSuppliers: ['Estée Lauder', 'Shiseido', 'Distribuidora Spa']
    },
    'barbershop': {
        id: 'barbershop',
        name: 'Barbería',
        icon: '💈',
        recipeCategories: ['Cortes', 'Afeitados', 'Tratamientos Barba'],
        productCategories: ['Herramientas', 'Productos Barba', 'After Shave', 'Ceras', 'Pomadas'],
        commonSuppliers: ['Babyliss', 'Wahl', 'American Crew']
    },

    // RETAIL
    'clothing': {
        id: 'clothing',
        name: 'Tienda de Ropa',
        icon: '👕',
        recipeCategories: [],
        productCategories: ['Hombre', 'Mujer', 'Niños', 'Accesorios', 'Calzado'],
        commonSuppliers: ['Mayoristas Textiles', 'Importadores']
    },
    'electronics': {
        id: 'electronics',
        name: 'Electrónica',
        icon: '📱',
        recipeCategories: [],
        productCategories: ['Smartphones', 'Computadoras', 'Audio', 'Accesorios', 'Cables'],
        commonSuppliers: ['Samsung', 'Apple', 'HP', 'Distribuidora Tech']
    },
    'pharmacy': {
        id: 'pharmacy',
        name: 'Farmacia',
        icon: '💊',
        recipeCategories: [],
        productCategories: ['Medicamentos', 'Cuidado Personal', 'Bebé', 'Vitaminas', 'Primeros Auxilios'],
        commonSuppliers: ['Nadro', 'Casa Saba', 'Femsa Salud']
    },

    // SERVICIOS
    'gym': {
        id: 'gym',
        name: 'Gimnasio',
        icon: '💪',
        recipeCategories: ['Planes de Entrenamiento', 'Rutinas'],
        productCategories: ['Suplementos', 'Equipamiento', 'Bebidas', 'Accesorios'],
        commonSuppliers: ['Optimum Nutrition', 'Equipos Fitness']
    },
    'laundry': {
        id: 'laundry',
        name: 'Lavandería',
        icon: '🧺',
        recipeCategories: [],
        productCategories: ['Detergentes', 'Suavizantes', 'Quitamanchas', 'Químicos'],
        commonSuppliers: ['Procter & Gamble', 'Henkel', 'Químicos Industriales']
    },

    // GENÉRICO (fallback)
    'other': {
        id: 'other',
        name: 'Otro',
        icon: '🏢',
        recipeCategories: ['General'],
        productCategories: ['Productos', 'Servicios', 'Insumos'],
        commonSuppliers: ['Proveedores Generales']
    }
};

/**
 * Obtener categorías según el tipo de negocio
 */
export function getCategoriesForBusiness(businessCategory: string): BusinessCategory {
    return BUSINESS_CATEGORIES[businessCategory] || BUSINESS_CATEGORIES['other'];
}

/**
 * Obtener solo categorías de recetas
 */
export function getRecipeCategories(businessCategory: string): string[] {
    const config = getCategoriesForBusiness(businessCategory);
    return config.recipeCategories.length > 0
        ? config.recipeCategories
        : config.productCategories; // Fallback a productos si no hay recetas
}

/**
 * Obtener solo categorías de productos
 */
export function getProductCategories(businessCategory: string): string[] {
    const config = getCategoriesForBusiness(businessCategory);
    return config.productCategories;
}

/**
 * Verificar si un negocio usa recetas
 */
export function businessUsesRecipes(businessCategory: string): boolean {
    const config = getCategoriesForBusiness(businessCategory);
    return config.recipeCategories.length > 0;
}
