'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Permission } from '@/types/auth-types';
import { ReactNode } from 'react';
import { AlertCircle, Lock } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// GUARD DE PERMISOS
// Envuelve componentes que requieren permisos específicos
// ═══════════════════════════════════════════════════════════════

interface PermissionGuardProps {
    children: ReactNode;
    permission: Permission | Permission[];
    fallback?: ReactNode;
    requireAll?: boolean; // Si hay múltiples permisos, ¿require todos o solo uno?
}

export function PermissionGuard({
    children,
    permission,
    fallback,
    requireAll = false
}: PermissionGuardProps) {
    const { hasPermission, userProfile } = useAuth();

    // Normalizar a array
    const permissions = Array.isArray(permission) ? permission : [permission];

    // Verificar permisos
    const hasAccess = requireAll
        ? permissions.every(p => hasPermission(p))
        : permissions.some(p => hasPermission(p));

    // Si no tiene acceso, mostrar fallback o mensaje por default
    if (!hasAccess) {
        if (fallback) {
            return <>{fallback}</>;
        }

        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
                <Lock className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Acceso Restringido
                </h3>
                <p className="text-red-700">
                    No tienes permiso para acceder a esta función.
                </p>
                <p className="text-sm text-red-600 mt-2">
                    Contacta a tu administrador si crees que esto es un error.
                </p>
            </div>
        );
    }

    // Tiene acceso, mostrar contenido
    return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════
// GUARD DE ROL
// Más simple - solo verifica el rol del usuario
// ═══════════════════════════════════════════════════════════════

import { UserRole } from '@/types/auth-types';

interface RoleGuardProps {
    children: ReactNode;
    roles: UserRole | UserRole[];
    fallback?: ReactNode;
}

export function RoleGuard({ children, roles, fallback }: RoleGuardProps) {
    const { userProfile } = useAuth();

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    const hasAccess = userProfile && allowedRoles.includes(userProfile.role);

    if (!hasAccess) {
        if (fallback) {
            return <>{fallback}</>;
        }

        return (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                    Solo para {allowedRoles.join(' o ')}
                </h3>
                <p className="text-yellow-700">
                    Esta función está disponible solo para ciertos roles.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════
// GUARD DE USUARIO ACTIVO
// Verifica que el usuario esté activo (no dado de baja)
// ═══════════════════════════════════════════════════════════════

interface ActiveUserGuardProps {
    children: ReactNode;
}

export function ActiveUserGuard({ children }: ActiveUserGuardProps) {
    const { userProfile } = useAuth();

    if (!userProfile?.isActive) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="p-8 bg-white border border-gray-200 rounded-xl text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Cuenta Desactivada
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Tu cuenta ha sido desactivada. No puedes acceder al sistema en este momento.
                    </p>
                    <p className="text-sm text-gray-500">
                        Si crees que esto es un error, contacta a tu administrador.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Mostrar solo si tiene permiso (sin wrapper visual)
// ═══════════════════════════════════════════════════════════════

interface ShowIfProps {
    children: ReactNode;
    permission: Permission | Permission[];
    requireAll?: boolean;
}

export function ShowIf({ children, permission, requireAll = false }: ShowIfProps) {
    const { hasPermission } = useAuth();

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = requireAll
        ? permissions.every(p => hasPermission(p))
        : permissions.some(p => hasPermission(p));

    if (!hasAccess) return null;

    return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════
// EJEMPLOS DE USO
// ═══════════════════════════════════════════════════════════════

/*
// 1. Guard de permiso simple
<PermissionGuard permission="manage_staff">
  <button>Invitar Empleado</button>
</PermissionGuard>

// 2. Guard de múltiples permisos (require solo uno)
<PermissionGuard permission={['view_reports', 'export_data']}>
  <ReportsSection />
</PermissionGuard>

// 3. Guard de múltiples permisos (require todos)
<PermissionGuard 
  permission={['manage_staff', 'view_payroll']} 
  requireAll={true}
>
  <PayrollManager />
</PermissionGuard>

// 4. Guard de rol
<RoleGuard roles={['owner', 'manager']}>
  <AdminSettings />
</RoleGuard>

// 5. ShowIf (sin mensaje de error)
<ShowIf permission="pos_access">
  <POSButton />
</ShowIf>

// 6. Con custom fallback
<PermissionGuard 
  permission="view_reports"
  fallback={<div>Contacta al administrador para activar reportes</div>}
>
  <ReportsPage />
</PermissionGuard>
*/
