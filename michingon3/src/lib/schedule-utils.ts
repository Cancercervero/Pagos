// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE HORARIO
// Validación de horarios laborales
// ═══════════════════════════════════════════════════════════════

export interface WorkSchedule {
    start: string; // "09:00"
    end: string;   // "19:00"
    daysOfWeek: number[]; // [1,2,3,4,5] = Lunes-Viernes
}

/**
 * Valida si la hora actual está dentro del horario laboral
 */
export function isWithinWorkHours(schedule: WorkSchedule): boolean {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 6 = Sábado
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Verificar día de la semana
    if (!schedule.daysOfWeek.includes(currentDay)) {
        return false;
    }

    // Verificar hora
    return currentTime >= schedule.start && currentTime <= schedule.end;
}

/**
 * Obtiene el próximo día/hora laboral
 */
export function getNextWorkTime(schedule: WorkSchedule): Date {
    const now = new Date();
    const result = new Date(now);

    // Buscar el próximo día laboral
    for (let i = 0; i < 7; i++) {
        const dayToCheck = new Date(result);
        dayToCheck.setDate(result.getDate() + i);

        if (schedule.daysOfWeek.includes(dayToCheck.getDay())) {
            // Configurar hora de inicio
            const [hours, minutes] = schedule.start.split(':').map(Number);
            dayToCheck.setHours(hours, minutes, 0, 0);

            // Si es hoy y aún no es la hora, return today
            // Si es hoy pero ya pasó la hora, buscar mañana
            if (i === 0 && dayToCheck > now) {
                return dayToCheck;
            } else if (i > 0) {
                return dayToCheck;
            }
        }
    }

    return result;
}

/**
 * Calcula minutos restantes hasta el fin del horario
 */
export function getMinutesUntilEndOfShift(schedule: WorkSchedule): number {
    const now = new Date();
    const [endHours, endMinutes] = schedule.end.split(':').map(Number);

    const endTime = new Date(now);
    endTime.setHours(endHours, endMinutes, 0, 0);

    const diff = endTime.getTime() - now.getTime();
    return Math.floor(diff / 1000 / 60);
}

/**
 * Formatea horario para display
 */
export function formatSchedule(schedule: WorkSchedule): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayNames = schedule.daysOfWeek.map(d => days[d]).join(', ');
    return `${dayNames} ${schedule.start}-${schedule.end}`;
}
