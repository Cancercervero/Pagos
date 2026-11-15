// ═══════════════════════════════════════════════════════════════
// SEED SCRIPT - USUARIOS DEMO PARA TESTING
// Crea empleados con diferentes roles para probar el sistema
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { UserProfile } from '../src/types/user-types';
import { WorkShift } from '../src/types/workforce-types';

// Configuración de Firebase (usa las mismas variables de .env.local)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ═══════════════════════════════════════════════════════════════
// USUARIOS DEMO
// ═══════════════════════════════════════════════════════════════

const DEMO_BUSINESS_ID = 'demo-business';

const DEMO_USERS: Partial<UserProfile>[] = [
    {
        uid: 'demo-owner',
        businessId: DEMO_BUSINESS_ID,
        fullName: 'Carlos Dueño (DEMO)',
        email: 'owner@demo.michingon.com',
        role: 'owner',
        isActive: true,
        photoUrl: 'https://i.pravatar.cc/150?img=12',
        prefersBiometric: false, // Bypass FaceID en demo
        biometricCredentials: [],
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
            accountAge: 365,
            overallScore: 100,
            productsAdded: 0,
            stockUpdates: 0,
            suppliersManaged: 0
        },
        notificationSettings: {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            notifyOnSale: true,
            notifyOnLowStock: true,
            notifyOnPayroll: true
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
    },

    {
        uid: 'demo-cashier-juan',
        businessId: DEMO_BUSINESS_ID,
        fullName: 'Juan Pérez (Cajero DEMO)',
        email: 'juan@demo.michingon.com',
        role: 'cashier',
        isActive: true,
        photoUrl: 'https://i.pravatar.cc/150?img=33',
        prefersBiometric: false,
        biometricCredentials: [],
        performanceMetrics: {
            totalSales: 45000,
            transactions: 120,
            avgTicket: 375,
            bestSaleAmount: 2500,
            attendanceScore: 95,
            totalShifts: 20,
            lateArrivals: 1,
            onTimeArrivals: 19,
            missedShifts: 0,
            tasksCompleted: 45,
            lastActive: new Date(),
            accountAge: 30,
            overallScore: 92,
            productsAdded: 0,
            stockUpdates: 0,
            suppliersManaged: 0
        },
        employment: {
            hireDate: new Date('2024-01-15'),
            position: 'Cajero Principal',
            contractType: 'full_time',
            salary: 10000
        },
        notificationSettings: {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            notifyOnSale: false,
            notifyOnLowStock: false,
            notifyOnPayroll: true
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
    },

    {
        uid: 'demo-cashier-maria',
        businessId: DEMO_BUSINESS_ID,
        fullName: 'María García (Cajera DEMO)',
        email: 'maria@demo.michingon.com',
        role: 'cashier',
        isActive: true,
        photoUrl: 'https://i.pravatar.cc/150?img=45',
        prefersBiometric: false,
        biometricCredentials: [],
        performanceMetrics: {
            totalSales: 38000,
            transactions: 95,
            avgTicket: 400,
            bestSaleAmount: 3200,
            attendanceScore: 100,
            totalShifts: 20,
            lateArrivals: 0,
            onTimeArrivals: 20,
            missedShifts: 0,
            tasksCompleted: 52,
            lastActive: new Date(),
            accountAge: 25,
            overallScore: 96,
            productsAdded: 0,
            stockUpdates: 0,
            suppliersManaged: 0
        },
        employment: {
            hireDate: new Date('2024-02-01'),
            position: 'Cajera',
            contractType: 'full_time',
            salary: 9500
        },
        notificationSettings: {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            notifyOnSale: false,
            notifyOnLowStock: false,
            notifyOnPayroll: true
        },
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date()
    },

    {
        uid: 'demo-inventory-pedro',
        businessId: DEMO_BUSINESS_ID,
        fullName: 'Pedro Martínez (Almacén DEMO)',
        email: 'pedro@demo.michingon.com',
        role: 'inventory',
        isActive: true,
        photo url: 'https://i.pravatar.cc/150?img=68',
        prefersBiometric: false,
        biometricCredentials: [],
        performanceMetrics: {
            totalSales: 0,
            transactions: 0,
            avgTicket: 0,
            bestSaleAmount: 0,
            attendanceScore: 88,
            totalShifts: 18,
            lateArrivals: 2,
            onTimeArrivals: 16,
            missedShifts: 2,
            tasksCompleted: 78,
            lastActive: new Date(),
            accountAge: 20,
            overallScore: 85,
            productsAdded: 145,
            stockUpdates: 234,
            suppliersManaged: 12
        },
        employment: {
            hireDate: new Date('2024-03-01'),
            position: 'Encargado de Almacén',
            contractType: 'full_time',
            salary: 9000
        },
        notificationSettings: {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            notifyOnSale: false,
            notifyOnLowStock: true,
            notifyOnPayroll: true
        },
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date()
    },

    {
        uid: 'demo-staff-luis',
        businessId: DEMO_BUSINESS_ID,
        fullName: 'Luis Rodríguez (Empleado DEMO)',
        email: 'luis@demo.michingon.com',
        role: 'staff',
        isActive: true,
        photoUrl: 'https://i.pravatar.cc/150?img=51',
        prefersBiometric: false,
        biometricCredentials: [],
        performanceMetrics: {
            totalSales: 0,
            transactions: 0,
            avgTicket: 0,
            bestSaleAmount: 0,
            attendanceScore: 70,
            totalShifts: 15,
            lateArrivals: 4,
            onTimeArrivals: 11,
            missedShifts: 5,
            tasksCompleted: 23,
            lastActive: new Date(),
            accountAge: 15,
            overallScore: 62,
            productsAdded: 0,
            stockUpdates: 0,
            suppliersManaged: 0
        },
        employment: {
            hireDate: new Date('2024-04-01'),
            position: 'Empleado General',
            contractType: 'part_time',
            salary: 6000
        },
        notificationSettings: {
            emailNotifications: false,
            pushNotifications: true,
            smsNotifications: false,
            notifyOnSale: false,
            notifyOnLowStock: false,
            notifyOnPayroll: true
        },
        createdAt: new Date('2024-04-01'),
        updatedAt: new Date()
    }
];

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL DE SEED
// ═══════════════════════════════════════════════════════════════

async function seedDemoUsers() {
    console.log('🌱 Iniciando seed de usuarios demo...\n');

    try {
        for (const user of DEMO_USERS) {
            console.log(`📝 Creando usuario: ${user.fullName} (${user.role})`);

            // Convertir dates a Timestamps de Firestore
            const userDoc = {
                ...user,
                createdAt: Timestamp.fromDate(user.createdAt!),
                updatedAt: Timestamp.fromDate(user.updatedAt!),
                performanceMetrics: {
                    ...user.performanceMetrics!,
                    lastActive: Timestamp.fromDate(user.performanceMetrics!.lastActive)
                },
                employment: user.employment ? {
                    ...user.employment,
                    hireDate: Timestamp.fromDate(user.employment.hireDate)
                } : undefined
            };

            await setDoc(doc(db, 'users', user.uid!), userDoc);
            console.log(`   ✅ Usuario ${user.uid} creado exitosamente\n`);
        }

        console.log('\n🎉 ¡Seed completado exitosamente!');
        console.log(`\n📊 Total de usuarios creados: ${DEMO_USERS.length}`);
        console.log(`\n💡 Puedes iniciar sesión con cualquiera de estos emails:`);
        DEMO_USERS.forEach(u => console.log(`   - ${u.email} (${u.role})`));

    } catch (error) {
        console.error('❌ Error durante el seed:', error);
        throw error;
    }
}

// Ejecutar seed
seedDemoUsers()
    .then(() => {
        console.log('\n✅ Proceso completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Proceso fallido:', error);
        process.exit(1);
    });
