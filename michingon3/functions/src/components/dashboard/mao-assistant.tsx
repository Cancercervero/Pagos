'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Camera, Mic, Video, Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export function MaoAssistant() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string; type?: 'text' | 'image' | 'audio' }[]>([
        { role: 'ai', text: `¡Miau! Hola ${user?.email?.split('@')[0] || 'Humano'}, soy Mao. 🐱 ¿Qué necesitas?` }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isOpen]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!message.trim()) return;

        const newMsg = message;
        setChatHistory(prev => [...prev, { role: 'user', text: newMsg, type: 'text' }]);
        setMessage('');
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            setIsTyping(false);
            setChatHistory(prev => [...prev, {
                role: 'ai',
                text: '¡Entendido! Déjame revisar eso... 🐾'
            }]);
        }, 1500);
    };

    const handleMediaClick = (type: 'camera' | 'mic' | 'video') => {
        // Mock media interaction
        let text = '';
        if (type === 'camera') text = '📸 [Foto enviada]';
        if (type === 'mic') text = '🎤 [Audio enviado]';
        if (type === 'video') text = '🎥 [Video enviado]';

        setChatHistory(prev => [...prev, { role: 'user', text, type: 'text' }]);
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            setChatHistory(prev => [...prev, { role: 'ai', text: '¡Interesante! Lo estoy procesando. 😺' }]);
        }, 1500);
    };

    return (
        <div className="relative z-50">
            {/* Avatar Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative group transition-transform active:scale-95 focus:outline-none"
            >
                <div className={`
                    w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden transition-all duration-300
                    ${isOpen ? 'ring-4 ring-purple-400/50 scale-110' : 'hover:scale-105 hover:shadow-purple-500/20'}
                `}>
                    {/* Using the uploaded image as the avatar */}
                    <img
                        src="/mao-assistant.png"
                        alt="Mao Assistant"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback if image fails
                            e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mao&backgroundColor=b6e3f4';
                        }}
                    />
                </div>
                {/* Status Indicator */}
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>

                {/* Tooltip */}
                {!isOpen && (
                    <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        ¡Hola! Soy Mao 🐱
                    </div>
                )}
            </button>

            {/* Chat Popover */}
            {isOpen && (
                <div className="absolute top-14 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right flex flex-col max-h-[600px]">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-lg">🐱</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Mao Assistant</h3>
                                <p className="text-[10px] text-purple-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                    En línea y curiosa
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-[300px] max-h-[400px]">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-purple-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-700 rounded-bl-none border border-gray-100'
                                    }
                                `}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-gray-100 shadow-sm flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        {/* Multimedia Buttons */}
                        <div className="flex justify-around mb-3 px-2">
                            <button
                                onClick={() => handleMediaClick('camera')}
                                className="flex flex-col items-center gap-1 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium">Foto</span>
                            </button>
                            <button
                                onClick={() => handleMediaClick('mic')}
                                className="flex flex-col items-center gap-1 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                    <Mic className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium">Audio</span>
                            </button>
                            <button
                                onClick={() => handleMediaClick('video')}
                                className="flex flex-col items-center gap-1 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                                    <Video className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium">Video</span>
                            </button>
                        </div>

                        {/* Text Input */}
                        <form onSubmit={handleSendMessage} className="relative">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Escribe a Mao..."
                                className="w-full bg-gray-100 text-gray-900 text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 border-transparent focus:border-purple-500 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!message.trim()}
                                className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
