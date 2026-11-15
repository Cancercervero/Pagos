// ═══════════════════════════════════════════════════════════════
// TIPOS PARA SISTEMA DE INVITACIONES
// Gestiona invitaciones de empleados sin email
// ═══════════════════════════════════════════════════════════════

import { UserRole } from './auth-types';

export interface EmployeeInvitation {
    id: string;                    // Mismo que el code
    code: string;                  // "abc123xyz456" (12 chars)
    businessId: string;

    // Datos del empleado a crear
    employeeData: {
        fullName: string;
        phoneNumber: string;         // +52 1 234 567 8910
        role: UserRole;              // cashier, inventory, staff (NO owner/manager)
        position?: string;           // "Cajero Principal", "Almacenista"
        salary?: number;             // Opcional
        schedule: {
            start: string;             // "09:00"
            end: string;               // "19:00"
            daysOfWeek: number[];      // [1,2,3,4,5] = Lunes-Viernes
        };
    };

    // Metadata
    createdBy: string;             // UID del owner/manager
    createdByName: string;         // "Carlos Dueño"
    createdAt: Date;
    expiresAt: Date;               // +7 días

    // Estado
    status: 'pending' | 'completed' | 'expired' | 'cancelled';
    used: boolean;
    usedAt?: Date;
    usedBy?: string;               // UID del empleado creado

    // Seguridad
    attempts: number;              // Intentos de uso
    lastAttemptAt?: Date;
    ipAddress?: string;            // IP de quien lo usó
}

export interface InvitationLink {
    url: string;                   // https://app.michingon.com/invite/abc123
    code: string;
    expiresAt: Date;
    whatsappLink: string;          // Link directo a WhatsApp con mensaje
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Genera código aleatorio de invitación
 */
export function generateInvitationCode(length: number = 12): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

/**
 * Calcula fecha de expiración (7 días desde ahora)
 */
export function calculateExpirationDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
}

/**
 * Valida si una invitación es válida
 */
export function isInvitationValid(invitation: EmployeeInvitation): {
    valid: boolean;
    reason?: string;
} {
    if (invitation.used) {
        return { valid: false, reason: 'Esta invitación ya fue usada' };
    }

    if (invitation.status === 'cancelled') {
        return { valid: false, reason: 'Esta invitación fue cancelada' };
    }

    if (new Date() > invitation.expiresAt) {
        return { valid: false, reason: 'Esta invitación expiró' };
    }

    if (invitation.attempts >= 5) {
        return { valid: false, reason: 'Demasiados intentos fallidos' };
    }

    return { valid: true };
}

/**
 * Genera mensaje de WhatsApp con link de invitación
 */
export function generateWhatsAppMessage(
    employeeName: string,
    businessName: string,
    invitationLink: string
): string {
    return encodeURIComponent(
        `¡Hola ${employeeName}! 👋\n\n` +
        `Has sido invitado a unirte al equipo de *${businessName}* en Michingon3.\n\n` +
        `Para completar tu registro, abre este link:\n` +
        `${invitationLink}\n\n` +
        `⚠️ Este link es de un solo uso y expira en 7 días.\n\n` +
        `¡Te esperamos! 🚀`
    );
}

/**
 * Genera link completo de invitación
 */
export function createInvitationLink(
    code: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
): InvitationLink {
    const url = `${baseUrl}/invite/${code}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return {
        url,
        code,
        expiresAt,
        whatsappLink: '' // Se genera después con el número
    };
}

/**
 * Obtiene días de la semana en español
 */
export function getDayName(dayNumber: number): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayNumber] || '';
}

/**
 * Formatea horario para display
 */
export function formatSchedule(schedule: EmployeeInvitation['employeeData']['schedule']): string {
    const daysStr = schedule.daysOfWeek
        .map(d => getDayName(d))
        .join(', ');

    return `${daysStr} de ${schedule.start} a ${schedule.end}`;
}
