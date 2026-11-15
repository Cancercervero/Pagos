import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import * as z from 'zod';

// Schema for the extracted invoice data
const InvoiceSchema = z.object({
    folio: z.string().describe('The invoice folio or number'),
    date: z.string().describe('The date of the invoice in YYYY-MM-DD format'),
    supplierName: z.string().describe('The name of the supplier or provider'),
    total: z.number().describe('The total amount of the invoice'),
    subtotal: z.number().optional().describe('The subtotal amount before taxes'),
    tax: z.number().optional().describe('The tax amount (IVA)'),
    items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        total: z.number()
    })).optional().describe('List of items in the invoice')
});

export const parseInvoiceFlow = defineFlow(
    {
        name: 'parseInvoice',
        inputSchema: z.object({
            imageBase64: z.string().describe('Base64 encoded image of the invoice')
        }),
        outputSchema: InvoiceSchema,
    },
    async ({ imageBase64 }) => {
        const prompt = `
      Analyze this invoice image and extract the following information:
      - Folio/Invoice Number
      - Date
      - Supplier Name
      - Total Amount
      - Subtotal
      - Tax
      - Items (if legible)
      
      Return the data in JSON format matching the schema.
    `;

        const response = await generate({
            model: gemini15Flash,
            prompt: [
                { text: prompt },
                { media: { url: imageBase64, contentType: 'image/jpeg' } } // Assuming JPEG for simplicity, can be dynamic
            ],
            output: { schema: InvoiceSchema }
        });

        if (!response.output()) {
            throw new Error('Failed to extract data from invoice');
        }

        return response.output()!;
    }
);
