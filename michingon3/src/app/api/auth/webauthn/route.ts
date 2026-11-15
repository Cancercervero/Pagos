import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════
// API ROUTE: /api/auth/webauthn
// Registro y validación de credenciales biométricas para Owner
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// POST - Registrar nueva credencial biométrica
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, credential } = body;

        if (!userId || !credential) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos' },
                { status: 400 }
            );
        }

        // Obtener usuario
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        // Agregar credencial
        const newCredential = {
            credentialId: credential.id,
            publicKey: credential.publicKey,
            deviceLabel: credential.deviceLabel || `${credential.platform} - ${new Date().toLocaleDateString()}`,
            deviceType: credential.deviceType || 'desktop',
            platform: credential.platform || 'unknown',
            browser: credential.browser,
            createdAt: Timestamp.now(),
            lastUsed: Timestamp.now(),
            isActive: true
        };

        // Actualizar usuario
        await updateDoc(userRef, {
            biometricCredentials: arrayUnion(newCredential),
            prefersBiometric: true,
            updatedAt: Timestamp.now()
        });

        return NextResponse.json({
            success: true,
            message: 'Credencial registrada exitosamente'
        });

    } catch (error) {
        console.error('Error registrando credencial:', error);
        return NextResponse.json(
            { error: 'Error registrando credencial' },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────
// PUT - Validar credencial y retornar usuario
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { credentialId } = body;

        if (!credentialId) {
            return NextResponse.json(
                { error: 'credentialId requerido' },
                { status: 400 }
            );
        }

        // TODO: Buscar usuario por credentialId en Firestore
        // Por ahora retornamos error ya que necesitaríamos un índice

        return NextResponse.json({
            error: 'Validación no implementada - usar email/password primero'
        }, { status: 501 });

    } catch (error) {
        console.error('Error validando credencial:', error);
        return NextResponse.json(
            { error: 'Error validando credencial' },
            { status: 500 }
        );
    }
}
