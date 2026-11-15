import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { generate } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/googleai';

// Mock function to send message back to WhatsApp
async function sendWhatsAppMessage(to: string, body: string) {
    console.log(`>>> SENDING WHATSAPP TO ${to}: ${body}`);
    // In production, call the Meta Graph API here
}

export const handleWhatsAppMessage = async (from: string, text: string) => {
    // We define a flow to process the message
    // Ideally this would be a registered flow, but for direct usage we can just wrap the logic

    console.log(`<<< RECEIVED WHATSAPP FROM ${from}: ${text}`);

    const prompt = `
        You are a helpful assistant for a business called "Michingon".
        Your goal is to help customers place orders or answer questions.
        
        Customer Message: "${text}"
        
        If the customer wants to place an order, extract the items.
        If they are saying hello, greet them warmly.
        If they have a question, answer it briefly.
        
        Respond with a JSON object:
        {
            "intent": "order" | "greeting" | "question" | "unknown",
            "reply": "The text you want to send back to the user",
            "orderItems": [{"item": "name", "quantity": "amount"}] (only if intent is order)
        }
    `;

    try {
        const llmResponse = await generate({
            model: gemini15Flash,
            prompt: prompt,
            output: {
                schema: z.object({
                    intent: z.enum(['order', 'greeting', 'question', 'unknown']),
                    reply: z.string(),
                    orderItems: z.array(z.object({
                        item: z.string(),
                        quantity: z.string().optional()
                    })).optional()
                })
            }
        });

        const output = llmResponse.output();

        if (output) {
            await sendWhatsAppMessage(from, output.reply);

            if (output.intent === 'order' && output.orderItems) {
                console.log('!!! CREATING ORDER:', output.orderItems);
                // Here we would call a DB function to save the order
            }
        } else {
            await sendWhatsAppMessage(from, "Lo siento, no entendí tu mensaje.");
        }

    } catch (error) {
        console.error('Error processing WhatsApp message:', error);
        await sendWhatsAppMessage(from, "Tuve un error procesando tu mensaje.");
    }
};
