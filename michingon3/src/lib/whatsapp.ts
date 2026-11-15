// WhatsApp Cloud API (Meta Graph). SOLO servidor.
// Variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION (v21.0)

/** WhatsApp manda "521XXXXXXXXXX" o "52XXXXXXXXXX"; pey y Michingón usan 10 dígitos. */
export function telefono10(waId: string): string {
    return String(waId || '').replace(/\D/g, '').slice(-10);
}

export function esDueno(tel10: string): boolean {
    return (process.env.OWNER_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean).includes(tel10);
}

export function esStaff(tel10: string): boolean {
    return (process.env.STAFF_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean).includes(tel10);
}

async function enviar(to: string, payload: Record<string, unknown>): Promise<boolean> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
        console.warn('[whatsapp] sin WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID; mensaje no enviado a', to.slice(-4));
        return false;
    }
    const v = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const intentar = async (dest: string) => {
        const res = await fetch(`https://graph.facebook.com/${v}/${phoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: dest, ...payload }),
        });
        if (!res.ok) console.warn('[whatsapp] envío falló', res.status, (await res.text()).slice(0, 200));
        return res.ok;
    };
    const digitos = to.replace(/\D/g, '');
    if (await intentar(digitos)) return true;
    // Peculiaridad de México: si "521..." falla, reintenta con "52" + 10 dígitos
    if (digitos.startsWith('521') && digitos.length === 13) return intentar(`52${digitos.slice(3)}`);
    if (digitos.length === 10) return intentar(`52${digitos}`);
    return false;
}

/** Acepta wa_id (52/521...) o 10 dígitos (asume México). */
export function destino(tel: string): string {
    const d = tel.replace(/\D/g, '');
    return d.length === 10 ? `52${d}` : d;
}

export function enviarTexto(tel: string, texto: string) {
    return enviar(destino(tel), { type: 'text', text: { preview_url: false, body: texto.slice(0, 4000) } });
}

export function enviarImagen(tel: string, link: string, caption?: string) {
    return enviar(destino(tel), { type: 'image', image: { link, caption } });
}

export async function avisarDuenos(texto: string) {
    const duenos = (process.env.OWNER_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean);
    await Promise.all(duenos.map((t) => enviarTexto(t, texto)));
}
