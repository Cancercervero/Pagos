import type { Metadata } from 'next';
import { Providers } from './providers';
import { DemoUserSwitcher } from '@/components/dev/DemoUserSwitcher';
import './globals.css';

export const metadata: Metadata = {
    title: 'Michingon3 - Sistema de Gestión Empresarial',
    description: 'Plataforma de gestión empresarial con IA integrada',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <head>
                <meta httpEquiv="Content-Security-Policy" content="script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com https://www.google-analytics.com; object-src 'none';" />
            </head>
            <body>
                <Providers>
                    {children}
                    <DemoUserSwitcher />
                </Providers>
            </body>
        </html>
    );
}
