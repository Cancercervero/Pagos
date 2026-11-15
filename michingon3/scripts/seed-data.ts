import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const businessId = 'demo';

// Demo Data
const products = [
    {
        name: 'Coca Cola 600ml',
        category: 'Bebidas',
        price: 20,
        cost: 12,
        stock: 150,
        minStock: 20,
        barcode: '7501234567890',
        image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400'
    },
    {
        name: 'Sabritas Original',
        category: 'Snacks',
        price: 18,
        cost: 10,
        stock: 200,
        minStock: 30,
        barcode: '7501234567891',
        image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400'
    },
    {
        name: 'Pan Bimbo Blanco',
        category: 'Panadería',
        price: 35,
        cost: 22,
        stock: 50,
        minStock: 10,
        barcode: '7501234567892',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
    },
    {
        name: 'Leche Lala 1L',
        category: 'Lácteos',
        price: 25,
        cost: 18,
        stock: 80,
        minStock: 15,
        barcode: '7501234567893',
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400'
    },
    {
        name: 'Huevos San Juan 12pz',
        category: 'Abarrotes',
        price: 45,
        cost: 32,
        stock: 60,
        minStock: 10,
        barcode: '7501234567894',
        image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400'
    }
];

const clients = [
    {
        name: 'Juan Pérez',
        email: 'juan.perez@email.com',
        phone: '5551234567',
        address: 'Av. Reforma 123, CDMX',
        balance: 0
    },
    {
        name: 'María González',
        email: 'maria.gonzalez@email.com',
        phone: '5559876543',
        address: 'Calle Juárez 456, CDMX',
        balance: 150
    },
    {
        name: 'Carlos Rodríguez',
        email: 'carlos.rodriguez@email.com',
        phone: '5555555555',
        address: 'Insurgentes Sur 789, CDMX',
        balance: 0
    }
];

const employees = [
    {
        name: 'Ana López',
        position: 'Cajera',
        salary: 8000,
        phone: '5551111111',
        email: 'ana.lopez@michingon.com',
        hireDate: new Date('2024-01-15').toISOString()
    },
    {
        name: 'Pedro Martínez',
        position: 'Almacenista',
        salary: 7500,
        phone: '5552222222',
        email: 'pedro.martinez@michingon.com',
        hireDate: new Date('2024-03-01').toISOString()
    }
];

const suppliers = [
    {
        name: 'Distribuidora del Norte',
        contact: 'Roberto Sánchez',
        phone: '5553333333',
        email: 'ventas@disnorte.com',
        address: 'Zona Industrial, Monterrey',
        balance: 5000
    },
    {
        name: 'Abarrotes Mayoreo SA',
        contact: 'Laura Fernández',
        phone: '5554444444',
        email: 'contacto@abarrotesmayoreo.com',
        address: 'Central de Abastos, CDMX',
        balance: 0
    }
];

const sales = [
    {
        clientId: '', // Will be set after creating clients
        items: [
            { productId: '', name: 'Coca Cola 600ml', quantity: 5, price: 20, total: 100 },
            { productId: '', name: 'Sabritas Original', quantity: 3, price: 18, total: 54 }
        ],
        total: 154,
        paid: 154,
        paymentMethod: 'cash',
        status: 'completed',
        date: new Date('2024-12-01').toISOString()
    },
    {
        clientId: '',
        items: [
            { productId: '', name: 'Pan Bimbo Blanco', quantity: 2, price: 35, total: 70 },
            { productId: '', name: 'Leche Lala 1L', quantity: 4, price: 25, total: 100 }
        ],
        total: 170,
        paid: 170,
        paymentMethod: 'card',
        status: 'completed',
        date: new Date('2024-12-02').toISOString()
    }
];

const expenses = [
    {
        description: 'Renta del local',
        amount: 15000,
        category: 'Renta',
        date: new Date('2024-12-01').toISOString(),
        paymentMethod: 'transfer'
    },
    {
        description: 'Luz CFE',
        amount: 2500,
        category: 'Servicios',
        date: new Date('2024-12-01').toISOString(),
        paymentMethod: 'cash'
    },
    {
        description: 'Compra de inventario',
        amount: 8000,
        category: 'Inventario',
        date: new Date('2024-12-02').toISOString(),
        paymentMethod: 'transfer'
    }
];

async function seedData() {
    try {
        console.log('🌱 Iniciando seed de datos...\n');

        // 1. Products
        console.log('📦 Creando productos...');
        const productIds: string[] = [];
        for (const product of products) {
            const docRef = await db.collection(`businesses/${businessId}/products`).add(product);
            productIds.push(docRef.id);
            console.log(`  ✓ ${product.name}`);
        }

        // 2. Clients
        console.log('\n👥 Creando clientes...');
        const clientIds: string[] = [];
        for (const client of clients) {
            const docRef = await db.collection(`businesses/${businessId}/clients`).add(client);
            clientIds.push(docRef.id);
            console.log(`  ✓ ${client.name}`);
        }

        // 3. Employees
        console.log('\n👷 Creando empleados...');
        for (const employee of employees) {
            await db.collection(`businesses/${businessId}/employees`).add(employee);
            console.log(`  ✓ ${employee.name}`);
        }

        // 4. Suppliers
        console.log('\n🏭 Creando proveedores...');
        for (const supplier of suppliers) {
            await db.collection(`businesses/${businessId}/suppliers`).add(supplier);
            console.log(`  ✓ ${supplier.name}`);
        }

        // 5. Sales (with real IDs)
        console.log('\n💰 Creando ventas...');
        for (let i = 0; i < sales.length; i++) {
            const sale = sales[i];
            sale.clientId = clientIds[i % clientIds.length];
            sale.items[0].productId = productIds[0];
            sale.items[1].productId = productIds[1];
            await db.collection(`businesses/${businessId}/sales`).add(sale);
            console.log(`  ✓ Venta #${i + 1} - $${sale.total}`);
        }

        // 6. Expenses
        console.log('\n💸 Creando gastos...');
        for (const expense of expenses) {
            await db.collection(`businesses/${businessId}/expenses`).add(expense);
            console.log(`  ✓ ${expense.description} - $${expense.amount}`);
        }

        console.log('\n✅ ¡Seed completado exitosamente!');
        console.log('\n📊 Resumen:');
        console.log(`  - ${products.length} productos`);
        console.log(`  - ${clients.length} clientes`);
        console.log(`  - ${employees.length} empleados`);
        console.log(`  - ${suppliers.length} proveedores`);
        console.log(`  - ${sales.length} ventas`);
        console.log(`  - ${expenses.length} gastos`);
        console.log('\n🌐 Abre la app: https://michingon3-a77f8.web.app');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al hacer seed:', error);
        process.exit(1);
    }
}

seedData();
