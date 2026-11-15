// ═══════════════════════════════════════════════════════════════
// MICHINGON3 - GESTIÓN DE FUERZA LABORAL
// Reloj Checador + Geolocalización + Productividad Diaria
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// GEOLOCALIZACIÓN
// Para validar que el empleado esté físicamente en el local
// ─────────────────────────────────────────────────────────────────

export interface GeoLocation {
    lat: number;               // Latitud
    lng: number;               // Longitud
    accuracy: number;          // Margen de error en metros
    address?: string;          // Dirección legible (opcional, via reverse geocoding)
    timestamp: Date;           // Cuándo se obtuvo la ubicación
}

/**
 * Define la ubicación del negocio (zona permitida)
 * Se configura en Settings
 */
export interface BusinessLocation {
    id: string;
    businessId: string;
    name: string;              // "Local Principal", "Sucursal Norte", etc.

    // Centro del área permitida
    centerLat: number;
    centerLng: number;

    // Radio en metros (Ej: 100m = dentro del negocio)
    radiusMeters: number;

    address: string;
    isActive: boolean;
    createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// TURNO DE TRABAJO (Work Shift)
// El "reloj checador" digital con métricas de productividad
// ─────────────────────────────────────────────────────────────────

export interface WorkShift {
    id: string;
    userId: string;
    businessId: string;
    locationId?: string;       // Si tiene múltiples sucursales

    // 📍 ENTRADA (Check-in)
    clockInTime: Date;
    clockInLocation: GeoLocation;
    clockInDevice: 'mobile' | 'desktop' | 'tablet';
    clockInMethod: 'biometric' | 'password' | 'qr_code';
    clockInPhoto?: string;     // Opcional: Selfie de entrada

    // Validación de puntualidad
    scheduledStartTime?: Date; // Hora esperada de entrada
    isLate: boolean;           // ¿Llegó tarde?
    lateMinutes?: number;      // Cuántos minutos tarde

    // 📍 SALIDA (Check-out)
    clockOutTime?: Date;
    clockOutLocation?: GeoLocation;
    clockOutDevice?: 'mobile' | 'desktop' | 'tablet';
    clockOutPhoto?: string;

    // Validación de salida
    scheduledEndTime?: Date;   // Hora esperada de salida
    leftEarly?: boolean;       // ¿Salió antes?
    overtimeMinutes?: number;  // Tiempo extra trabajado

    // 📊 RESUMEN DEL TURNO (Productividad Diaria)
    // Esto se calcula automáticamente durante el turno y al cerrar
    dailyStats?: {
        // Para Cajeros
        salesGenerated?: number;     // Dinero vendido (MXN)
        transactionCount?: number;   // Cantidad de ventas
        avgTicket?: number;          // Ticket promedio
        cashCollected?: number;      // Efectivo cobrado

        // Para Almacenistas
        productsProcessed?: number;  // Productos dados de alta/modificados
        stockAdjustments?: number;   // Ajustes de inventario

        // Para Todos
        tasksCompleted?: number;     // Tareas marcadas como listas
        customersServed?: number;    // Clientes atendidos
        breaks?: Array<{             // Breaks/pausas tomadas
            startTime: Date;
            endTime?: Date;
            durationMinutes?: number;
        }>;
    };

    // 🎯 ESTADO
    status: 'active' | 'completed' | 'auto-closed' | 'abandoned';

    // Auto-closed: Si el empleado olvidó hacer check-out, se cierra automáticamente a medianoche
    // Abandoned: Si pasaron >12 horas sin check-out (probablemente error)

    // 📝 NOTAS
    notes?: string;            // Comentarios del empleado o supervisor
    issues?: string[];         // Problemas reportados durante el turno

    // 🔔 VALIDACIONES
    wasValidated: boolean;     // ¿Supervisor revisó este turno?
    validatedBy?: string;      // UID del supervisor
    validatedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE TURNOS (Schedule)
// Define los horarios esperados por empleado
// ─────────────────────────────────────────────────────────────────

export interface EmployeeSchedule {
    id: string;
    userId: string;
    businessId: string;

    // Horarios semanales (puede ser null si ese día no trabaja)
    monday?: ShiftTime;
    tuesday?: ShiftTime;
    wednesday?: ShiftTime;
    thursday?: ShiftTime;
    friday?: ShiftTime;
    saturday?: ShiftTime;
    sunday?: ShiftTime;

    // Configuración
    timezone: string;          // "America/Mexico_City"
    isActive: boolean;
    effectiveFrom: Date;       // Desde cuándo aplica este horario
    effectiveUntil?: Date;     // Hasta cuándo (null = indefinido)

    createdAt: Date;
    updatedAt: Date;
}

export interface ShiftTime {
    start: string;             // "09:00"
    end: string;               // "18:00"
    breakMinutes?: number;     // Minutos de descanso permitidos (Ej: 30)
    location?: string;         // ID de BusinessLocation (si aplica)
}

// ─────────────────────────────────────────────────────────────────
// SOLICITUDES DE TIEMPO LIBRE
// Vacaciones, permisos, faltas justificadas
// ─────────────────────────────────────────────────────────────────

export interface TimeOffRequest {
    id: string;
    userId: string;
    businessId: string;

    type: 'vacation' | 'sick_leave' | 'personal' | 'unpaid';
    startDate: Date;
    endDate: Date;
    totalDays: number;         // Calculado automáticamente

    reason: string;
    attachments?: string[];    // URLs de documentos (Ej: certificado médico)

    // Aprobación
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;       // UID del supervisor
    reviewedAt?: Date;
    reviewNotes?: string;

    createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// TAREAS ASIGNADAS
// Para medir productividad más allá de ventas
// ─────────────────────────────────────────────────────────────────

export interface Task {
    id: string;
    businessId: string;
    assignedTo: string;        // UID del empleado
    assignedBy: string;        // UID de quien asignó

    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;         // "Limpieza", "Inventario", "Cliente", etc.

    // Tiempo
    dueDate?: Date;
    estimatedMinutes?: number;

    // Estado
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    completedAt?: Date;
    actualMinutes?: number;    // Cuánto tardó realmente

    // Validación
    requiresPhoto?: boolean;   // ¿Requiere foto de evidencia?
    completionPhoto?: string;
    notes?: string;

    createdAt: Date;
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// REPORTES DE ASISTENCIA
// Resumen mensual de puntualidad y horas trabajadas
// ─────────────────────────────────────────────────────────────────

export interface AttendanceReport {
    id: string;
    userId: string;
    businessId: string;

    month: number;             // 1-12
    year: number;

    // Métricas calculadas
    totalShifts: number;
    onTimeShifts: number;
    lateShifts: number;
    missedShifts: number;

    totalHoursWorked: number;
    totalOvertimeHours: number;

    // Productividad
    totalSalesGenerated?: number;
    totalTasksCompleted: number;

    // Score
    attendanceScore: number;   // 0-100
    punctualityScore: number;  // 0-100

    generatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calcula la distancia entre dos coordenadas en metros
 * Usa la fórmula Haversine
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
}

/**
 * Verifica si el usuario está dentro del radio permitido del negocio
 */
export function isWithinBusinessArea(
    userLocation: GeoLocation,
    businessLocation: BusinessLocation
): boolean {
    const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        businessLocation.centerLat,
        businessLocation.centerLng
    );

    // Agregar el margen de error del GPS al radio
    const effectiveRadius = businessLocation.radiusMeters + userLocation.accuracy;

    return distance <= effectiveRadius;
}

/**
 * Calcula si el empleado llegó tarde
 */
export function isLateArrival(
    clockInTime: Date,
    scheduledStartTime: Date,
    gracePeriodMinutes: number = 5
): { isLate: boolean; minutesLate: number } {
    const diffMs = clockInTime.getTime() - scheduledStartTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    const isLate = diffMinutes > gracePeriodMinutes;
    const minutesLate = isLate ? diffMinutes : 0;

    return { isLate, minutesLate };
}

/**
 * Calcula las horas trabajadas en un turno
 */
export function calculateHoursWorked(shift: WorkShift): number {
    if (!shift.clockOutTime) return 0;

    const diffMs = shift.clockOutTime.getTime() - shift.clockInTime.getTime();
    const hours = diffMs / (1000 * 60 * 60);

    // Restar breaks si los hay
    if (shift.dailyStats?.breaks) {
        const breakMinutes = shift.dailyStats.breaks.reduce((total, b) => {
            if (b.durationMinutes) return total + b.durationMinutes;
            return total;
        }, 0);

        return hours - (breakMinutes / 60);
    }

    return hours;
}

/**
 * Calcula el tiempo extra trabajado (overtime)
 */
export function calculateOvertime(shift: WorkShift): number {
    if (!shift.clockOutTime || !shift.scheduledEndTime) return 0;

    const scheduledEnd = shift.scheduledEndTime.getTime();
    const actualEnd = shift.clockOutTime.getTime();

    if (actualEnd <= scheduledEnd) return 0;

    const diffMs = actualEnd - scheduledEnd;
    return Math.floor(diffMs / (1000 * 60)); // Minutos de overtime
}

/**
 * Determina el estado del turno basado en tiempo transcurrido
 */
export function determineShiftStatus(shift: WorkShift): WorkShift['status'] {
    // Si ya tiene clockOut, está completado
    if (shift.clockOutTime) return 'completed';

    const now = new Date();
    const hoursElapsed = (now.getTime() - shift.clockInTime.getTime()) / (1000 * 60 * 60);

    // Si pasaron más de 12 horas sin check-out, probablemente abandonado
    if (hoursElapsed > 12) return 'abandoned';

    // Si es el mismo día, está activo
    const isSameDay =
        now.getDate() === shift.clockInTime.getDate() &&
        now.getMonth() === shift.clockInTime.getMonth() &&
        now.getFullYear() === shift.clockInTime.getFullYear();

    if (isSameDay) return 'active';

    // Si ya pasó medianoche y no hizo check-out, auto-cerrar
    return 'auto-closed';
}

/**
 * Genera un resumen de asistencia para el mes
 */
export function generateMonthlyReport(
    shifts: WorkShift[],
    userId: string,
    month: number,
    year: number
): Partial<AttendanceReport> {
    const monthShifts = shifts.filter(s => {
        const shiftDate = s.clockInTime;
        return (
            shiftDate.getMonth() + 1 === month &&
            shiftDate.getFullYear() === year &&
            s.userId === userId
        );
    });

    const totalShifts = monthShifts.length;
    const onTimeShifts = monthShifts.filter(s => !s.isLate).length;
    const lateShifts = monthShifts.filter(s => s.isLate).length;

    const totalHoursWorked = monthShifts.reduce(
        (sum, s) => sum + calculateHoursWorked(s),
        0
    );

    const totalOvertimeHours = monthShifts.reduce(
        (sum, s) => sum + (calculateOvertime(s) / 60),
        0
    );

    const attendanceScore = totalShifts > 0
        ? Math.round((onTimeShifts / totalShifts) * 100)
        : 100;

    return {
        totalShifts,
        onTimeShifts,
        lateShifts,
        missedShifts: 0, // Esto se calcularía comparando con el schedule
        totalHoursWorked,
        totalOvertimeHours,
        attendanceScore,
        punctualityScore: attendanceScore
    };
}
