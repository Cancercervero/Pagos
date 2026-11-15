'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, LogOut, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logOut } from '@/lib/firebase/auth';

export function AiAssistantWidget() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([
        { role: 'ai', text: `Hola ${user?.email?.split('@')[0] || 'Mao'}, ¿en qué puedo ayudarte hoy?` }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isOpen]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!message.trim()) return;

        const newMsg = message;
        setChatHistory(prev => [...prev, { role: 'user', text: newMsg }]);
        setMessage('');
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            setIsTyping(false);
            setChatHistory(prev => [...prev, {
                role: 'ai',
                text: 'Entendido. Estoy analizando tus datos... (Esta es una respuesta simulada por ahora)'
            }]);
        }, 1500);
    };

    const handleLogout = async () => {
        await logOut();
    };

    return (
        <div className={`
            border-t border-slate-800/50 bg-[#0f172a] transition-all duration-300 ease-in-out
            ${isOpen ? 'h-[500px]' : 'h-auto'}
            flex flex-col
        `}>
            {/* Expanded Chat Area */}
            {isOpen && (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
                    {/* Header */}
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Asistente IA</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <ChevronUp className="w-4 h-4 rotate-180" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] rounded-2xl px-3 py-2 text-sm
                                    ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                    }
                                `}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-700 flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900">
                        <div className="relative">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Pregunta algo..."
                                className="w-full bg-slate-800 text-white text-sm rounded-xl pl-3 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 border border-slate-700 placeholder:text-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={!message.trim()}
                                className="absolute right-1.5 top-1.5 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Collapsed / Trigger Area */}
            {!isOpen && (
                <div className="p-4">
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-full bg-gradient-to-r from-purple-900/50 to-blue-900/50 hover:from-purple-900/70 hover:to-blue-900/70 border border-purple-500/30 rounded-xl p-3 flex items-center gap-3 group transition-all duration-300 shadow-lg shadow-purple-900/10"
                    >
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-inner">
                                <span className="text-xl">🤖</span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0f172a] rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-0.5">Asistente IA</p>
                            <p className="text-sm text-white font-medium truncate group-hover:text-purple-200 transition-colors">
                                ¿En qué te ayudo?
                            </p>
                        </div>
                    </button>

                    {/* User / Logout Mini Footer */}
                    <div className="mt-4 flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-default">
                            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
                                {user?.email?.[0].toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-400 truncate max-w-[100px]">{user?.email?.split('@')[0]}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
