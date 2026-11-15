import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

const ProductSchema = z.object({
    name: z.string().describe('Name of the product'),
    description: z.string().optional().describe('Short description of the product'),
    price: z.number().optional().describe('Suggested retail price if visible'),
    barcode: z.string().optional().describe('Barcode number if visible'),
    category: z.string().optional().describe('Product category (e.g., Bebidas, Snacks, Lácteos)'),
    unit: z.enum(['pz', 'kg', 'lt']).optional().describe('Unit of measure'),
});

export const parseProductFlow = defineFlow(
    {
        name: 'parseProduct',
        inputSchema: z.object({
            imageBase64: z.string().describe('Base64 encoded image of the product or packaging')
        }),
        outputSchema: ProductSchema,
    },
    async ({ imageBase64 }) => {
        const prompt = `
      Analyze this image of a product (packaging, label, or the product itself) and extract the following information:
      - Product Name (be specific, e.g., "Coca Cola 600ml")
      - Description (brief)
      - Price (if a price tag is visible)
      - Barcode (if a barcode is visible and readable)
      - Category (infer from the product type)
      - Unit (infer from the product type: 'pz' for units, 'kg' for weight, 'lt' for liquids)
      
      Return the data in JSON format matching the schema.
    `;

        const response = await generate({
            model: gemini15Flash,
            prompt: [
                { text: prompt },
                { media: { url: imageBase64, contentType: 'image/jpeg' } }
            ],
            output: { schema: ProductSchema }
        });

        if (!response.output()) {
            throw new Error('Failed to extract data from product image');
        }

        return response.output()!;
    }
);
