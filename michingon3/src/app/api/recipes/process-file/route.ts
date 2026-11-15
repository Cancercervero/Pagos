import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route para procesar archivos de recetas
 * Recibe PDF, Word o Excel
 * Retorna ingredientes y pasos extraídos
 */
export async function POST(req: NextRequest) {
    try {
        const { fileData, fileName, fileType } = await req.json();

        if (!fileData) {
            return NextResponse.json(
                { error: 'No se proporcionó archivo' },
                { status: 400 }
            );
        }

        // TODO: Integrar procesamiento real de archivos
        // PDF: pdf-parse, Word: mammoth, Excel: xlsx
        // Por ahora retornamos datos de prueba
        const mockRecipe = {
            name: 'Tacos al Pastor (desde archivo)',
            category: 'Platillos',
            ingredients: [
                { name: 'Carne de cerdo marinada', quantity: '1', unit: 'kg' },
                { name: 'Piña', quantity: '200', unit: 'g' },
                { name: 'Tortillas', quantity: '20', unit: 'pza' },
                { name: 'Cebolla', quantity: '100', unit: 'g' },
                { name: 'Cilantro', quantity: '50', unit: 'g' },
                { name: 'Limón', quantity: '4', unit: 'pza' }
            ],
            procedure: [
                'Preparar la carne marinada con especias al pastor',
                'Cocinar la carne en trompo o comal',
                'Calentar las tortillas',
                'Servir con piña, cebolla y cilantro picados',
                'Acompañar con limón y salsa al gusto'
            ]
        };

        return NextResponse.json({
            success: true,
            recipe: mockRecipe
        });

    } catch (error: any) {
        console.error('Error processing file:', error);
        return NextResponse.json(
            { error: error.message || 'Error al procesar archivo' },
            { status: 500 }
        );
    }
}
