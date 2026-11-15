import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth } from 'firebase-admin';
import { UserProfile } from '@/types/user-types';

// ═══════════════════════════════════════════════════════════════
// API ROUTE: /api/workforce/create-employee
// Crea usuario Firebase SIN email (solo biometría)
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { invitationCode, employeeData, credential } = body;

        if (!invitationCode || !employeeData) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos' },
                { status: 400 }
            );
        }

        // Generar UID único
        const uid = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Crear UserProfile en Firestore (SIN Firebase Auth por ahora)
        const userProfile: Partial<UserProfile> = {
            uid,
            businessId: employeeData.businessId,
            fullName: employeeData.fullName,
            phone: employeeData.phoneNumber,
            email: undefined, // Sin email!
            role: employeeData.role,
            isActive: true,
            prefersBiometric: true,
            biometricCredentials: credential ? [{
                credentialId: credential.id,
                publicKey: credential.publicKey,
                deviceLabel: credential.deviceLabel || 'Dispositivo principal',
                deviceType: credential.deviceType || 'mobile',
                platform: credential.platform || 'unknown',
                createdAt: new Date(),
                lastUsed: new Date(),
                isActive: true
            }] : [],
            employment: {
                hireDate: new Date(),
                position: employeeData.position,
                contractType: 'full_time',
                salary: employeeData.salary,
                schedule: employeeData.schedule,
                requireGPS: true,
                requireSchedule: true
            },
            performanceMetrics: {
                totalSales: 0,
                transactions: 0,
                avgTicket: 0,
                bestSaleAmount: 0,
                attendanceScore: 100,
                totalShifts: 0,
                lateArrivals: 0,
                onTimeArrivals: 0,
                missedShifts: 0,
                tasksCompleted: 0,
                lastActive: new Date(),
                accountAge: 0,
                overallScore: 100,
                productsAdded: 0,
                stockUpdates: 0,
                suppliersManaged: 0
            },
            notificationSettings: {
                emailNotifications: false,
                pushNotifications: true,
                smsNotifications: true,
                notifyOnSale: false,
                notifyOnLowStock: false,
                notifyOnPayroll: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Guardar en Firestore
        await setDoc(doc(db, 'users', uid), {
            ...userProfile,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            'employment.hireDate': Timestamp.now(),
            'performanceMetrics.lastActive': Timestamp.now()
        });

        return NextResponse.json({
            success: true,
            uid,
            message: 'Empleado creado exitosamente'
        });

    } catch (error) {
        console.error('Error creando empleado:', error);
        return NextResponse.json(
            { error: 'Error creando empleado' },
            { status: 500 }
        );
    }
}
