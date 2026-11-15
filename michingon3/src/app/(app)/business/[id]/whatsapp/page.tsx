'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Smartphone } from 'lucide-react';
import { auth } from '@/lib/firebase/config';

interface Msg { de: 'yo' | 'bot'; texto: string }

// Simulador del agente de WhatsApp (mismo cerebro que el webhook). Respaldo para la demo en vivo.
export default function WhatsappDemoPage() {
    const [telefono, setTelefono] = useState('');
    const [texto, setTexto] = useState('');
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [enviando, setEnviando] = useState(false);
    const fin = useRef<HTMLDivElement>(null);

    useEffect(() => fin.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

    const enviar = async () => {
        const t = texto.trim();
        if (!t || telefono.length !== 10) return;
        setMsgs((m) => [...m, { de: 'yo', texto: t }]);
        setTexto('');
        setEnviando(true);
        try {
            const token = await auth?.currentUser?.getIdToken();
            const res = await fetch('/api/agente/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ telefono10: telefono, texto: t }),
            });
            const j = await res.json();
            setMsgs((m) => [...m, { de: 'bot', texto: j.respuesta || j.error || 'Sin respuesta' }]);
        } catch (e) {
            setMsgs((m) => [...m, { de: 'bot', texto: (e as Error).message }]);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Smartphone className="w-6 h-6 text-green-600" /> Agente de WhatsApp</h1>
            <p className="text-sm text-gray-500 mb-4">Mismo agente que responde en WhatsApp. Si usas el número de un dueño (OWNER_PHONES) verás las funciones de dueño.</p>
            <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Tu celular (10 dígitos): el cobro CoDi llega ahí"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
            />
            <div className="h-[55vh] overflow-y-auto rounded-2xl bg-[#efeae2] p-4 space-y-2">
                {msgs.map((m, i) => (
                    <div key={i} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${m.de === 'yo' ? 'ml-auto bg-[#d9fdd3]' : 'bg-white'}`}>{m.texto}</div>
                ))}
                {enviando && <div className="bg-white rounded-xl px-3 py-2 w-fit"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                <div ref={fin} />
            </div>
            <div className="flex gap-2 mt-3">
                <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviar()}
                    placeholder="Ej. Quiero 2 shampoos para mañana a las 5"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button onClick={enviar} disabled={enviando || telefono.length !== 10} className="px-4 rounded-lg bg-green-600 disabled:bg-gray-300 text-white"><Send className="w-4 h-4" /></button>
            </div>
        </div>
    );
}
