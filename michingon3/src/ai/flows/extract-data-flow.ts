import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';

const ExtractedDataSchema = z.object({
    products: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        price: z.number().optional(),
        stock: z.number().optional(),
        unit: z.string().optional(),
    })).optional(),
    suppliers: z.array(z.object({
        name: z.string(),
        rfc: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
    })).optional(),
    clients: z.array(z.object({
        name: z.string(),
        rfc: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
    })).optional(),
});

export const extractDataFromText = defineFlow(
    {
        name: 'extractDataFromText',
        inputSchema: z.string(),
        outputSchema: ExtractedDataSchema,
    },
    async (text) => {
        const prompt = `
            You are an expert data extraction assistant.
            Analyze the following text which comes from a business document (invoice, inventory list, etc.).
            Extract any products, suppliers, or clients you find.
            
            Text:
            ${text}
        `;

        const llmResponse = await generate({
            model: gemini15Flash,
            prompt: prompt,
            output: { schema: ExtractedDataSchema },
        });

        return llmResponse.output() || { products: [], suppliers: [], clients: [] };
    }
);
