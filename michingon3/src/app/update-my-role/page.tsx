'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function UpdateMyRole() {
    const { user } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!user) {
            setStatus('error');
            setMessage('❌ No hay usuario logueado');
            return;
        }

        const updateUserRole = async () => {
            try {
                setMessage('🔄 Actualizando tu perfil...');

                await updateDoc(doc(db, 'users', user.uid), {
                    role: 'owner',
                    fullName: 'Samuel Hernández',
                    phone: '4431234567',
                    businessName: 'Mao Mao',
                    updatedAt: new Date().toISOString(),
                });

                setStatus('success');
                setMessage('✅ ¡Perfil actualizado correctamente!');

                // Redirect al dashboard después de 2 segundos
                setTimeout(() => {
                    router.push('/');
                    window.location.reload(); // Force reload para cargar nuevo perfil
                }, 2000);
            } catch (error) {
                console.error('Error updating user:', error);
                setStatus('error');
                setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };

        updateUserRole();
    }, [user, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center">
                    {status === 'loading' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto mb-4"></div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Actualizando perfil...</h1>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="text-6xl mb-4">👑</div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Listo!</h1>
                            <p className="text-gray-600 mb-4">Eres el Owner de Mao Mao</p>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-green-800 text-sm">
                                    Redirigiendo al dashboard...
                                </p>
                            </div>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="text-6xl mb-4">❌</div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-800 text-sm">{message}</p>
                            </div>
                            <button
                                onClick={() => router.push('/')}
                                className="mt-4 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition"
                            >
                                Volver al inicio
                            </button>
                        </>
                    )}

                    <p className="text-gray-500 text-sm mt-4">{message}</p>
                </div>
            </div>
        </div>
    );
}
