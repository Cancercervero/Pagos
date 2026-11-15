'use client';

import { ImportWizard } from '@/components/onboarding/import-wizard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ImportPage({ params }: { params: { id: string } }) {
    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <Link
                    href={`/business/${params.id}/settings`}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Configuración
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Importación de Datos</h1>
                <p className="text-gray-500">Sube tus archivos existentes para poblar tu inventario rápidamente.</p>
            </div>

            <ImportWizard />
        </div>
    );
}
