'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserCredential } from 'firebase/auth';
import { onAuthChange, signIn, signUp, logOut, signInWithGoogle } from '@/lib/firebase/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<UserCredential>;
    register: (email: string, password: string) => Promise<UserCredential>;
    logout: () => Promise<void>;
    googleSignIn: () => Promise<UserCredential>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { throw new Error('Not implemented'); },
    register: async () => { throw new Error('Not implemented'); },
    logout: async () => { throw new Error('Not implemented'); },
    googleSignIn: async () => { throw new Error('Not implemented'); },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = (email: string, password: string) => signIn(email, password);
    const register = (email: string, password: string) => signUp(email, password);
    const logout = () => logOut();
    const googleSignIn = () => signInWithGoogle();

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, googleSignIn }}>
            {children}
        </AuthContext.Provider>
    );
};
