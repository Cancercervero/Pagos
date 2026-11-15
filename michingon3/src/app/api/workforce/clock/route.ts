import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { WorkShift, isWithinBusinessArea, isLateArrival } from '@/types/workforce-types';

// ═══════════════════════════════════════════════════════════════
// API: CHECK-IN (Marcar Entrada)
// POST /api/workforce/clock-in
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            userId,
            businessId,
            location,
            deviceType = 'mobile',
            method = 'biometric'
        } = body;

        // Validar campos requeridos
        if (!userId || !businessId || !location) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos' },
                { status: 400 }
            );
        }

        // 1. Verificar que no tenga un turno activo
        const activeShiftsQuery = query(
            collection(db, `businesses/${businessId}/shifts`),
            where('userId', '==', userId),
            where('status', '==', 'active')
        );

        const activeShiftsSnapshot = await getDocs(activeShiftsQuery);

        if (!activeShiftsSnapshot.empty) {
            return NextResponse.json(
                { error: 'Ya tienes un turno activo. Marca salida primero.' },
                { status: 400 }
            );
        }

        // 2. Obtener BusinessLocation para validar geolocalización
        // TODO: Obtener de Firestore
        const businessLocation = {
            id: 'main',
            businessId,
            name: 'Local Principal',
            centerLat: 19.4326, // Placeholder - debe venir de settings
            centerLng: -99.1332,
            radiusMeters: 100,
            address: 'CDMX',
            isActive: true,
            createdAt: new Date()
        };

        // 3. Validar ubicación
        const withinRange = isWithinBusinessArea(location, businessLocation);

        if (!withinRange) {
            return NextResponse.json(
                {
                    error: 'No estás dentro del área del negocio',
                    distance: 'fuera de rango',
                    maxRadius: businessLocation.radiusMeters
                },
                { status: 403 }
            );
        }

        // 4. Obtener horario esperado (schedule)
        // TODO: Cargar de employee schedule
        const scheduledStartTime = new Date();
        scheduledStartTime.setHours(9, 0, 0, 0); // Ejemplo: 9:00 AM

        // 5. Calcular si llegó tarde
        const now = new Date();
        const lateCheck = isLateArrival(now, scheduledStartTime, 5);

        // 6. Crear WorkShift
        const newShift: Omit<WorkShift, 'id'> = {
            userId,
            businessId,
            clockInTime: now,
            clockInLocation: location,
            clockInDevice: deviceType,
            clockInMethod: method,
            scheduledStartTime,
            isLate: lateCheck.isLate,
            lateMinutes: lateCheck.minutesLate,
            status: 'active',
            wasValidated: false,
            createdAt: now,
            updatedAt: now
        };

        // 7. Guardar en Firestore
        const docRef = await addDoc(
            collection(db, `businesses/${businessId}/shifts`),
            {
                ...newShift,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        );

        return NextResponse.json({
            success: true,
            shiftId: docRef.id,
            isLate: lateCheck.isLate,
            minutesLate: lateCheck.minutesLate,
            message: lateCheck.isLate
                ? `Entrada registrada (${lateCheck.minutesLate} min tarde)`
                : '¡Entrada registrada a tiempo!'
        });

    } catch (error: any) {
        console.error('Error en check-in:', error);
        return NextResponse.json(
            { error: 'Error al registrar entrada', details: error.message },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// API: CHECK-OUT (Marcar Salida)
// PUT /api/workforce/clock-out
// ═══════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            shiftId,
            businessId,
            location,
            dailyStats
        } = body;

        // Validar campos
        if (!shiftId || !businessId || !location) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos' },
                { status: 400 }
            );
        }

        // 1. Obtener el shift actual
        const shiftRef = doc(db, `businesses/${businessId}/shifts`, shiftId);

        // 2. Calcular overtime (si aplica)
        const now = new Date();

        // 3. Actualizar el shift
        await updateDoc(shiftRef, {
            clockOutTime: now,
            clockOutLocation: location,
            clockOutDevice: typeof navigator !== 'undefined' ? 'mobile' : 'desktop',
            status: 'completed',
            dailyStats: dailyStats || {},
            updatedAt: serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            message: '¡Salida registrada exitosamente!',
            stats: dailyStats
        });

    } catch (error: any) {
        console.error('Error en check-out:', error);
        return NextResponse.json(
            { error: 'Error al registrar salida', details: error.message },
            { status: 500 }
        );
    }
}
