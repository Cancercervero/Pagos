import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

const ContactSchema = z.object({
    name: z.string().describe('Name of the person or company'),
    rfc: z.string().optional().describe('RFC (Tax ID) if visible'),
    address: z.string().optional().describe('Full address'),
    phone: z.string().optional().describe('Phone number'),
    email: z.string().optional().describe('Email address'),
    type: z.enum(['client', 'supplier']).optional().describe('Inferred type of contact based on context or content'),
});

export const parseContactFlow = defineFlow(
    {
        name: 'parseContact',
        inputSchema: z.object({
            imageBase64: z.string().describe('Base64 encoded image of the business card or document')
        }),
        outputSchema: ContactSchema,
    },
    async ({ imageBase64 }) => {
        const prompt = `
      Analyze this image of a business card or contact document and extract the following information:
      - Name (Person or Company)
      - RFC (Tax ID, usually starts with 3 or 4 letters followed by 6 numbers and 3 alphanumeric characters)
      - Address
      - Phone Number
      - Email Address
      - Type (Infer if it looks like a supplier or a client, default to client if unsure)
      
      Return the data in JSON format matching the schema.
    `;

        const response = await generate({
            model: gemini15Flash,
            prompt: [
                { text: prompt },
                { media: { url: imageBase64, contentType: 'image/jpeg' } }
            ],
            output: { schema: ContactSchema }
        });

        if (!response.output()) {
            throw new Error('Failed to extract data from contact image');
        }

        return response.output()!;
    }
);
