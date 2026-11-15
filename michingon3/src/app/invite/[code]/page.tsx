'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Fingerprint } from 'lucide-react';
import { isInvitationValid } from '@/types/invitation-types';
import type { EmployeeInvitation } from '@/types/invitation-types';

// ═══════════════════════════════════════════════════════════════
// PÁGINA DE ONBOARDING - /invite/[code]
// Empleado completa su registro con FaceID
// ═══════════════════════════════════════════════════════════════

export default function InvitePage({
    params
}: {
    params: Promise<{ code: string }>
}) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [step, setStep] = useState<'loading' | 'welcome' | 'register' | 'success' | 'error'>('loading');
    const [invitation, setInvitation] = useState<EmployeeInvitation | null>(null);
    const [error, setError] = useState<string>('');
    const [registering, setRegistering] = useState(false);

    // Validar código al cargar
    useEffect(() => {
        validateInvitation();
    }, [resolvedParams.code]);

    const validateInvitation = async () => {
        try {
            const response = await fetch(`/api/workforce/invite?code=${resolvedParams.code}`);

            if (!response.ok) {
                setStep('error');
                setError('Invitación no encontrada');
                return;
            }

            const { invitation: inv } = await response.json();

            // Validar estado
            const validation = isInvitationValid(inv);
            if (!validation.valid) {
                setStep('error');
                setError(validation.reason || 'Invitación inválida');
                return;
            }

            setInvitation(inv);
            setStep('welcome');

        } catch (err) {
            console.error('Error validando invitación:', err);
            setStep('error');
            setError('Error validando invitación');
        }
    };

    const handleRegisterBiometric = async () => {
        if (!invitation) return;

        setRegistering(true);

        try {
            // 1. Verificar soporte de WebAuthn
            if (!window.PublicKeyCredential) {
                throw new Error('Tu dispositivo no soporta autenticación biométrica');
            }

            // 2. Crear credencial WebAuthn
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: "Michingon3",
                        id: window.location.hostname
                    },
                    user: {
                        id: new Uint8Array(16),
                        name: invitation.employeeData.phoneNumber,
                        displayName: invitation.employeeData.fullName
                    },
                    pubKeyCredParams: [
                        { type: "public-key", alg: -7 },  // ES256
                        { type: "public-key", alg: -257 } // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                        requireResidentKey: false
                    },
                    timeout: 60000,
                    attestation: "none"
                }
            });

            if (!credential) {
                throw new Error('No se pudo crear la credencial');
            }

            // 3. Crear empleado en Firestore vía API
            const createResponse = await fetch('/api/workforce/create-employee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invitationCode: resolvedParams.code,
                    employeeData: {
                        ...invitation.employeeData,
                        businessId: invitation.businessId
                    },
                    credential: {
                        id: credential.id,
                        publicKey: 'base64-encoded-key', // TODO: Encode properly
                        deviceLabel: `${navigator.platform} - ${new Date().toLocaleDateString()}`,
                        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                        platform: navigator.platform
                    }
                })
            });

            if (!createResponse.ok) {
                throw new Error('Error creando cuenta de empleado');
            }

            const { uid } = await createResponse.json();

            // 4. Marcar invitación como usada
            await fetch('/api/workforce/invite', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: resolvedParams.code,
                    userId: uid
                })
            });

            setStep('success');

            // 5. Redirect a login después de 3 segundos
            setTimeout(() => {
                window.location.href = `/`;  // Puede hacer login con biometría
            }, 3000);

        } catch (err: any) {
            console.error('Error registrando biométrico:', err);
            setError(err.message || 'Error al registrar tu rostro/huella');
            setRegistering(false);
        }
    };

    if (step === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Validando invitación...</p>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">Invitación Inválida</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'welcome') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Fingerprint className="w-10 h-10 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            ¡Bienvenido, {invitation?.employeeData.fullName}!
                        </h1>
                        <p className="text-gray-600">
                            Has sido invitado a unirte al equipo como{' '}
                            <span className="font-semibold text-blue-600">
                                {invitation?.employeeData.role}
                            </span>
                        </p>
                    </div>

                    {/* Info card */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <h2 className="font-semibold text-blue-900 mb-3">
                            Configura tu acceso biométrico
                        </h2>
                        <p className="text-sm text-blue-700 mb-4">
                            Para garantizar la seguridad, usaremos tu rostro o huella digital para que accedas rápidamente.
                        </p>
                        <ul className="text-sm text-blue-700 space-y-2">
                            <li>✓ Sin contraseñas que recordar</li>
                            <li>✓ Acceso en 2 segundos</li>
                            <li>✓ 100% seguro y privado</li>
                        </ul>
                    </div>

                    {/* Restricciones */}
                    {invitation && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <p className="text-sm font-medium text-yellow-900 mb-2">
                                ⚠️ Restricciones de acceso:
                            </p>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                <li>
                                    • Horario: {invitation.employeeData.schedule.start} -{' '}
                                    {invitation.employeeData.schedule.end}
                                </li>
                                <li>• Ubicación: Solo desde el negocio</li>
                                <li>• Check-in automático al entrar</li>
                            </ul>
                        </div>
                    )}

                    {/* Botón principal */}
                    <button
                        onClick={handleRegisterBiometric}
                        disabled={registering}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {registering ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                Registrando...
                            </>
                        ) : (
                            <>
                                <Fingerprint className="w-6 h-6" />
                                Escanear mi Rostro/Huella
                            </>
                        )}
                    </button>

                    {error && (
                        <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
                    )}
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">¡Registro Completado!</h1>
                    <p className="text-gray-600 mb-6">
                        Tu acceso biométrico ha sido configurado exitosamente.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Redirigiendo al dashboard...</span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
