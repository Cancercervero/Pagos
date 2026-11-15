// ═══════════════════════════════════════════════════════════════
// MICHINGON3 - PERFIL DE USUARIO CON BIOMETRÍA
// WebAuthn (FaceID/Huella) + Métricas de Productividad
// ═══════════════════════════════════════════════════════════════

import { UserRole } from './auth-types';

// ─────────────────────────────────────────────────────────────────
// CREDENCIALES BIOMÉTRICAS (WebAuthn)
// ─────────────────────────────────────────────────────────────────

/**
 * Representa un dispositivo registrado con biometría
 * Cada usuario puede tener múltiples dispositivos (iPhone, iPad, PC)
 */
export interface BiometricCredential {
    credentialId: string;      // ID único del token WebAuthn
    publicKey: string;         // Llave pública del dispositivo (guardamos, privada queda en el device)
    deviceLabel: string;       // Nombre amigable: "iPhone de Juan", "Caja Principal"
    deviceType: 'mobile' | 'desktop' | 'tablet';
    platform: 'ios' | 'android' | 'windows' | 'mac' | 'linux';
    browser?: string;          // "Safari", "Chrome", etc.
    lastUsed?: Date;           // Última vez que usó este dispositivo
    createdAt: Date;
    isActive: boolean;         // Si es falso, está revocado
}

// ─────────────────────────────────────────────────────────────────
// MÉTRICAS DE PRODUCTIVIDAD
// El "Score" del empleado - Se calcula automáticamente
// ─────────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
    // 💰 VENTAS (Si su rol es cashier o manager)
    totalSales: number;        // Dinero generado histórico (MXN)
    transactions: number;      // Cantidad de ventas realizadas
    avgTicket: number;         // Ticket promedio (totalSales / transactions)
    bestSaleAmount: number;    // Venta más grande
    lastSaleDate?: Date;

    // 📦 INVENTARIO (Si su rol es inventory)
    productsAdded: number;     // Productos dados de alta
    stockUpdates: number;      // Ajustes de inventario hechos
    suppliersManaged: number;  // Proveedores que maneja

    // ⏰ ASISTENCIA
    attendanceScore: number;   // 0-100% (basado en puntualidad)
    totalShifts: number;       // Total de turnos trabajados
    lateArrivals: number;      // Veces que llegó tarde
    onTimeArrivals: number;    // Veces que llegó a tiempo
    missedShifts: number;      // Faltas

    // 🎯 GENERAL
    tasksCompleted: number;    // Tareas marcadas como completadas
    lastActive: Date;          // Última vez que usó el sistema
    accountAge: number;        // Días desde que se dio de alta

    // 📊 SCORE CALCULADO (Se recalcula cada noche)
    overallScore: number;      // 0-100 (Algoritmo: 50% ventas + 30% asistencia + 20% tareas)
}

// ─────────────────────────────────────────────────────────────────
// PERFIL COMPLETO DEL USUARIO
// Aquí eliminamos la fricción: Email es backup, biometría es día a día
// ─────────────────────────────────────────────────────────────────

export interface UserProfile {
    // 🆔 IDENTIFICACIÓN
    uid: string;               // ID de Firebase Auth
    businessId: string;        // A qué negocio pertenece

    // 👤 DATOS PERSONALES
    fullName: string;
    email: string;             // Único - Para login de respaldo
    phone?: string;
    photoUrl?: string;         // URL de foto de perfil
    birthDate?: Date;          // Opcional: Para felicitaciones automáticas
    address?: string;          // Opcional

    // 🔐 JERARQUÍA Y SEGURIDAD
    role: UserRole;
    isActive: boolean;         // Si es falso, no puede entrar (Baja de empleado)
    needsPasswordReset: boolean; // Forzar cambio de contraseña en próximo login

    // 🆔 BIOMETRÍA (Lo nuevo - Múltiples dispositivos)
    biometricCredentials: BiometricCredential[];
    prefersBiometric: boolean; // Si false, usa email/password siempre

    // 📈 PRODUCTIVIDAD (El "Score")
    performanceMetrics: PerformanceMetrics;

    // 💼 DATOS LABORALES (Opcional - Para RH)
    employment?: {
        hireDate: Date;
        position: string;        // Cargo formal
        department?: string;
        salary?: number;         // Confidencial - Solo Owner lo ve
        contractType?: 'full_time' | 'part_time' | 'contractor';
        socialSecurityNumber?: string; // IMSS (cifrado)
        bankAccount?: string;    // Para nómina (cifrado)

        // 🆕 Horario laboral (para empleados)
        schedule?: {
            start: string;        // "09:00"
            end: string;          // "19:00"
            daysOfWeek: number[]; // [1,2,3,4,5] = Lun-Vie
        };

        // 🆕 Validaciones obligatorias
        requireGPS?: boolean;      // Si debe validar GPS
        requireSchedule?: boolean; // Si debe validar horario
    };

    // 🕐 HORARIO ESPERADO (Para calcular si llegó tarde)
    schedule?: {
        monday?: { start: string; end: string };    // "09:00", "18:00"
        tuesday?: { start: string; end: string };
        wednesday?: { start: string; end: string };
        thursday?: { start: string; end: string };
        friday?: { start: string; end: string };
        saturday?: { start: string; end: string };
        sunday?: { start: string; end: string };
    };

    // 🔔 NOTIFICACIONES
    notificationSettings: {
        emailNotifications: boolean;
        pushNotifications: boolean;
        smsNotifications: boolean;
        notifyOnSale: boolean;
        notifyOnLowStock: boolean;
        notifyOnPayroll: boolean;
    };

    // 📅 METADATA
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;        // UID de quien lo dio de alta
    lastLoginAt?: Date;
    lastLoginDevice?: string;
    lastLoginIP?: string;
}

// ─────────────────────────────────────────────────────────────────
// INVITACIÓN DE EMPLEADO
// Para dar de alta nuevos usuarios sin fricción
// ─────────────────────────────────────────────────────────────────

export interface EmployeeInvitation {
    id: string;
    businessId: string;
    invitedBy: string;         // UID del creador

    // Datos del invitado
    email: string;
    phone?: string;
    suggestedName?: string;
    role: UserRole;

    // Control
    invitationCode: string;    // Token único de 8 caracteres
    expiresAt: Date;           // Expira en 7 días
    status: 'pending' | 'accepted' | 'expired' | 'revoked';

    // Usado cuando aceptan
    acceptedAt?: Date;
    userId?: string;           // UID del usuario creado

    createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calcula el score de asistencia (0-100)
 * Fórmula: (onTime / total) * 100
 */
export function calculateAttendanceScore(metrics: PerformanceMetrics): number {
    const total = metrics.totalShifts;
    if (total === 0) return 100; // Si no ha trabajado, score perfecto por default

    const onTimePercentage = (metrics.onTimeArrivals / total) * 100;
    return Math.round(onTimePercentage);
}

/**
 * Calcula el score general (0-100)
 * Algoritmo: 50% ventas + 30% asistencia + 20% tareas
 */
export function calculateOverallScore(
    metrics: PerformanceMetrics,
    role: UserRole
): number {
    let score = 0;

    // Si es cashier o manager, las ventas pesan más
    if (role === 'cashier' || role === 'manager') {
        const salesScore = Math.min((metrics.totalSales / 100000) * 100, 100); // Cap a $100k
        score += salesScore * 0.5;
    } else {
        // Para otros roles, tareas pesan más
        const tasksScore = Math.min((metrics.tasksCompleted / 50) * 100, 100);
        score += tasksScore * 0.5;
    }

    // Asistencia siempre pesa 30%
    const attendanceScore = calculateAttendanceScore(metrics);
    score += attendanceScore * 0.3;

    // Tareas completas 20%
    const tasksScore = Math.min((metrics.tasksCompleted / 50) * 100, 100);
    score += tasksScore * 0.2;

    return Math.round(score);
}

/**
 * Determina si el usuario tiene un dispositivo biométrico registrado
 */
export function hasBiometricDevice(user: UserProfile): boolean {
    return user.biometricCredentials.some(cred => cred.isActive);
}

/**
 * Obtiene el dispositivo usado más recientemente
 */
export function getMostRecentDevice(user: UserProfile): BiometricCredential | null {
    const activeDevices = user.biometricCredentials.filter(c => c.isActive);
    if (activeDevices.length === 0) return null;

    return activeDevices.sort((a, b) => {
        const aTime = a.lastUsed?.getTime() || 0;
        const bTime = b.lastUsed?.getTime() || 0;
        return bTime - aTime;
    })[0];
}

/**
 * Calcula los días trabajados en el mes actual
 */
export function getDaysWorkedThisMonth(metrics: PerformanceMetrics): number {
    // Esto se calcularía con los WorkShifts del mes
    // Por ahora es un placeholder
    return Math.min(metrics.totalShifts, 30);
}

/**
 * Verifica si el usuario puede eliminar/desactivar un dispositivo
 * Regla: Debe tener al menos 2 métodos de acceso (biométrico o password)
 */
export function canRemoveDevice(user: UserProfile, credentialId: string): boolean {
    const activeDevices = user.biometricCredentials.filter(c => c.isActive);

    // Si solo tiene 1 dispositivo, no puede eliminarlo
    if (activeDevices.length <= 1) return false;

    return true;
}
