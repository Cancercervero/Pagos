import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface Business {
    id: string;
    name: string;
    owner: string;
    countryCode: string;
    currencyCode: string;
    language: string;
    businessFamily?: string;
    businessType?: string;
    rfc?: string;
    razonSocial?: string;
    direccionFiscal?: string;
    satRegime?: string;
    whatsappApiKey?: string;
    createdAt: Date;
}

export function useUserBusinesses(userId: string | undefined) {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setBusinesses([]);
            setLoading(false);
            return;
        }

        const fetchBusinesses = async () => {
            try {
                setLoading(true);
                const businessesRef = collection(db, 'businesses');
                const q = query(businessesRef, where('owner', '==', userId));
                const snapshot = await getDocs(q);

                const businessList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        // Manejar createdAt como string o Timestamp
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
                    } as Business;
                });

                setBusinesses(businessList);
                setError(null);
            } catch (err) {
                console.error('Error fetching businesses:', err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchBusinesses();
    }, [userId]);

    return { businesses, loading, error };
}
