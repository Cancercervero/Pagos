// Firebase Admin (solo servidor). En local usa GOOGLE_APPLICATION_CREDENTIALS
// (ruta a la llave de servicio, NUNCA en el repo) o FIREBASE_SERVICE_ACCOUNT_JSON.
// En Firebase/Cloud Run usa las credenciales por defecto del proyecto.
import { applicationDefault, cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | undefined;

function getAdminApp(): App {
    if (app) return app;
    if (getApps().length) {
        app = getApps()[0];
        return app;
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    app = initializeApp({
        credential: json ? cert(JSON.parse(json)) : applicationDefault(),
        projectId,
    });
    return app;
}

export function adminDb(): Firestore {
    return getFirestore(getAdminApp());
}

export function adminAuth() {
    return getAuth(getAdminApp());
}

/** Negocio de la demo. Michingón usa 'demo' como businessId por defecto. */
export function negocioId(): string {
    return process.env.DEMO_BUSINESS_ID || 'demo';
}

/** Valida el ID token de Firebase del usuario que llama (header Authorization: Bearer ...). */
export async function usuarioDesdeRequest(req: Request): Promise<{ uid: string } | null> {
    const h = req.headers.get('authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return null;
    try {
        const decoded = await adminAuth().verifyIdToken(token);
        return { uid: decoded.uid };
    } catch {
        return null;
    }
}
