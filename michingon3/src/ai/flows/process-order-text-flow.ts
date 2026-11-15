import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import * as z from 'zod';

// Schema for the extracted order data (same as order-scanner-flow)
const OrderSchema = z.object({
    clientName: z.string().describe('The name of the client or customer placing the order'),
    deliveryDate: z.string().optional().describe('The requested delivery date in YYYY-MM-DD format'),
    deliveryTime: z.string().optional().describe('The requested delivery time'),
    items: z.array(z.object({
        productName: z.string(),
        quantity: z.number(),
        notes: z.string().optional()
    })).describe('List of items ordered'),
    notes: z.string().optional().describe('Any special instructions or notes for the order')
});

export const processOrderTextFlow = defineFlow(
    {
        name: 'processOrderText',
        inputSchema: z.object({
            text: z.string().describe('The raw text of the order (e.g. from voice dictation or pasted text)')
        }),
        outputSchema: OrderSchema,
    },
    async ({ text }) => {
        const prompt = `
      Analyze this text order and extract the following information:
      - Client Name (who is ordering?)
      - Items ordered (product name and quantity)
      - Delivery Date/Time (if specified)
      - Special Notes
      
      Text: "${text}"
      
      Return the data in JSON format matching the schema.
      If the date is relative (e.g. "tomorrow"), assume today is ${new Date().toISOString().split('T')[0]} and calculate the date.
    `;

        const response = await generate({
            model: gemini15Flash,
            prompt: prompt,
            output: { schema: OrderSchema }
        });

        if (!response.output()) {
            throw new Error('Failed to extract data from order text');
        }

        return response.output()!;
    }
);
