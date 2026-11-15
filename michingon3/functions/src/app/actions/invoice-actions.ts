'use server';

import { runFlow } from '@genkit-ai/flow';
import { parseInvoiceFlow } from '@/ai/flows/invoice-parser-flow';

export async function parseInvoiceAction(imageBase64: string) {
    try {
        // Ensure the image string is clean (remove data:image/jpeg;base64, prefix if present)
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

        const result = await runFlow(parseInvoiceFlow, {
            imageBase64: cleanBase64
        });

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error parsing invoice:', error);
        return { success: false, error: error.message };
    }
}
