// Authentication helper functions
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User,
    UserCredential,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { auth } from './config';

// Sign in with Google
export const signInWithGoogle = async (): Promise<UserCredential> => {
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<UserCredential> => {
    return await signInWithEmailAndPassword(auth, email, password);
};

// Sign up with email and password
export const signUp = async (email: string, password: string): Promise<UserCredential> => {
    return await createUserWithEmailAndPassword(auth, email, password);
};

// Sign out
export const logOut = async (): Promise<void> => {
    return await signOut(auth);
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};
