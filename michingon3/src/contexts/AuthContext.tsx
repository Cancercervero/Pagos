'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserCredential } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthChange, signIn, signUp, logOut, signInWithGoogle } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/user-types';
import { UserRole, Permission, hasPermission } from '@/types/auth-types';

// ═══════════════════════════════════════════════════════════════
// CONTEXT TYPE (Ahora con UserProfile y permisos)
// ═══════════════════════════════════════════════════════════════

interface AuthContextType {
    // Usuario de Firebase Auth (básico)
    user: User | null;

    // Perfil completo con rol, biometría, métricas
    userProfile: UserProfile | null;

    // Estados de carga
    loading: boolean;
    profileLoading: boolean;

    // Métodos de autenticación
    login: (email: string, password: string) => Promise<UserCredential>;
    register: (email: string, password: string) => Promise<UserCredential>;
    logout: () => Promise<void>;
    googleSignIn: () => Promise<UserCredential>;

    // 🔐 HELPERS DE PERMISOS (Lo nuevo)
    hasPermission: (permission: Permission) => boolean;
    isOwner: boolean;
    isManager: boolean;
    canManageUsers: boolean;

    // Refresh manual del perfil
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    profileLoading: true,
    login: async () => { throw new Error('Not implemented'); },
    register: async () => { throw new Error('Not implemented'); },
    logout: async () => { throw new Error('Not implemented'); },
    googleSignIn: async () => { throw new Error('Not implemented'); },
    hasPermission: () => false,
    isOwner: false,
    isManager: false,
    canManageUsers: false,
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// ═══════════════════════════════════════════════════════════════
// PROVIDER (Ahora con UserProfile en tiempo real)
// ═══════════════════════════════════════════════════════════════

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);

    // ─────────────────────────────────────────────────────────────
    // LISTENER 1: Firebase Auth (User básico)
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setUser(user);
            setLoading(false);

            // Si no hay usuario, limpiar perfil
            if (!user) {
                setUserProfile(null);
                setProfileLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // ─────────────────────────────────────────────────────────────
    // LISTENER 2: Firestore UserProfile (en tiempo real)
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) {
            setProfileLoading(false);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);

        // Listener en tiempo real con onSnapshot
        const unsubscribe = onSnapshot(
            userDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();

                    // Convertir Firestore Timestamps a Dates
                    const profile: UserProfile = {
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                        performanceMetrics: data.performanceMetrics
                            ? {
                                ...data.performanceMetrics,
                                lastActive: data.performanceMetrics.lastActive?.toDate?.() || new Date(),
                            }
                            : undefined,
                        employment: data.employment
                            ? {
                                ...data.employment,
                                hireDate: data.employment.hireDate?.toDate?.() || new Date(data.employment.hireDate),
                            }
                            : undefined,
                    } as UserProfile;

                    setUserProfile(profile);
                } else {
                    setUserProfile(null);
                }
                setProfileLoading(false);
            },
            (error) => {
                console.error('Error loading user profile:', error);
                setProfileLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // ─────────────────────────────────────────────────────────────
    // VALIDACIÓN GPS + HORARIO (Solo para empleados)
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userProfile) return;

        // Si es owner o manager, sin restricciones
        if (userProfile.role === 'owner' || userProfile.role === 'manager') {
            return;
        }

        // Para empleados (cashier, inventory, staff, analyst)
        // validar GPS y horario cada 5 minutos
        const validateAccess = async () => {
            try {
                // 1. Validar horario laboral
                if (userProfile.employment?.schedule) {
                    const schedule = userProfile.employment.schedule;
                    const now = new Date();
                    const currentDay = now.getDay();
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const isWorkDay = schedule.daysOfWeek.includes(currentDay);
                    const isWorkTime = currentTime >= schedule.start && currentTime <= schedule.end;

                    if (!isWorkDay || !isWorkTime) {
                        console.warn('Acceso fuera de horario laboral');
                        // TODO: Mostrar modal "Fuera de horario"
                        // await logOut();
                        return;
                    }
                }

                // 2. Validar GPS (solo si se requiere)
                if (userProfile.employment?.requireGPS && userProfile.businessId) {
                    // TODO: Obtener ubicación del negocio de Firestore
                    // TODO: Obtener ubicación actual del usuario
                    // TODO: Calcular distancia
                    // TODO: Si > 100m, bloquear acceso
                }

            } catch (error) {
                console.error('Error validando acceso:', error);
            }
        };

        // Validar inmediatamente
        validateAccess();

        // Re-validar cada 5 minutos
        const interval = setInterval(validateAccess, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [userProfile]);

    // ─────────────────────────────────────────────────────────────
    // MÉTODOS DE AUTENTICACIÓN
    // ─────────────────────────────────────────────────────────────
    const login = (email: string, password: string) => signIn(email, password);
    const register = (email: string, password: string) => signUp(email, password);
    const logout = () => logOut();
    const googleSignIn = () => signInWithGoogle();

    // ─────────────────────────────────────────────────────────────
    // REFRESH MANUAL (Por si acaso)
    // ─────────────────────────────────────────────────────────────
    const refreshProfile = async () => {
        if (!user) return;

        try {
            const snapshot = await getDoc(doc(db, 'users', user.uid));
            if (snapshot.exists()) {
                const data = snapshot.data();
                const profile: UserProfile = {
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                    lastLoginAt: data.lastLoginAt?.toDate(),
                    performanceMetrics: {
                        ...data.performanceMetrics,
                        lastActive: data.performanceMetrics?.lastActive?.toDate() || new Date()
                    },
                    biometricCredentials: (data.biometricCredentials || []).map((cred: any) => ({
                        ...cred,
                        createdAt: cred.createdAt?.toDate() || new Date(),
                        lastUsed: cred.lastUsed?.toDate()
                    }))
                } as UserProfile;

                setUserProfile(profile);
            }
        } catch (error) {
            console.error('Error refreshing profile:', error);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HELPERS DE PERMISOS (Computed values)
    // ─────────────────────────────────────────────────────────────
    const checkPermission = (permission: Permission): boolean => {
        if (!userProfile) return false;
        if (!userProfile.isActive) return false; // Usuario desactivado
        return hasPermission(userProfile.role, permission);
    };

    const isOwner = userProfile?.role === 'owner';
    const isManager = userProfile?.role === 'manager';
    const canManageUsers = isOwner || isManager;

    // ─────────────────────────────────────────────────────────────
    // VALUE
    // ─────────────────────────────────────────────────────────────
    const value: AuthContextType = {
        user,
        userProfile,
        loading,
        profileLoading,
        login,
        register,
        logout,
        googleSignIn,
        hasPermission: checkPermission,
        isOwner,
        isManager,
        canManageUsers,
        refreshProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
