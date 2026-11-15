import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase config (copiar de tu .env.local)
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
const auth = getAuth(app);

async function updateCurrentUser() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        console.error('❌ No hay usuario logueado. Inicia sesión primero.');
        return;
    }

    console.log(`🔄 Actualizando usuario: ${currentUser.email}`);

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            role: 'owner',
            fullName: 'Samuel Hernández', // Cambiar por tu nombre real si quieres
            phone: '4431234567',
            updatedAt: new Date().toISOString(),
        });

        console.log('✅ Usuario actualizado correctamente!');
        console.log('👑 Rol: OWNER');
        console.log('🔄 Recarga la página para ver los cambios');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

updateCurrentUser();
