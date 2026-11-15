import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route para escanear recetas con IA
 * Recibe imagen de receta escrita/impresa
 * Retorna ingredientes y pasos extraídos
 */
export async function POST(req: NextRequest) {
    try {
        const { imageBase64 } = await req.json();

        if (!imageBase64) {
            return NextResponse.json(
                { error: 'No se proporcionó imagen' },
                { status: 400 }
            );
        }

        // TODO: Integrar con Gemini 2.0 Flash para OCR
        // Por ahora retornamos datos de prueba
        const mockRecipe = {
            name: 'Gorditas de Chicharrón',
            category: 'Platillos',
            ingredients: [
                { name: 'Masa de maíz', quantity: '500', unit: 'g' },
                { name: 'Chicharrón', quantity: '200', unit: 'g' },
                { name: 'Salsa verde', quantity: '100', unit: 'ml' },
                { name: 'Frijoles', quantity: '150', unit: 'g' },
                { name: 'Queso fresco', quantity: '100', unit: 'g' }
            ],
            procedure: [
                'Preparar la masa y formar las gorditas',
                'Calentar el comal y cocinar las gorditas por ambos lados',
                'Abrir las gorditas y rellenar con chicharrón',
                'Agregar frijoles, queso y salsa al gusto',
                'Servir caliente'
            ]
        };

        return NextResponse.json({
            success: true,
            recipe: mockRecipe
        });

    } catch (error: any) {
        console.error('Error scanning recipe:', error);
        return NextResponse.json(
            { error: error.message || 'Error al procesar imagen' },
            { status: 500 }
        );
    }
}
