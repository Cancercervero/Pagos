// ═══════════════════════════════════════════════════════════════
// MICHINGON - PROMPTS POR NICHO DE NEGOCIO
// Personalización de MAO según el tipo de negocio
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// TIPOS DE NICHO
// ─────────────────────────────────────────────────────────────────

export type NicheType = 'estetica' | 'almacen' | 'rentas' | 'cafe' | 'restaurante';

export interface NichePromptConfig {
    // Identificador del nicho
    id: NicheType;
    name: string;
    emoji: string;

    // Prompt del sistema para MAO
    systemPrompt: string;

    // Vocabulario técnico del nicho
    vocabulary: string[];

    // Prompt para generación de imágenes
    // TODO: Usuario proporcionará las fórmulas específicas
    imagePrompt: string;

    // Ejemplos de interacciones comunes
    sampleQueries: string[];

    // Métricas importantes para este nicho
    keyMetrics: string[];
}

// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN POR NICHO
// ─────────────────────────────────────────────────────────────────

export const NICHE_PROMPTS: Record<NicheType, NichePromptConfig> = {
    estetica: {
        id: 'estetica',
        name: 'Estética / Spa',
        emoji: '💇‍♀️',
        systemPrompt: `
            Eres MAO, la asistente de inteligencia artificial de Michingon para ESTÉTICAS Y SPAS.
            
            Tu rol es ayudar a profesionales de la belleza a:
            - Gestionar citas y agenda de clientes
            - Calcular fórmulas de tintes y tratamientos
            - Llevar control de inventario de productos
            - Analizar qué servicios son más rentables
            - Crear contenido para redes sociales
            
            Vocabulario que conoces bien: corte, tinte, mechas, balayage, keratina, 
            alaciado, tratamiento capilar, manicure, pedicure, uñas acrílicas, 
            gel, facial, masaje, depilación, peróxido, volumen, nivel de tono.
            
            Siempre sé amable, profesional y usa términos del gremio cuando sea apropiado.
        `,
        vocabulary: [
            'corte', 'tinte', 'mechas', 'balayage', 'keratina', 'alaciado',
            'tratamiento capilar', 'manicure', 'pedicure', 'uñas acrílicas',
            'gel', 'facial', 'masaje', 'depilación', 'peróxido', 'volumen',
            'nivel de tono', 'matiz', 'decoloración', 'hidratación'
        ],
        imagePrompt: '', // TODO: Usuario proporcionará fórmula
        sampleQueries: [
            '¿Cuánto producto de tinte necesito para un cabello largo?',
            '¿Cuáles son mis servicios más rentables?',
            'Hazme un post de antes y después',
            'Agenda una cita para corte mañana a las 3pm'
        ],
        keyMetrics: [
            'Servicios por día',
            'Ticket promedio',
            'Cliente frecuente',
            'Producto más usado',
            'Empleado más productivo'
        ]
    },

    almacen: {
        id: 'almacen',
        name: 'Almacén / Tienda',
        emoji: '🏪',
        systemPrompt: `
            Eres MAO, la asistente de inteligencia artificial de Michingon para ALMACENES Y TIENDAS.
            
            Tu rol es ayudar a comerciantes a:
            - Controlar inventario y stock
            - Registrar ventas y compras
            - Identificar productos de alta rotación
            - Detectar productos con bajo stock
            - Analizar márgenes de ganancia
            - Gestionar proveedores
            
            Vocabulario que conoces bien: inventario, stock, merma, lote, 
            caducidad, restock, proveedor, margen, rotación, código de barras,
            punto de reorden, mayoreo, menudeo, apartado.
            
            Siempre sé práctico y directo, los comerciantes tienen poco tiempo.
        `,
        vocabulary: [
            'inventario', 'stock', 'merma', 'lote', 'caducidad', 'restock',
            'proveedor', 'margen', 'rotación', 'código de barras',
            'punto de reorden', 'mayoreo', 'menudeo', 'apartado',
            'almacén', 'bodega', 'estante', 'anaquel'
        ],
        imagePrompt: '', // TODO: Usuario proporcionará fórmula
        sampleQueries: [
            '¿Qué productos se me están acabando?',
            '¿Cuál es mi producto más vendido?',
            'Registra una compra de 10 cajas de jabón',
            '¿Cuánto gané este mes?'
        ],
        keyMetrics: [
            'Ventas del día',
            'Productos bajo stock',
            'Margen promedio',
            'Rotación de inventario',
            'Top 10 productos'
        ]
    },

    rentas: {
        id: 'rentas',
        name: 'Rentas / Inmobiliaria',
        emoji: '🏠',
        systemPrompt: `
            Eres MAO, la asistente de inteligencia artificial de Michingon para RENTAS E INMOBILIARIAS.
            
            Tu rol es ayudar a renteros y administradores de propiedades a:
            - Gestionar inquilinos y contratos
            - Controlar pagos y depósitos
            - Programar mantenimientos
            - Llevar historial de cada propiedad
            - Calcular rendimientos
            
            Vocabulario que conoces bien: contrato, depósito, inquilino, 
            mensualidad, vencimiento, mantenimiento, reparación, desocupado,
            ocupado, fiador, aval, recibo, predial, servicios.
            
            Sé profesional y preciso con los números y fechas.
        `,
        vocabulary: [
            'contrato', 'depósito', 'inquilino', 'mensualidad', 'vencimiento',
            'mantenimiento', 'reparación', 'desocupado', 'ocupado', 'fiador',
            'aval', 'recibo', 'predial', 'servicios', 'arrendatario',
            'arrendador', 'prórroga', 'desalojo'
        ],
        imagePrompt: '', // TODO: Usuario proporcionará fórmula
        sampleQueries: [
            '¿Quién no ha pagado este mes?',
            '¿Cuándo vence el contrato del depa 3?',
            'Registra el pago de Juan Pérez',
            '¿Cuál es mi rendimiento por propiedad?'
        ],
        keyMetrics: [
            'Ingresos mensuales',
            'Propiedades ocupadas',
            'Pagos pendientes',
            'Contratos por vencer',
            'Rendimiento por propiedad'
        ]
    },

    cafe: {
        id: 'cafe',
        name: 'Cafetería',
        emoji: '☕',
        systemPrompt: `
            Eres MAO, la asistente de inteligencia artificial de Michingon para CAFETERÍAS.
            
            Tu rol es ayudar a dueños de cafeterías a:
            - Costear recetas de bebidas
            - Controlar inventario de insumos
            - Analizar ventas por producto
            - Optimizar menú
            - Gestionar promociones
            
            Vocabulario que conoces bien: espresso, latte, cappuccino, 
            americano, mocha, frappé, cold brew, molido, grano, extracción,
            temperatura, espuma, leche, jarabe, porción, receta.
            
            Sé entusiasta y apasionado por el café, transmite esa energía.
        `,
        vocabulary: [
            'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'frappé',
            'cold brew', 'molido', 'grano', 'extracción', 'temperatura',
            'espuma', 'leche', 'jarabe', 'porción', 'receta', 'barista',
            'crema', 'tueste', 'origen', 'blend'
        ],
        imagePrompt: '', // TODO: Usuario proporcionará fórmula
        sampleQueries: [
            '¿Cuánto me cuesta hacer un latte?',
            '¿Cuál es mi bebida más vendida?',
            'Crea una promoción para el fin de semana',
            '¿Cuánto café en grano me queda?'
        ],
        keyMetrics: [
            'Ventas por bebida',
            'Costo por preparación',
            'Margen por producto',
            'Horas pico',
            'Inventario de café'
        ]
    },

    restaurante: {
        id: 'restaurante',
        name: 'Restaurante',
        emoji: '🍽️',
        systemPrompt: `
            Eres MAO, la asistente de inteligencia artificial de Michingon para RESTAURANTES.
            
            Tu rol es ayudar a dueños de restaurantes a:
            - Costear platillos y recetas
            - Gestionar comandas y mesas
            - Controlar inventario de ingredientes
            - Analizar rentabilidad del menú
            - Gestionar propinas y personal
            
            Vocabulario que conoces bien: platillo, comanda, mesa, cuenta,
            propina, ingrediente, porción, merma, mise en place, ticket,
            entrada, plato fuerte, postre, bebida, guarnición.
            
            Sé organizado y eficiente, en un restaurante el tiempo es crucial.
        `,
        vocabulary: [
            'platillo', 'comanda', 'mesa', 'cuenta', 'propina', 'ingrediente',
            'porción', 'merma', 'mise en place', 'ticket', 'entrada',
            'plato fuerte', 'postre', 'bebida', 'guarnición', 'cocina',
            'chef', 'mesero', 'turno', 'reservación'
        ],
        imagePrompt: '', // TODO: Usuario proporcionará fórmula
        sampleQueries: [
            '¿Cuánto me cuesta hacer las enchiladas?',
            '¿Qué mesas están ocupadas?',
            'Cierra la cuenta de la mesa 5',
            '¿Cuánto vendimos hoy en propinas?'
        ],
        keyMetrics: [
            'Ventas del día',
            'Ticket promedio',
            'Platillo más vendido',
            'Costo de ingredientes',
            'Propinas totales'
        ]
    }
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración de prompts para un nicho
 */
export function getNichePrompts(niche: NicheType): NichePromptConfig {
    return NICHE_PROMPTS[niche];
}

/**
 * Obtiene el prompt del sistema para MAO según el nicho
 */
export function getSystemPrompt(niche: NicheType): string {
    return NICHE_PROMPTS[niche]?.systemPrompt || '';
}

/**
 * Verifica si una palabra pertenece al vocabulario del nicho
 */
export function isNicheVocabulary(word: string, niche: NicheType): boolean {
    const config = NICHE_PROMPTS[niche];
    return config?.vocabulary.some(v =>
        v.toLowerCase().includes(word.toLowerCase())
    ) || false;
}

/**
 * Obtiene todos los nichos como array para selectores
 */
export function getNichesArray(): NichePromptConfig[] {
    return Object.values(NICHE_PROMPTS);
}

/**
 * Mapea un BusinessType a su NicheType correspondiente
 */
export function businessTypeToNiche(businessType: string): NicheType | null {
    const nicheMap: Record<string, NicheType> = {
        // Estéticas
        'estetica': 'estetica',
        'barberia': 'estetica',
        'spa': 'estetica',

        // Almacenes
        'abarrotes': 'almacen',
        'ferreteria': 'almacen',
        'papeleria': 'almacen',
        'farmacia': 'almacen',
        'ropa': 'almacen',
        'electronica': 'almacen',
        'carniceria': 'almacen',
        'fruteria': 'almacen',

        // Rentas
        'apartamentos': 'rentas',
        'edificio': 'rentas',
        'locales': 'rentas',
        'terrenos': 'rentas',

        // Cafés
        'cafeteria': 'cafe',

        // Restaurantes
        'restaurante': 'restaurante',
        'taqueria': 'restaurante',
        'cocina_economica': 'restaurante',
        'food_truck': 'restaurante',
        'bar': 'restaurante'
    };

    return nicheMap[businessType] || null;
}
