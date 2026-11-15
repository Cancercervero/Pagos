// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE GEOLOCALIZACIÓN
// Cálculo de distancias y validación de ubicación
// ═══════════════════════════════════════════════════════════════

export interface GeoCoordinates {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * @returns Distancia en metros
 */
export function calculateDistance(
    point1: GeoCoordinates,
    point2: GeoCoordinates
): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
}

/**
 * Obtiene la ubicación actual del usuario
 */
export function getCurrentLocation(): Promise<GeoCoordinates> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalización no soportada'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Valida si el usuario está dentro del radio permitido
 */
export function isWithinAllowedArea(
    currentLocation: GeoCoordinates,
    businessLocation: GeoCoordinates,
    allowedRadius: number = 100 // metros
): boolean {
    const distance = calculateDistance(currentLocation, businessLocation);
    return distance <= allowedRadius;
}

/**
 * Formatea coordenadas para display
 */
export function formatCoordinates(coords: GeoCoordinates): string {
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
}
