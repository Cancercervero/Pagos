import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

const InventoryCountSchema = z.object({
    items: z.array(z.object({
        productName: z.string().describe('Name of the product'),
        quantity: z.number().describe('Counted quantity'),
        unit: z.string().optional().describe('Unit of measure if specified'),
    })).describe('List of counted items'),
    date: z.string().optional().describe('Date of the count if visible'),
});

export const parseInventoryCountFlow = defineFlow(
    {
        name: 'parseInventoryCount',
        inputSchema: z.object({
            imageBase64: z.string().describe('Base64 encoded image of the inventory count sheet')
        }),
        outputSchema: InventoryCountSchema,
    },
    async ({ imageBase64 }) => {
        const prompt = `
      Analyze this image of an inventory count sheet (handwritten or printed) and extract the following information:
      - List of products and their counted quantities.
      - Date of the count (if visible).
      
      Return the data in JSON format matching the schema.
    `;

        const response = await generate({
            model: gemini15Flash,
            prompt: [
                { text: prompt },
                { media: { url: imageBase64, contentType: 'image/jpeg' } }
            ],
            output: { schema: InventoryCountSchema }
        });

        if (!response.output()) {
            throw new Error('Failed to extract data from inventory count image');
        }

        return response.output()!;
    }
);
