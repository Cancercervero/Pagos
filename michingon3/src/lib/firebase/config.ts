// Firebase configuration and initialization
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase with try-catch to prevent crashes
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

try {
    // Always initialize Firebase (works on both server and client)
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }

    // Initialize core services
    auth = getAuth(app);
    db = getFirestore(app);

    // Analytics only works in browser
    if (typeof window !== 'undefined') {
        isSupported().then(supported => {
            if (supported) {
                try {
                    analytics = getAnalytics(app);
                } catch (e) {
                    console.warn('Analytics initialization failed:', e);
                }
            }
        }).catch(e => {
            console.warn('Analytics check failed:', e);
        });
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
    // Create dummy objects to prevent crashes
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
}

export { app, auth, db, analytics };
