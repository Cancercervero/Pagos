// ═══════════════════════════════════════════════════════════════
// MICHINGON3 - SISTEMA DE AUTENTICACIÓN Y ROLES
// Inspirado en Kadamees pero moderno (WebAuthn + Biometría)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// NIVELES DE JERARQUÍA
// ─────────────────────────────────────────────────────────────────

/**
 * Define los niveles de jerarquía en el sistema
 * Cada rol tiene permisos específicos que controlan el acceso
 */
export type UserRole = 
  | 'owner'       // Dueño (MasterKey Universal) - Ve TODO
  | 'manager'     // Gerente - Ve finanzas y personal, pero no configuración delicada
  | 'cashier'     // Cajero - Solo POS y Cierre de Caja
  | 'inventory'   // Almacenista - Solo Inventario y Proveedores
  | 'staff'       // Empleado General - Solo ver sus turnos y tareas
  | 'analyst';    // Analista - Solo lectura de reportes (El "U2" del PDF)

// ─────────────────────────────────────────────────────────────────
// PERMISOS DEL SISTEMA
// ─────────────────────────────────────────────────────────────────

/**
 * Lista completa de permisos granulares en Michingon3
 * Se usan para bloquear/desbloquear funciones específicas
 */
export type Permission =
  // Dashboard y Analytics
  | 'view_dashboard'
  | 'view_reports'
  | 'export_data'
  
  // Punto de Venta
  | 'pos_access'
  | 'create_sale'
  | 'void_sale'
  | 'apply_discount'
  | 'close_register'
  
  // Inventario
  | 'view_inventory'
  | 'view_products'
  | 'create_product'
  | 'update_product'
  | 'delete_product'
  | 'update_stock'
  | 'adjust_inventory'
  
  // Proveedores
  | 'view_suppliers'
  | 'manage_suppliers'
  
  // Clientes
  | 'view_clients'
  | 'manage_clients'
  
  // Finanzas
  | 'view_expenses'
  | 'create_expense'
  | 'view_profitability'
  | 'view_cashflow'
  
  // Recursos Humanos
  | 'view_staff'
  | 'manage_staff'
  | 'view_payroll'
  | 'approve_payroll'
  
  // Recetas (si aplica)
  | 'view_recipes'
  | 'manage_recipes'
  
  // Configuración
  | 'manage_settings'
  | 'manage_integrations'
  | 'manage_billing'
  
  // Control de Asistencia
  | 'clock_in'
  | 'clock_out'
  | 'view_schedule'
  | 'view_tasks'
  | 'manage_shifts'
  
  // Admin Total
  | '*'; // Símbolo especial para "todos los permisos"

// ─────────────────────────────────────────────────────────────────
// MATRIZ DE PERMISOS
// Define qué puertas se abren con cada rol
// ─────────────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // 👑 OWNER - Acceso Total (MasterKey)
  owner: ['*'],
  
  // 👔 MANAGER - Todo menos configuración crítica
  manager: [
    'view_dashboard',
    'view_reports',
    'export_data',
    'pos_access',
    'create_sale',
    'apply_discount',
    'close_register',
    'view_inventory',
    'view_products',
    'create_product',
    'update_product',
    'update_stock',
    'view_suppliers',
    'manage_suppliers',
    'view_clients',
    'manage_clients',
    'view_expenses',
    'create_expense',
    'view_profitability',
    'view_staff',
    'manage_staff',
    'view_payroll',
    'manage_shifts'
  ],
  
  // 💰 CASHIER - Solo Punto de Venta
  cashier: [
    'pos_access',
    'view_products',
    'create_sale',
    'close_register',
    'view_clients',
    'clock_in',
    'clock_out',
    'view_schedule'
  ],
  
  // 📦 INVENTORY - Solo Almacén
  inventory: [
    'view_inventory',
    'view_products',
    'create_product',
    'update_product',
    'update_stock',
    'adjust_inventory',
    'view_suppliers',
    'manage_suppliers',
    'clock_in',
    'clock_out',
    'view_schedule'
  ],
  
  // 👷 STAFF - Empleado General (Mínimo)
  staff: [
    'clock_in',
    'clock_out',
    'view_schedule',
    'view_tasks'
  ],
  
  // 📊 ANALYST - Solo Lectura (El "U2")
  analyst: [
    'view_dashboard',
    'view_reports',
    'export_data',
    'view_inventory',
    'view_products',
    'view_profitability',
    'view_cashflow'
  ]
};

// ─────────────────────────────────────────────────────────────────
// METADATA DE ROLES (Para UI)
// ─────────────────────────────────────────────────────────────────

export interface RoleMetadata {
  id: UserRole;
  name: string;
  description: string;
  color: string;
  icon: string;
  canManageUsers: boolean; // ¿Puede dar de alta/baja a otros?
  salaryRange?: string;    // Referencia (opcional)
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  owner: {
    id: 'owner',
    name: 'Dueño',
    description: 'Acceso total al sistema. Puede modificar todo.',
    color: '#DC2626',
    icon: '👑',
    canManageUsers: true
  },
  
  manager: {
    id: 'manager',
    name: 'Gerente',
    description: 'Administra operaciones, finanzas y personal.',
    color: '#7C3AED',
    icon: '👔',
    canManageUsers: true
  },
  
  cashier: {
    id: 'cashier',
    name: 'Cajero',
    description: 'Opera el punto de venta y cierra caja.',
    color: '#0891B2',
    icon: '💰',
    canManageUsers: false,
    salaryRange: '$8,000 - $12,000 MXN'
  },
  
  inventory: {
    id: 'inventory',
    name: 'Almacenista',
    description: 'Gestiona inventario y proveedores.',
    color: '#16A34A',
    icon: '📦',
    canManageUsers: false,
    salaryRange: '$7,000 - $10,000 MXN'
  },
  
  staff: {
    id: 'staff',
    name: 'Empleado',
    description: 'Acceso básico para registrar asistencia.',
    color: '#6B7280',
    icon: '👷',
    canManageUsers: false,
    salaryRange: '$6,000 - $9,000 MXN'
  },
  
  analyst: {
    id: 'analyst',
    name: 'Analista',
    description: 'Solo lectura de reportes y datos.',
    color: '#EA580C',
    icon: '📊',
    canManageUsers: false
  }
};

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  
  // Si tiene '*', tiene todos los permisos
  if (permissions.includes('*')) return true;
  
  // Buscar el permiso específico
  return permissions.includes(permission);
}

/**
 * Verifica si un rol puede gestionar a otro rol
 * Regla: Solo Owner y Manager pueden gestionar usuarios
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  // Owner puede gestionar a todos
  if (managerRole === 'owner') return true;
  
  // Manager puede gestionar a todos menos Owner
  if (managerRole === 'manager' && targetRole !== 'owner') return true;
  
  return false;
}

/**
 * Obtiene todos los roles que un usuario puede asignar
 */
export function getAssignableRoles(role: UserRole): UserRole[] {
  if (role === 'owner') {
    return ['manager', 'cashier', 'inventory', 'staff', 'analyst'];
  }
  
  if (role === 'manager') {
    return ['cashier', 'inventory', 'staff', 'analyst'];
  }
  
  return [];
}

/**
 * Obtiene el nivel de jerarquía (para ordenar roles)
 * Menor número = Mayor jerarquía
 */
export function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    owner: 1,
    manager: 2,
    analyst: 3,
    cashier: 4,
    inventory: 4,
    staff: 5
  };
  
  return levels[role];
}
