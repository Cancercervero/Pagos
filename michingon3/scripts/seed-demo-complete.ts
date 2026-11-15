import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════
// SEED DEMO SIMPLE - Michingon3
// Crea 1 negocio + 12 empleados directamente en Firestore
// ═══════════════════════════════════════════════════════════════

// Inicializar Firebase Admin
try {
    // Intentar con service account
    const serviceAccount = JSON.parse(
        readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8')
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.log('⚠️  No se encontró service account, usando credenciales por defecto');
    admin.initializeApp();
}

const db = admin.firestore();
const BUSINESS_ID = 'demo-michingon-2026';

async function seedDemo() {
    console.log('\n🚀 Creando DEMO COMPLETA...\n');

    try {
        // 1️⃣ Negocio
        console.log('📦 Creando negocio...');
        await db.collection('businesses').doc(BUSINESS_ID).set({
            name: 'Michingon Demo Store',
            category: 'Retail',
            address: 'Av. Insurgentes Sur 1234, CDMX',
            phone: '+52 55 1234 5678',
            location: {
                latitude: 19.432608,
                longitude: -99.133209,
                radius: 100
            },
            settings: {
                allowBiometric: true,
                requireGPS: true
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Negocio creado\n');

        // 2️⃣ Empleados (12)
        console.log('👥 Creando 12 empleados...\n');

        const employees = [
            { name: 'Ana García', role: 'manager', position: 'Gerente', sales: 450000, shifts: 180 },
            { name: 'Carlos Ramírez', role: 'cashier', position: 'Cajero Principal', sales: 580000, shifts: 200 },
            { name: 'María Fernández', role: 'cashier', position: 'Cajera', sales: 390000, shifts: 170 },
            { name: 'José Hernández', role: 'inventory', position: 'Jefe Inventario', sales: 0, shifts: 185 },
            { name: 'Laura Sánchez', role: 'inventory', position: 'Aux. Inventario', sales: 0, shifts: 150 },
            { name: 'Roberto Morales', role: 'cashier', position: 'Cajero Nocturno', sales: 320000, shifts: 165 },
            { name: 'Gabriela López', role: 'staff', position: 'Asist. Ventas', sales: 0, shifts: 130 },
            { name: 'Diego Martínez', role: 'cashier', position: 'Cajero', sales: 420000, shifts: 160 },
            { name: 'Sofía Jiménez', role: 'staff', position: 'Servicio Cliente', sales: 0, shifts: 110 },
            { name: 'Miguel Torres', role: 'analyst', position: 'Analista Datos', sales: 0, shifts: 175 },
            { name: 'Valeria Rodríguez', role: 'cashier', position: 'Cajera Fin Semana', sales: 180000, shifts: 75 },
            { name: 'Fernando Castro', role: 'staff', position: 'Auxiliar General', sales: 0, shifts: 60 }
        ];

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const userId = `demo-emp-${String(i + 1).padStart(3, '0')}`;

            await db.collection('users').doc(userId).set({
                uid: userId,
                businessId: BUSINESS_ID,
                fullName: emp.name,
                email: `${emp.name.toLowerCase().replace(/\s+/g, '.')}@demo.mx`,
                phone: `+52 55 ${1111 * (i + 1)}`,
                role: emp.role,
                isActive: true,
                prefersBiometric: true,
                biometricCredentials: [],
                employment: {
                    hireDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
                    position: emp.position,
                    contractType: 'full_time',
                    schedule: {
                        start: '09:00',
                        end: '18:00',
                        daysOfWeek: [1, 2, 3, 4, 5]
                    },
                    requireGPS: true,
                    requireSchedule: true
                },
                performanceMetrics: {
                    totalSales: emp.sales,
                    transactions: emp.sales > 0 ? Math.floor(emp.sales / 600) : 0,
                    avgTicket: emp.sales > 0 ? 600 : 0,
                    attendanceScore: 85 + Math.floor(Math.random() * 15),
                    totalShifts: emp.shifts,
                    onTimeArrivals: Math.floor(emp.shifts * 0.88),
                    lateArrivals: Math.floor(emp.shifts * 0.12),
                    missedShifts: Math.floor(Math.random() * 5),
                    tasksCompleted: Math.floor(emp.shifts * 0.5),
                    overallScore: 75 + Math.floor(Math.random() * 20),
                    lastActive: admin.firestore.FieldValue.serverTimestamp(),
                    accountAge: 180
                },
                notificationSettings: {
                    emailNotifications: true,
                    pushNotifications: true,
                    smsNotifications: false,
                    notifyOnSale: false,
                    notifyOnLowStock: false,
                    notifyOnPayroll: true
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`  ✅ ${emp.name} (${emp.role})`);
        }

        console.log('\n✨ ¡DEMO CREADA EXITOSAMENTE!\n');
        console.log('📊 RESUMEN:');
        console.log(`   • Negocio ID: ${BUSINESS_ID}`);
        console.log(`   • Empleados: 12`);
        console.log(`   • Roles: 1 manager, 6 cajeros, 2 inventario, 2 staff, 1 analista\n`);
        console.log('🎯 ACCESO DEMO:');
        console.log(`   1. Regístrate como Owner con tu email`);
        console.log(`   2. Completa onboarding`);
        console.log(`   3. Asigna businessId: ${BUSINESS_ID}`);
        console.log(`   4. ¡Listo! Verás 12 empleados\n`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Ejecutar
seedDemo()
    .then(() => {
        console.log('✅ Proceso completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
