// TypeScript types for Michingon3 business classification
// Based on SAT Mexico categories

// ═══════════════════════════════════════════════════════════════
// LAS 4 GRANDES FAMILIAS DE NEGOCIOS
// ═══════════════════════════════════════════════════════════════

export type BusinessFamily = 'comercio' | 'alimentos' | 'servicios' | 'produccion' | 'renteros';

export const BUSINESS_FAMILIES: Record<BusinessFamily, {
    id: BusinessFamily;
    name: string;
    emoji: string;
    description: string;
    color: string;
}> = {
    comercio: {
        id: 'comercio',
        name: 'Comercio',
        emoji: '🏪',
        description: 'Vendo productos',
        color: '#3B82F6' // blue
    },
    alimentos: {
        id: 'alimentos',
        name: 'Alimentos',
        emoji: '🍔',
        description: 'Vendo comida',
        color: '#F59E0B' // amber
    },
    servicios: {
        id: 'servicios',
        name: 'Servicios',
        emoji: '💇',
        description: 'Ofrezco servicios',
        color: '#8B5CF6' // violet
    },
    produccion: {
        id: 'produccion',
        name: 'Producción',
        emoji: '🏭',
        description: 'Fabrico productos',
        color: '#10B981' // emerald
    },
    renteros: {
        id: 'renteros',
        name: 'Rentas',
        emoji: '🏢',
        description: 'Rento espacios',
        color: '#EC4899' // pink
    }
};

// ═══════════════════════════════════════════════════════════════
// TIPOS ESPECÍFICOS DE NEGOCIO
// ═══════════════════════════════════════════════════════════════

export type BusinessType =
    // Comercio
    | 'abarrotes'
    | 'carniceria'
    | 'fruteria'
    | 'ferreteria'
    | 'papeleria'
    | 'farmacia'
    | 'ropa'
    | 'electronica'
    // Alimentos
    | 'restaurante'
    | 'taqueria'
    | 'cafeteria'
    | 'cocina_economica'
    | 'food_truck'
    | 'panaderia_venta'
    | 'bar'
    // Servicios
    | 'estetica'
    | 'barberia'
    | 'lavanderia'
    | 'taller_mecanico'
    | 'plomeria'
    | 'electricidad'
    | 'consultoria'
    | 'gimnasio'
    // Producción
    | 'panaderia'
    | 'tortilleria'
    | 'taller_costura'
    | 'carpinteria'
    | 'herreria'
    | 'imprenta'
    | 'artesanias'
    // Renteros
    | 'apartamentos'
    | 'edificio'
    | 'locales'
    | 'terrenos';

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN POR TIPO DE NEGOCIO
// ═══════════════════════════════════════════════════════════════

export interface BusinessTypeConfig {
    id: BusinessType;
    family: BusinessFamily;
    name: string;
    emoji: string;
    satKey: string;                    // Clave SAT para facturación

    // Funcionalidades habilitadas
    features: BusinessFeature[];

    // Característica única del tipo
    uniqueFeature?: {
        name: string;
        description: string;
        icon: string;
    };

    // Unidades de medida comunes
    productUnits: string[];

    // Categorías de gasto típicas
    expenseCategories: string[];

    // Categorías de producto típicas
    productCategories: string[];

    // Campos de receta específicos
    recipeFields?: string[];
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONALIDADES (FEATURES)
// ═══════════════════════════════════════════════════════════════

export type BusinessFeature =
    | 'inventory'           // Inventario
    | 'pos'                 // Punto de venta
    | 'merma'               // Control de merma (TODOS)
    | 'recipes'             // Recetas/Fórmulas
    | 'costing'             // Costeo profesional
    | 'appointments'        // Citas/Agenda
    | 'gallery'             // Galería de trabajos
    | 'before_after'        // Fotos antes/después
    | 'barcodes'            // Códigos de barras
    | 'expiration'          // Control de caducidad
    | 'tips'                // Propinas
    | 'orders'              // Pedidos
    | 'delivery'            // Entregas
    | 'whatsapp'            // Integración WhatsApp
    | 'invoicing';          // Facturación

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CADA TIPO
// ═══════════════════════════════════════════════════════════════

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeConfig> = {
    // ─────────────────────────────────────────────────────────────
    // COMERCIO
    // ─────────────────────────────────────────────────────────────
    abarrotes: {
        id: 'abarrotes',
        family: 'comercio',
        name: 'Abarrotes / Tiendita',
        emoji: '🏪',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'paquete', 'litro', 'kg'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Agua', 'Teléfono', 'Transporte'],
        productCategories: ['Abarrotes', 'Lácteos', 'Bebidas', 'Dulces', 'Limpieza', 'Otros']
    },
    carniceria: {
        id: 'carniceria',
        family: 'comercio',
        name: 'Carnicería / Pollería',
        emoji: '🥩',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        uniqueFeature: {
            name: 'Control de Merma Avanzado',
            description: 'Rastrea la pérdida de peso por refrigeración y cortes',
            icon: '📉'
        },
        productUnits: ['kg', 'g', 'pieza'],
        expenseCategories: ['Carne', 'Hielo', 'Renta', 'Luz', 'Gas', 'Transporte', 'Cuchillería'],
        productCategories: ['Res', 'Cerdo', 'Pollo', 'Mariscos', 'Embutidos', 'Preparados'],
        recipeFields: ['pesoInicial', 'pesoFinal', 'mermaCorte']
    },
    fruteria: {
        id: 'fruteria',
        family: 'comercio',
        name: 'Frutería / Verdulería',
        emoji: '🍎',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['kg', 'g', 'pieza', 'manojo'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Agua', 'Transporte'],
        productCategories: ['Frutas', 'Verduras', 'Chiles', 'Hierbas', 'Otros']
    },
    ferreteria: {
        id: 'ferreteria',
        family: 'comercio',
        name: 'Ferretería / Tlapalería',
        emoji: '🔧',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'metro', 'kg', 'litro', 'rollo'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Transporte'],
        productCategories: ['Herramientas', 'Plomería', 'Electricidad', 'Pintura', 'Cerrajería', 'Otros']
    },
    papeleria: {
        id: 'papeleria',
        family: 'comercio',
        name: 'Papelería',
        emoji: '📚',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'paquete', 'caja'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Agua'],
        productCategories: ['Útiles', 'Cuadernos', 'Arte', 'Oficina', 'Copias', 'Otros']
    },
    farmacia: {
        id: 'farmacia',
        family: 'comercio',
        name: 'Farmacia',
        emoji: '💊',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'caja', 'frasco'],
        expenseCategories: ['Medicamentos', 'Renta', 'Luz', 'Permisos'],
        productCategories: ['Medicamentos', 'Genéricos', 'Higiene', 'Bebés', 'Otros']
    },
    ropa: {
        id: 'ropa',
        family: 'comercio',
        name: 'Ropa / Boutique',
        emoji: '👕',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'par'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Decoración'],
        productCategories: ['Dama', 'Caballero', 'Niño', 'Calzado', 'Accesorios']
    },
    electronica: {
        id: 'electronica',
        family: 'comercio',
        name: 'Electrónica / Celulares',
        emoji: '📱',
        satKey: '4611',
        features: ['inventory', 'pos', 'merma', 'barcodes', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza'],
        expenseCategories: ['Mercancía', 'Renta', 'Luz', 'Seguro'],
        productCategories: ['Celulares', 'Accesorios', 'Reparación', 'Audio', 'Otros']
    },

    // ─────────────────────────────────────────────────────────────
    // ALIMENTOS
    // ─────────────────────────────────────────────────────────────
    restaurante: {
        id: 'restaurante',
        family: 'alimentos',
        name: 'Restaurante / Fonda',
        emoji: '🍽️',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'delivery', 'tips', 'whatsapp', 'invoicing'],
        uniqueFeature: {
            name: 'Costeo de Platillos',
            description: 'Calcula el costo real de cada platillo con todos los ingredientes',
            icon: '🧮'
        },
        productUnits: ['porción', 'plato', 'orden', 'kg', 'litro'],
        expenseCategories: ['Alimentos', 'Bebidas', 'Gas', 'Luz', 'Renta', 'Nómina', 'Limpieza'],
        productCategories: ['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres', 'Extras'],
        recipeFields: ['tiempoPreparacion', 'tiempoCoccion', 'porciones', 'calorias']
    },
    taqueria: {
        id: 'taqueria',
        family: 'alimentos',
        name: 'Taquería / Antojitos',
        emoji: '🌮',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'tips', 'whatsapp', 'invoicing'],
        productUnits: ['orden', 'taco', 'pieza', 'kg'],
        expenseCategories: ['Carne', 'Tortillas', 'Verduras', 'Gas', 'Renta', 'Nómina'],
        productCategories: ['Tacos', 'Quesadillas', 'Tortas', 'Bebidas', 'Extras'],
        recipeFields: ['tiempoPreparacion', 'porciones']
    },
    cafeteria: {
        id: 'cafeteria',
        family: 'alimentos',
        name: 'Cafetería / Panadería',
        emoji: '☕',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'tips', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'taza', 'vaso', 'rebanada'],
        expenseCategories: ['Café', 'Pan', 'Lácteos', 'Luz', 'Renta', 'Nómina'],
        productCategories: ['Café', 'Bebidas', 'Pan', 'Pasteles', 'Snacks'],
        recipeFields: ['tiempoPreparacion', 'temperatura']
    },
    cocina_economica: {
        id: 'cocina_economica',
        family: 'alimentos',
        name: 'Cocina Económica',
        emoji: '🍲',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['comida', 'plato', 'orden'],
        expenseCategories: ['Alimentos', 'Gas', 'Luz', 'Renta', 'Agua'],
        productCategories: ['Desayunos', 'Comidas', 'Bebidas', 'Extras'],
        recipeFields: ['tiempoPreparacion', 'porciones']
    },
    food_truck: {
        id: 'food_truck',
        family: 'alimentos',
        name: 'Food Truck',
        emoji: '🚚',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['orden', 'pieza'],
        expenseCategories: ['Alimentos', 'Gas', 'Gasolina', 'Permisos', 'Mantenimiento'],
        productCategories: ['Especialidad', 'Bebidas', 'Extras'],
        recipeFields: ['tiempoPreparacion']
    },
    panaderia_venta: {
        id: 'panaderia_venta',
        family: 'alimentos',
        name: 'Panadería (Solo Venta)',
        emoji: '🥐',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'docena', 'kg'],
        expenseCategories: ['Pan', 'Renta', 'Luz'],
        productCategories: ['Pan Dulce', 'Pan Salado', 'Pasteles', 'Galletas']
    },
    bar: {
        id: 'bar',
        family: 'alimentos',
        name: 'Bar / Cantina',
        emoji: '🍺',
        satKey: '90101501',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'tips', 'whatsapp', 'invoicing'],
        productUnits: ['copa', 'botella', 'cerveza', 'shot'],
        expenseCategories: ['Bebidas', 'Hielo', 'Renta', 'Luz', 'Nómina', 'Permisos'],
        productCategories: ['Cervezas', 'Licores', 'Cocteles', 'Botanas'],
        recipeFields: ['ingredientes', 'medidas']
    },

    // ─────────────────────────────────────────────────────────────
    // SERVICIOS
    // ─────────────────────────────────────────────────────────────
    estetica: {
        id: 'estetica',
        family: 'servicios',
        name: 'Estética / Salón de Belleza',
        emoji: '💇‍♀️',
        satKey: '91101700',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'appointments', 'gallery', 'before_after', 'tips', 'whatsapp', 'invoicing'],
        uniqueFeature: {
            name: 'Galería Antes/Después',
            description: 'Muestra a tus clientes el resultado de tus trabajos',
            icon: '📸'
        },
        productUnits: ['servicio', 'ml', 'g', 'aplicación'],
        expenseCategories: ['Productos', 'Tintes', 'Renta', 'Luz', 'Agua', 'Nómina'],
        productCategories: ['Cortes', 'Tintes', 'Tratamientos', 'Uñas', 'Maquillaje', 'Peinados'],
        recipeFields: ['tiempoAplicacion', 'formula', 'volumenPeroxido', 'nivelTono']
    },
    barberia: {
        id: 'barberia',
        family: 'servicios',
        name: 'Barbería',
        emoji: '💈',
        satKey: '91101700',
        features: ['inventory', 'pos', 'merma', 'appointments', 'gallery', 'tips', 'whatsapp', 'invoicing'],
        productUnits: ['servicio'],
        expenseCategories: ['Productos', 'Renta', 'Luz', 'Nómina'],
        productCategories: ['Cortes', 'Barba', 'Tratamientos', 'Productos']
    },
    lavanderia: {
        id: 'lavanderia',
        family: 'servicios',
        name: 'Lavandería',
        emoji: '🧺',
        satKey: '91101800',
        features: ['inventory', 'pos', 'merma', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['kg', 'prenda', 'carga'],
        expenseCategories: ['Detergente', 'Agua', 'Luz', 'Gas', 'Renta'],
        productCategories: ['Lavado', 'Secado', 'Planchado', 'Tintorería']
    },
    taller_mecanico: {
        id: 'taller_mecanico',
        family: 'servicios',
        name: 'Taller Mecánico',
        emoji: '🔧',
        satKey: '81101500',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'whatsapp', 'invoicing'],
        uniqueFeature: {
            name: 'Cotizador de Reparaciones',
            description: 'Calcula el costo de mano de obra + refacciones',
            icon: '🚗'
        },
        productUnits: ['servicio', 'pieza', 'litro', 'hora'],
        expenseCategories: ['Refacciones', 'Herramientas', 'Renta', 'Luz'],
        productCategories: ['Servicio', 'Frenos', 'Motor', 'Suspensión', 'Eléctrico', 'Refacciones'],
        recipeFields: ['tiempoManoObra', 'refacciones', 'dificultad']
    },
    plomeria: {
        id: 'plomeria',
        family: 'servicios',
        name: 'Plomería',
        emoji: '🔩',
        satKey: '72101500',
        features: ['inventory', 'pos', 'merma', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['servicio', 'pieza', 'metro'],
        expenseCategories: ['Materiales', 'Herramientas', 'Gasolina'],
        productCategories: ['Reparación', 'Instalación', 'Mantenimiento', 'Materiales']
    },
    electricidad: {
        id: 'electricidad',
        family: 'servicios',
        name: 'Electricista',
        emoji: '⚡',
        satKey: '72101500',
        features: ['inventory', 'pos', 'merma', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['servicio', 'pieza', 'metro'],
        expenseCategories: ['Materiales', 'Herramientas', 'Gasolina'],
        productCategories: ['Reparación', 'Instalación', 'Mantenimiento', 'Materiales']
    },
    consultoria: {
        id: 'consultoria',
        family: 'servicios',
        name: 'Consultoría / Profesional',
        emoji: '💼',
        satKey: '80101500',
        features: ['pos', 'appointments', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['hora', 'sesión', 'proyecto'],
        expenseCategories: ['Software', 'Transporte', 'Teléfono', 'Internet'],
        productCategories: ['Consultoría', 'Asesoría', 'Capacitación', 'Proyectos']
    },
    gimnasio: {
        id: 'gimnasio',
        family: 'servicios',
        name: 'Gimnasio / Estudio',
        emoji: '🏋️',
        satKey: '90101600',
        features: ['inventory', 'pos', 'merma', 'appointments', 'whatsapp', 'invoicing'],
        productUnits: ['mes', 'clase', 'sesión'],
        expenseCategories: ['Equipo', 'Renta', 'Luz', 'Nómina', 'Mantenimiento'],
        productCategories: ['Membresías', 'Clases', 'Personal', 'Productos']
    },

    // ─────────────────────────────────────────────────────────────
    // PRODUCCIÓN
    // ─────────────────────────────────────────────────────────────
    panaderia: {
        id: 'panaderia',
        family: 'produccion',
        name: 'Panadería (Producción)',
        emoji: '🥖',
        satKey: '31181500',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'expiration', 'orders', 'whatsapp', 'invoicing'],
        uniqueFeature: {
            name: 'Recetas con Fermentación',
            description: 'Controla tiempos de fermentación y rendimiento',
            icon: '🍞'
        },
        productUnits: ['pieza', 'docena', 'kg', 'charola'],
        expenseCategories: ['Harina', 'Ingredientes', 'Gas', 'Luz', 'Renta', 'Nómina'],
        productCategories: ['Pan Dulce', 'Pan Salado', 'Pasteles', 'Especiales'],
        recipeFields: ['tiempoFermentacion', 'temperaturaHorno', 'rendimiento']
    },
    tortilleria: {
        id: 'tortilleria',
        family: 'produccion',
        name: 'Tortillería',
        emoji: '🫓',
        satKey: '31181500',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['kg', 'docena'],
        expenseCategories: ['Maíz', 'Gas', 'Luz', 'Agua', 'Renta', 'Mantenimiento'],
        productCategories: ['Tortillas', 'Tostadas', 'Chips', 'Masa']
    },
    taller_costura: {
        id: 'taller_costura',
        family: 'produccion',
        name: 'Taller de Costura',
        emoji: '🧵',
        satKey: '60101700',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'gallery', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'metro', 'prenda'],
        expenseCategories: ['Telas', 'Hilos', 'Mercería', 'Luz', 'Renta', 'Nómina'],
        productCategories: ['Confección', 'Reparación', 'Bordado', 'Materiales'],
        recipeFields: ['tiempoConfeccion', 'materiales', 'talla']
    },
    carpinteria: {
        id: 'carpinteria',
        family: 'produccion',
        name: 'Carpintería',
        emoji: '🪵',
        satKey: '72102100',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'gallery', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'metro', 'tabla'],
        expenseCategories: ['Madera', 'Herrajes', 'Herramientas', 'Luz', 'Renta'],
        productCategories: ['Muebles', 'Cocinas', 'Closets', 'Reparación', 'Materiales'],
        recipeFields: ['tiempoProduccion', 'materiales', 'acabado']
    },
    herreria: {
        id: 'herreria',
        family: 'produccion',
        name: 'Herrería',
        emoji: '⚒️',
        satKey: '72102200',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'gallery', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'metro', 'kg'],
        expenseCategories: ['Metal', 'Soldadura', 'Gas', 'Luz', 'Renta'],
        productCategories: ['Puertas', 'Ventanas', 'Rejas', 'Estructuras', 'Reparación'],
        recipeFields: ['tiempoProduccion', 'materiales', 'peso']
    },
    imprenta: {
        id: 'imprenta',
        family: 'produccion',
        name: 'Imprenta',
        emoji: '🖨️',
        satKey: '82101500',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza', 'millar', 'hoja'],
        expenseCategories: ['Papel', 'Tintas', 'Luz', 'Renta', 'Mantenimiento'],
        productCategories: ['Tarjetas', 'Volantes', 'Lonas', 'Invitaciones', 'Especiales'],
        recipeFields: ['cantidad', 'material', 'acabado']
    },
    artesanias: {
        id: 'artesanias',
        family: 'produccion',
        name: 'Artesanías',
        emoji: '🎨',
        satKey: '60101800',
        features: ['inventory', 'pos', 'merma', 'recipes', 'costing', 'gallery', 'orders', 'whatsapp', 'invoicing'],
        productUnits: ['pieza'],
        expenseCategories: ['Materiales', 'Herramientas', 'Transporte'],
        productCategories: ['Barro', 'Textil', 'Madera', 'Metal', 'Joyería', 'Otros'],
        recipeFields: ['tiempoProduccion', 'materiales', 'tecnica']
    },

    // ─────────────────────────────────────────────────────────────
    // RENTEROS
    // ─────────────────────────────────────────────────────────────
    apartamentos: {
        id: 'apartamentos',
        family: 'renteros',
        name: 'Apartamentos / Cuartos',
        emoji: '🏠',
        satKey: '80131500',
        features: ['inventory', 'pos', 'invoicing', 'orders', 'whatsapp'],
        uniqueFeature: {
            name: 'Control de Rentas',
            description: 'Rastrea inquilinos, pagos y contratos',
            icon: '🔑'
        },
        productUnits: ['mes', 'quincena'],
        expenseCategories: ['Mantenimiento', 'Agua', 'Luz común', 'Predial', 'Seguros', 'Reparaciones'],
        productCategories: ['Rentas', 'Depósitos', 'Servicios', 'Multas']
    },
    edificio: {
        id: 'edificio',
        family: 'renteros',
        name: 'Edificio completo',
        emoji: '🏢',
        satKey: '80131500',
        features: ['inventory', 'pos', 'invoicing', 'orders', 'whatsapp'],
        uniqueFeature: {
            name: 'Gestión de Edificio',
            description: 'Administra múltiples unidades y áreas comunes',
            icon: '🏗️'
        },
        productUnits: ['mes', 'departamento'],
        expenseCategories: ['Mantenimiento', 'Elevador', 'Vigilancia', 'Luz común', 'Agua común', 'Predial', 'Seguros'],
        productCategories: ['Rentas', 'Cuotas mantenimiento', 'Estacionamiento', 'Servicios']
    },
    locales: {
        id: 'locales',
        family: 'renteros',
        name: 'Locales comerciales',
        emoji: '🏪',
        satKey: '80131500',
        features: ['inventory', 'pos', 'invoicing', 'orders', 'whatsapp'],
        uniqueFeature: {
            name: 'Rentas Comerciales',
            description: 'Controla rentas de locales y contratos comerciales',
            icon: '📝'
        },
        productUnits: ['mes', 'm2'],
        expenseCategories: ['Mantenimiento', 'Predial', 'Seguros', 'Comisiones', 'Reparaciones'],
        productCategories: ['Rentas', 'Depósitos', 'Servicios', 'Publicidad espacio']
    },
    terrenos: {
        id: 'terrenos',
        family: 'renteros',
        name: 'Terrenos / Bodegas',
        emoji: '🏗️',
        satKey: '80131500',
        features: ['pos', 'invoicing', 'orders', 'whatsapp'],
        productUnits: ['mes', 'm2', 'hectárea'],
        expenseCategories: ['Predial', 'Barda', 'Vigilancia', 'Limpieza'],
        productCategories: ['Rentas', 'Estacionamiento', 'Almacenaje', 'Eventos']
    }
};

// ═══════════════════════════════════════════════════════════════
// RÉGIMEN FISCAL SAT
// ═══════════════════════════════════════════════════════════════

export type SATRegime = 'RESICO' | 'RIF' | 'general' | 'none';

export const SAT_REGIMES: Record<SATRegime, {
    id: SATRegime;
    name: string;
    description: string;
    maxIncome: number | null;  // null = sin límite
}> = {
    RESICO: {
        id: 'RESICO',
        name: 'RESICO',
        description: 'Régimen Simplificado de Confianza (hasta $3.5M/año)',
        maxIncome: 3500000
    },
    RIF: {
        id: 'RIF',
        name: 'RIF',
        description: 'Régimen de Incorporación Fiscal (en transición)',
        maxIncome: 2000000
    },
    general: {
        id: 'general',
        name: 'Régimen General',
        description: 'Persona física con actividad empresarial',
        maxIncome: null
    },
    none: {
        id: 'none',
        name: 'Sin régimen',
        description: 'Aún no estoy dado de alta en el SAT',
        maxIncome: null
    }
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function getBusinessTypesByFamily(family: BusinessFamily): BusinessTypeConfig[] {
    return Object.values(BUSINESS_TYPES).filter(t => t.family === family);
}

export function hasFeature(businessType: BusinessType, feature: BusinessFeature): boolean {
    return BUSINESS_TYPES[businessType]?.features.includes(feature) ?? false;
}

export function getBusinessTypeConfig(businessType: BusinessType): BusinessTypeConfig | undefined {
    return BUSINESS_TYPES[businessType];
}
