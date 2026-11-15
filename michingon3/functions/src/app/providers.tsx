'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';

// Error Boundary to catch client-side errors
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error Boundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', backgroundColor: '#fee', color: '#c00', fontFamily: 'monospace' }}>
                    <h1>Something went wrong</h1>
                    <pre>{this.state.error?.message}</pre>
                    <pre>{this.state.error?.stack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// Safe wrapper that only renders on client side after mount
function ClientOnly({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Cargando...</p>
            </div>
        );
    }

    return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <ClientOnly>
                <AuthProvider>
                    <DataProvider>
                        {children}
                    </DataProvider>
                </AuthProvider>
            </ClientOnly>
        </ErrorBoundary>
    );
}
