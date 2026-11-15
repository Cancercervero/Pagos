import type { Metadata } from 'next';
import { Providers } from './providers';
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
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
