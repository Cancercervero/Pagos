// TypeScript interfaces for Michingon3 business entities

export interface PurchaseBatch {
    id: string;
    provider: string;
    invoice?: string;
    date: Date;
    quantity: number;
    cost: number;
    merma: number;
    mermaReason?: string;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    cost: number; // Average or last cost
    stock: number;
    category: string;
    imageUrl?: string;
    unit?: 'kg' | 'unit' | 'liter';
    minStock?: number;
    maxStock?: number;
    satKey?: string;
    vatRate?: number;
    batches?: PurchaseBatch[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Sale {
    id: string;
    products: SaleItem[];
    clientId?: string;
    total: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    status: 'completed' | 'pending' | 'cancelled';
    createdAt: Date;
    employeeId?: string;
}

export interface SaleItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    iva?: number;
    invoiceUrl?: string;
    createdAt: Date;
}

export interface Client {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    totalPurchases: number;
    createdAt: Date;
}

export interface Employee {
    id: string;
    name: string;
    email: string;
    role: string;
    salary: number;
    hireDate: Date;
    status: 'active' | 'inactive';
}

export interface KPIMetrics {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalSales: number;
    averageTicket: number;
    topProducts: Array<{ id: string; name: string; revenue: number; quantity: number }>;
    revenueByDay: Array<{ date: string; revenue: number; expenses: number }>;
    lowStockProducts: Product[];
}

export interface Business {
    id: string;
    name: string;
    ownerId: string;

    // Localización
    countryCode?: string;            // 'MX', 'US', 'ES', 'CO', 'AR'
    currencyCode?: string;           // 'MXN', 'USD', 'EUR', etc.
    language?: 'es' | 'en';          // Idioma preferido

    // Clasificación del negocio
    businessFamily?: 'comercio' | 'alimentos' | 'servicios' | 'produccion' | 'renteros';
    businessType?: string;           // Tipo específico (carniceria, estetica, etc.)

    // Régimen fiscal SAT
    satRegime?: 'RESICO' | 'RIF' | 'general' | 'none';
    rfc?: string;

    // Estados de onboarding y tutorial
    onboardingCompleted: boolean;
    tutorialCompleted: boolean;

    // Integraciones
    whatsappApiKey?: string;
    whatsappConnected?: boolean;

    // Información adicional
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    imageUrl?: string;

    // Configuración de costos (referencia)
    costingConfigured?: boolean;

    createdAt: Date;
    updatedAt?: Date;
}

export interface Asset {
    id: string;
    name: string;
    description: string;
    purchaseDate: Date;
    purchasePrice: number;
    currentValue: number;
    category: string;
    imageUrl?: string;
    financing?: {
        downPayment: number;
        monthlyPayment: number;
        remainingMonths: number;
    };
    usefulLife?: number; // in months
    createdAt: Date;
    updatedAt: Date;
}

export interface Supplier {
    id: string;
    name: string;
    category: string;
    contactPerson: string;
    phone: string;
    email?: string;
    workHours?: string;
    creditDays: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Invoice {
    id: string;
    type: 'issued' | 'expense';
    folio: string;
    clientId?: string;
    clientName?: string;
    supplierId?: string;
    supplierName?: string;
    amount: number;
    subtotal: number;
    iva: number;
    status: 'Pagado' | 'Pendiente' | 'Cancelado' | 'Completada' | 'En Proceso';
    date: Date;
    fiscalUUID?: string;
    products?: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        iva: number;
        total: number;
    }>;
    createdAt: Date;
}

export interface Order {
    id: string;
    clientName: string;
    deliveryDate: Date;
    deliveryTime: string;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        notes?: string;
    }>;
    status: 'pending' | 'preparing' | 'completed' | 'rejected';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

