'use server';

// TODO: Todos los flows de IA están pendientes - comentados temporalmente
// import { parseInvoiceFlow } from '@/ai/flows/invoice-parser-flow';
// import { parseOrderFlow } from '@/ai/flows/order-scanner-flow';
// import { parseProductFlow } from '@/ai/flows/product-scanner-flow';
// import { parseInventoryCountFlow } from '@/ai/flows/inventory-count-flow';
// import { parseContactFlow } from '@/ai/flows/contact-scanner-flow';
// import { processOrderTextFlow } from '@/ai/flows/process-order-text-flow';
// import { runFlow } from '@genkit-ai/flow';

export type ScanResult =
    | { success: true; data: any }
    | { success: false; error: string; reason?: string; data?: never };

export async function scanInvoice(formData: FormData): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}

export async function scanOrder(formData: FormData): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}

export async function scanProduct(formData: FormData): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}

export async function scanInventoryCount(formData: FormData): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}

export async function scanContact(formData: FormData): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}

export async function processOrderText(text: string): Promise<ScanResult> {
    return { success: false, error: 'Flow de IA no disponible aún' };
}
