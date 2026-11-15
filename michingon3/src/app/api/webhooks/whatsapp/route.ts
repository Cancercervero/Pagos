import { NextRequest, NextResponse } from 'next/server';
import { handleWhatsAppMessage } from '@/ai/flows/whatsapp-flow';

// Verify Webhook (GET)
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // In a real app, use an environment variable for the verify token
    const VERIFY_TOKEN = 'michingon_verify_token';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

// Handle Incoming Messages (POST)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Check if this is an event from a WhatsApp API
        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from; // Sender's phone number
                const text = message.text?.body; // Message content

                if (text) {
                    // Process the message with AI
                    await handleWhatsAppMessage(from, text);
                }
            }
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else {
            return new NextResponse('Not Found', { status: 404 });
        }
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
