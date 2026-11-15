import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateInvitationCode, createInvitationLink } from '@/types/invitation-types';
import type { EmployeeInvitation } from '@/types/invitation-types';

// ═══════════════════════════════════════════════════════════════
// API ROUTE: /api/workforce/invite
// Crea invitaciones de un solo uso para empleados sin email
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { businessId, employeeData, currentUserId, currentUserName } = body;

        // Validar datos requeridos
        if (!businessId || !employeeData) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos' },
                { status: 400 }
            );
        }

        // Generar código único
        const code = generateInvitationCode(12);

        // Calcular fecha de expiración (7 días)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const now = new Date();

        // Crear documento de invitación
        const invitation = {
            id: code,
            code,
            businessId,
            employeeData,
            createdBy: currentUserId || 'system',
            createdByName: currentUserName || 'Sistema',
            createdAt: Timestamp.fromDate(now),
            expiresAt: Timestamp.fromDate(expiresAt),
            status: 'pending' as const,
            used: false,
            attempts: 0
        };

        // Guardar en Firestore
        await setDoc(doc(db, 'invitations', code), invitation);

        // Generar link completo
        const linkData = createInvitationLink(code);

        return NextResponse.json({
            success: true,
            invitationLink: linkData.url,
            code,
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Error creando invitación:', error);
        return NextResponse.json(
            { error: 'Error creando invitación' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// GET - Obtener invitación por código
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json(
                { error: 'Código no proporcionado' },
                { status: 400 }
            );
        }

        // Obtener de Firestore
        const invitationDoc = await getDoc(doc(db, 'invitations', code));

        if (!invitationDoc.exists()) {
            return NextResponse.json(
                { error: 'Invitación no encontrada' },
                { status: 404 }
            );
        }

        const data = invitationDoc.data();

        // Convertir Timestamps a Dates para el cliente
        const invitation = {
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            expiresAt: data.expiresAt?.toDate?.() || new Date(data.expiresAt),
            usedAt: data.usedAt?.toDate?.() || (data.usedAt ? new Date(data.usedAt) : undefined),
            lastAttemptAt: data.lastAttemptAt?.toDate?.() || (data.lastAttemptAt ? new Date(data.lastAttemptAt) : undefined)
        };

        return NextResponse.json({
            success: true,
            invitation
        });

    } catch (error) {
        console.error('Error obteniendo invitación:', error);
        return NextResponse.json(
            { error: 'Error obteniendo invitación' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// PUT - Marcar invitación como usada
// ═══════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { code, userId } = body;

        if (!code || !userId) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos' },
                { status: 400 }
            );
        }

        const invitationRef = doc(db, 'invitations', code);
        const invitationDoc = await getDoc(invitationRef);

        if (!invitationDoc.exists()) {
            return NextResponse.json(
                { error: 'Invitación no encontrada' },
                { status: 404 }
            );
        }

        // Actualizar invitación
        await setDoc(invitationRef, {
            ...invitationDoc.data(),
            used: true,
            usedAt: Timestamp.now(),
            usedBy: userId,
            status: 'completed'
        });

        return NextResponse.json({
            success: true,
            message: 'Invitación marcada como usada'
        });

    } catch (error) {
        console.error('Error actualizando invitación:', error);
        return NextResponse.json(
            { error: 'Error actualizando invitación' },
            { status: 500 }
        );
    }
}
