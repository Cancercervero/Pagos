// ═══════════════════════════════════════════════════════════════
// MICHINGON - TIPOS DE REDES SOCIALES
// Sistema de generación de posts para diferentes plataformas
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// PLATAFORMAS
// ─────────────────────────────────────────────────────────────────

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp';

export interface PlatformStyle {
    maxLength: number;
    hashtagsRecommended: number;
    tone: string;
    example: string;
    icon: string;
    color: string;
}

export const PLATFORM_STYLES: Record<SocialPlatform, PlatformStyle> = {
    instagram: {
        maxLength: 2200,
        hashtagsRecommended: 15,
        tone: 'Visual, lifestyle, emojis frecuentes, inspiracional. Usa line breaks para legibilidad.',
        example: '✨ Nuevo look! 💇‍♀️\n\n¡Transforma tu estilo con nosotros!\n\n#Transformación #Belleza #NuevoLook',
        icon: '📸',
        color: '#E4405F'
    },
    facebook: {
        maxLength: 63206,
        hashtagsRecommended: 3,
        tone: 'Conversacional, informativo, links permitidos. Más texto explicativo es aceptable.',
        example: '¡Bienvenidos amigos! 👋\n\nHoy les comparto nuestra nueva promoción especial. Aprovecha este fin de semana...',
        icon: '📘',
        color: '#1877F2'
    },
    tiktok: {
        maxLength: 300,
        hashtagsRecommended: 5,
        tone: 'Juvenil, trending, corto y llamativo. Usa referencias a tendencias actuales.',
        example: 'POV: cuando tu café está perfecto ☕️✨ #FYP #ParaTi #CaféLovers',
        icon: '🎵',
        color: '#000000'
    },
    whatsapp: {
        maxLength: 1000,
        hashtagsRecommended: 0,
        tone: 'Directo, personal, sin hashtags. Como si hablaras con un cliente conocido.',
        example: 'Hola! 👋 Te comparto nuestra promo del día:\n\n🔥 2x1 en lattes todo el día\n\n¿Te gustaría apartar algo?',
        icon: '💬',
        color: '#25D366'
    }
};

// ─────────────────────────────────────────────────────────────────
// POSTS SOCIALES
// ─────────────────────────────────────────────────────────────────

export interface SocialPost {
    id: string;
    platform: SocialPlatform;
    originalImage?: string;       // URL de imagen subida por usuario
    generatedImage?: string;      // URL de imagen procesada por IA
    generatedText: string;        // Copy generado
    hashtags: string[];           // Hashtags extraídos
    niche: string;                // Nicho del negocio
    productDescription?: string;  // Descripción original del producto
    status: 'draft' | 'ready' | 'published';
    createdAt: Date;
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// INPUT PARA GENERACIÓN
// ─────────────────────────────────────────────────────────────────

export interface SocialPostInput {
    platform: SocialPlatform;
    productDescription: string;
    niche: string;
    imageBase64?: string;
    businessName?: string;
    additionalContext?: string;
}

export interface SocialPostOutput {
    text: string;
    hashtags: string[];
    generatedImageUrl?: string;
    suggestions?: string[];
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración de estilo para una plataforma
 */
export function getPlatformStyle(platform: SocialPlatform): PlatformStyle {
    return PLATFORM_STYLES[platform];
}

/**
 * Obtiene todas las plataformas como array para selectores
 */
export function getPlatformsArray(): { id: SocialPlatform; style: PlatformStyle }[] {
    return Object.entries(PLATFORM_STYLES).map(([id, style]) => ({
        id: id as SocialPlatform,
        style
    }));
}

/**
 * Valida si el texto cumple con los límites de la plataforma
 */
export function validatePostLength(text: string, platform: SocialPlatform): {
    isValid: boolean;
    currentLength: number;
    maxLength: number;
    remaining: number;
} {
    const style = PLATFORM_STYLES[platform];
    const currentLength = text.length;

    return {
        isValid: currentLength <= style.maxLength,
        currentLength,
        maxLength: style.maxLength,
        remaining: style.maxLength - currentLength
    };
}

/**
 * Cuenta los hashtags en un texto
 */
export function countHashtags(text: string): number {
    const matches = text.match(/#\w+/g);
    return matches ? matches.length : 0;
}

/**
 * Extrae hashtags de un texto
 */
export function extractHashtags(text: string): string[] {
    const matches = text.match(/#\w+/g);
    return matches || [];
}
