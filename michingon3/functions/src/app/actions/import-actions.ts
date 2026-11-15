'use server';

import { extractDataFromText } from '@/ai/flows/extract-data-flow';
import { runFlow } from '@genkit-ai/flow';
import * as XLSX from 'xlsx';
// import pdf from 'pdf-parse'; // We'll handle PDF dynamically to avoid strict type issues for now

export async function processUploadedFile(formData: FormData) {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    let textContent = '';

    try {
        const buffer = await file.arrayBuffer();

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            textContent = XLSX.utils.sheet_to_csv(worksheet);
        }
        // else if (file.name.endsWith('.pdf')) {
        //     const pdfParse = require('pdf-parse');
        //     const data = await pdfParse(Buffer.from(buffer));
        //     textContent = data.text;
        // } 
        else {
            // Assume text/markdown/etc
            textContent = Buffer.from(buffer).toString('utf-8');
        }

        // Call Genkit Flow
        const result = await runFlow(extractDataFromText, textContent);

        return { success: true, data: result };

    } catch (error) {
        console.error('Error processing file:', error);
        return { success: false, error: 'Failed to process file' };
    }
}
