'use server';

// TODO: Flows de IA pendientes
// import { extractDataFromText } from '@/ai/flows/extract-data-flow';
// import { runFlow } from '@genkit-ai/flow';
import { ScanResult } from './scan-actions';

export async function processUploadedFile(formData: FormData): Promise<ScanResult> {
    return {
        success: false,
        error: 'Flow de importación no disponible aún'
    };
}
