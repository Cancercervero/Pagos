'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
    const router = useRouter();
    const { user, loading, login, register, googleSignIn } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checkingBusiness, setCheckingBusiness] = useState(false);

    useEffect(() => {
        const checkUserBusiness = async () => {
            // Solo verificar si ya terminó de cargar Y hay usuario
            if (!loading && user) {
                setCheckingBusiness(true);
                try {
                    // Check if user has a business already
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists() && userDoc.data()?.businessId) {
                        // User has a business, go to dashboard
                        router.push(`/business/${userDoc.data().businessId}`);
                    } else {
                        // New user, go to onboarding
                        router.push('/onboarding');
                    }
                } catch (err) {
                    console.error('Error checking user business:', err);
                    // On error, go to onboarding as fallback
                    router.push('/onboarding');
                } finally {
                    setCheckingBusiness(false);
                }
            }
        };

        checkUserBusiness();
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Ocurrió un error al intentar autenticar.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsSubmitting(true);
        try {
            await googleSignIn();
        } catch (err: any) {
            console.error(err);
            setError('Error al iniciar sesión con Google.');
            setIsSubmitting(false);
        }
    };

    if (loading || checkingBusiness) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                {checkingBusiness && (
                    <p className="text-gray-400 mt-4 text-sm">Verificando tu negocio...</p>
                )}
                {loading && (
                    <p className="text-gray-400 mt-4 text-sm">Cargando sesión...</p>
                )}
            </div>
        );
    }

    // Si ya hay usuario, no mostrar login (está redirigiendo)
    if (user) return null;

    return (
        <div className="min-h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />

            {/* Left Side - Hero Content */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center p-16 relative z-10">
                <div className="max-w-xl">
                    <h1 className="text-6xl font-bold mb-6 leading-tight">
                        Gestiona tu negocio <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                            al siguiente nivel
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                        Michingon3 es la plataforma integral para el control total de tu empresa.
                        Facturación, inventario y análisis en un solo lugar.
                    </p>

                    <div className="space-y-4">
                        {[
                            'Dashboard en tiempo real',
                            'Gestión de inventario inteligente',
                            'Facturación automatizada',
                            'Reportes detallados'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center space-x-3 text-gray-300">
                                <CheckCircle2 className="h-5 w-5 text-purple-500" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
                <div className="w-full max-w-md">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold mb-2">
                                {isLogin ? 'Bienvenido de nuevo' : 'Crear cuenta'}
                            </h2>
                            <p className="text-gray-400">
                                {isLogin
                                    ? 'Ingresa tus credenciales para continuar'
                                    : 'Comienza a gestionar tu negocio hoy mismo'}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Correo electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="nombre@empresa.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</span>
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>

                            {/* Link recuperar contraseña */}
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!email) {
                                            setError('Ingresa tu email primero');
                                            return;
                                        }
                                        try {
                                            const { resetPassword } = await import('@/lib/firebase/auth');
                                            await resetPassword(email);
                                            alert('📧 Email enviado! Revisa tu bandeja de entrada para recuperar tu contraseña.');
                                        } catch (err: any) {
                                            console.error(err);
                                            setError('Error al enviar email. Verifica que el correo sea correcto.');
                                        }
                                    }}
                                    className="text-sm text-gray-400 hover:text-purple-400 transition-colors text-center"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            )}
                        </form>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-[#0a0a0a] text-gray-500 bg-opacity-50 backdrop-blur-xl">
                                    O continúa con
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span>Google</span>
                        </button>

                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-gray-400 hover:text-white text-sm transition-colors"
                            >
                                {isLogin
                                    ? '¿No tienes una cuenta? Regístrate'
                                    : '¿Ya tienes una cuenta? Inicia sesión'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
