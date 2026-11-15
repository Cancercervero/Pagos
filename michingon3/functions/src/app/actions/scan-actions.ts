'use server';

import { parseInvoiceFlow } from '@/ai/flows/invoice-parser-flow';
import { parseOrderFlow } from '@/ai/flows/order-scanner-flow';
import { parseProductFlow } from '@/ai/flows/product-scanner-flow';
import { parseInventoryCountFlow } from '@/ai/flows/inventory-count-flow';
import { parseContactFlow } from '@/ai/flows/contact-scanner-flow';
import { processOrderTextFlow } from '@/ai/flows/process-order-text-flow';
import { runFlow } from '@genkit-ai/flow';

export async function scanInvoice(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Call Genkit Flow
        const result = await runFlow(parseInvoiceFlow, { imageBase64: dataUrl });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error scanning invoice:', error);
        return { success: false, error: 'Failed to scan invoice' };
    }
}

export async function scanOrder(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Call Genkit Flow
        const result = await runFlow(parseOrderFlow, { imageBase64: dataUrl });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error scanning order:', error);
        return { success: false, error: 'Failed to scan order' };
    }
}

export async function scanProduct(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Call Genkit Flow
        const result = await runFlow(parseProductFlow, { imageBase64: dataUrl });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error scanning product:', error);
        return { success: false, error: 'Failed to scan product' };
    }
}

export async function scanInventoryCount(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Call Genkit Flow
        const result = await runFlow(parseInventoryCountFlow, { imageBase64: dataUrl });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error scanning inventory count:', error);
        return { success: false, error: 'Failed to scan inventory count' };
    }
}

export async function scanContact(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Call Genkit Flow
        const result = await runFlow(parseContactFlow, { imageBase64: dataUrl });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error scanning contact:', error);
        return { success: false, error: 'Failed to scan contact' };
    }
}

export async function processOrderText(text: string) {
    if (!text) {
        return { success: false, error: 'No text provided' };
    }

    try {
        // Call Genkit Flow
        const result = await runFlow(processOrderTextFlow, { text });

        return { success: true, data: result };

    } catch (error) {
        console.error('Error processing order text:', error);
        return { success: false, error: 'Failed to process order text' };
    }
}
