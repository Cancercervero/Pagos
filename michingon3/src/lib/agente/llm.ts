// LLM del agente (NUEVO; la IA Genkit de Michingón no se usa).
// Cliente compatible con OpenAI vía fetch: Grok (https://api.x.ai/v1), Gemini
// (https://generativelanguage.googleapis.com/v1beta/openai/) u otro.
// Variables: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL (y opcional LLM_VISION_MODEL).

type Parte = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type Mensaje = { role: 'system' | 'user' | 'assistant'; content: string | Parte[] };

export function llmDisponible(): boolean {
    return !!(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

export async function chat(mensajes: Mensaje[], opciones: { modelo?: string; temperatura?: number; timeoutMs?: number } = {}) {
    if (!llmDisponible()) throw new Error('LLM no configurado (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)');
    const base = process.env.LLM_BASE_URL!.replace(/\/$/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opciones.timeoutMs ?? 45_000);
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: opciones.modelo || process.env.LLM_MODEL,
                messages: mensajes,
                temperature: opciones.temperatura ?? 0.1,
            }),
            signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 200)}`);
        return String(data?.choices?.[0]?.message?.content ?? '');
    } finally {
        clearTimeout(timer);
    }
}

/** Extrae el primer objeto JSON de la respuesta del modelo (tolera ```json ... ```). */
export function parsearJSON<T = unknown>(texto: string): T {
    const limpio = texto.replace(/```(?:json)?/gi, '').trim();
    const i = limpio.indexOf('{');
    const j = limpio.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('El modelo no devolvió JSON');
    return JSON.parse(limpio.slice(i, j + 1)) as T;
}

export async function chatJSON<T = unknown>(system: string, usuario: string, imagenesDataUrl: string[] = []): Promise<T> {
    const content: Parte[] = [{ type: 'text', text: usuario }, ...imagenesDataUrl.map((url) => ({ type: 'image_url' as const, image_url: { url } }))];
    const texto = await chat(
        [
            { role: 'system', content: `${system}\nResponde ÚNICAMENTE con un objeto JSON válido, sin texto adicional.` },
            { role: 'user', content: imagenesDataUrl.length ? content : usuario },
        ],
        { modelo: imagenesDataUrl.length ? process.env.LLM_VISION_MODEL || process.env.LLM_MODEL : undefined },
    );
    return parsearJSON<T>(texto);
}
