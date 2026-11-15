import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { generate } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/googleai';
import {
    SocialPlatform,
    PLATFORM_STYLES,
    SocialPostInput,
    SocialPostOutput
} from '@/types/social-media-types';
import { getNichePrompts, NicheType } from '@/lib/prompts/niche-prompts';

// ═══════════════════════════════════════════════════════════════
// SCHEMA DE ENTRADA Y SALIDA
// ═══════════════════════════════════════════════════════════════

const socialPostInputSchema = z.object({
    platform: z.enum(['instagram', 'facebook', 'tiktok', 'whatsapp']),
    productDescription: z.string(),
    niche: z.string(),
    imageBase64: z.string().optional(),
    businessName: z.string().optional(),
    additionalContext: z.string().optional()
});

const socialPostOutputSchema = z.object({
    text: z.string(),
    hashtags: z.array(z.string()),
    generatedImageUrl: z.string().optional(),
    suggestions: z.array(z.string()).optional()
});

// ═══════════════════════════════════════════════════════════════
// FLUJO DE GENERACIÓN DE POSTS
// ═══════════════════════════════════════════════════════════════

export const generateSocialPost = defineFlow(
    {
        name: 'generateSocialPost',
        inputSchema: socialPostInputSchema,
        outputSchema: socialPostOutputSchema
    },
    async (input) => {
        const platformStyle = PLATFORM_STYLES[input.platform as SocialPlatform];
        const nicheConfig = getNichePrompts(input.niche as NicheType);

        const prompt = `
            Eres un experto en marketing de redes sociales para negocios pequeños.
            Tu tarea es crear un post atractivo para ${input.platform.toUpperCase()}.
            
            === CONTEXTO DEL NEGOCIO ===
            - Tipo de negocio: ${nicheConfig?.name || input.niche}
            - Nombre del negocio: ${input.businessName || 'Mi Negocio'}
            ${input.additionalContext ? `- Contexto adicional: ${input.additionalContext}` : ''}
            
            === PRODUCTO/SERVICIO A PROMOCIONAR ===
            ${input.productDescription}
            
            === ESTILO DE LA PLATAFORMA (${input.platform.toUpperCase()}) ===
            - Longitud máxima: ${platformStyle.maxLength} caracteres
            - Hashtags recomendados: ${platformStyle.hashtagsRecommended}
            - Tono: ${platformStyle.tone}
            - Ejemplo de post: "${platformStyle.example}"
            
            === INSTRUCCIONES ===
            1. Crea un post que capture la atención inmediatamente
            2. Usa emojis apropiados para la plataforma
            3. Incluye un llamado a la acción claro
            4. ${input.platform !== 'whatsapp' ? `Añade ${platformStyle.hashtagsRecommended} hashtags relevantes` : 'NO uses hashtags'}
            5. Mantén el tono ${platformStyle.tone}
            6. El texto debe ser natural, no parecer escrito por IA
            
            Responde SOLO con un JSON válido:
            {
                "text": "El texto completo del post incluyendo emojis y hashtags",
                "hashtags": ["lista", "de", "hashtags", "sin", "el", "simbolo"],
                "suggestions": ["Sugerencia 1 para mejorar", "Sugerencia 2"]
            }
        `;

        try {
            const llmResponse = await generate({
                model: gemini15Flash,
                prompt: prompt,
                output: {
                    schema: z.object({
                        text: z.string(),
                        hashtags: z.array(z.string()),
                        suggestions: z.array(z.string()).optional()
                    })
                }
            });

            const output = llmResponse.output();

            if (output) {
                return {
                    text: output.text,
                    hashtags: output.hashtags,
                    suggestions: output.suggestions || [],
                    generatedImageUrl: undefined // TODO: Integrar generación de imágenes
                };
            }

            // Fallback si no hay output
            return {
                text: `¡Descubre ${input.productDescription}! Visítanos hoy 🎉`,
                hashtags: ['negocio', 'promo'],
                suggestions: ['El modelo no pudo generar, se usó texto por defecto']
            };

        } catch (error) {
            console.error('Error generating social post:', error);
            return {
                text: `¡Conoce nuestro ${input.productDescription}! Te esperamos 🌟`,
                hashtags: [],
                suggestions: ['Error en generación, se usó texto por defecto']
            };
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// FLUJO DE GENERACIÓN DE IMAGEN (PLACEHOLDER)
// ═══════════════════════════════════════════════════════════════

const imageGenerationInputSchema = z.object({
    productDescription: z.string(),
    niche: z.string(),
    imageBase64: z.string().optional(),
    style: z.string().optional()
});

const imageGenerationOutputSchema = z.object({
    imageUrl: z.string(),
    success: z.boolean()
});

// TODO: Implementar cuando el usuario proporcione las fórmulas de imagen
export const generateProductImage = defineFlow(
    {
        name: 'generateProductImage',
        inputSchema: imageGenerationInputSchema,
        outputSchema: imageGenerationOutputSchema
    },
    async (input) => {
        const nicheConfig = getNichePrompts(input.niche as NicheType);

        // Placeholder - El usuario proporcionará las fórmulas específicas
        const imagePrompt = nicheConfig?.imagePrompt || '';

        if (!imagePrompt) {
            console.log('Image prompt not configured for niche:', input.niche);
            return {
                imageUrl: '',
                success: false
            };
        }

        // TODO: Llamar a Google Imagen 3 o Flux aquí
        // Por ahora retornamos placeholder

        return {
            imageUrl: '', // URL de la imagen generada
            success: false
        };
    }
);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Genera un post de forma simplificada (para uso en API routes)
 */
export async function generateQuickPost(
    platform: SocialPlatform,
    productDescription: string,
    niche: string,
    businessName?: string
): Promise<SocialPostOutput> {
    // Esta función es un placeholder para uso en API routes
    // El flujo real se llama vía Genkit en el servidor

    // Por ahora retornamos un fallback
    const platformStyle = PLATFORM_STYLES[platform];

    let text = '';
    switch (platform) {
        case 'instagram':
            text = `✨ ${productDescription}\n\n¡No te lo pierdas! 🎉\n\n#NegocioLocal #Promo`;
            break;
        case 'facebook':
            text = `¡Hola amigos! 👋\n\n${productDescription}\n\n¡Los esperamos!`;
            break;
        case 'tiktok':
            text = `POV: ${productDescription} 🔥 #FYP #ParaTi`;
            break;
        case 'whatsapp':
            text = `Hola! 👋\n\n${productDescription}\n\n¿Te gustaría más información?`;
            break;
    }

    return {
        text,
        hashtags: platform !== 'whatsapp' ? ['michingon', 'negocio', 'promo'] : [],
        suggestions: ['Generado localmente - conectar con Genkit para IA completa']
    };
}
