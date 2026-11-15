'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/utils';
import { Search, Plus, Mail, MapPin, MoreVertical, X, ArrowLeft, ShoppingCart, Receipt, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanContact } from '@/app/actions/scan-actions';

export default function ClientsPage() {
    const { clients, addClient, sales } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        rfc: '',
        address: '',
        email: '',
        notes: ''
    });

    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleScanContact = async (file: File) => {
        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanContact(formData);

            if (result.success && result.data) {
                const data = result.data;
                setFormData(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    rfc: data.rfc || prev.rfc,
                    address: data.address || prev.address,
                    email: data.email || prev.email,
                }));
                setShowModal(true); // Open modal with pre-filled data
            } else {
                alert('No se pudo escanear el contacto. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleAddClient = async () => {
        if (!formData.name) {
            alert('El nombre es requerido');
            return;
        }

        try {
            await addClient({
                name: formData.name,
                email: formData.email,
                phone: '',
                address: formData.address
            });

            setFormData({
                name: '',
                rfc: '',
                address: '',
                email: '',
                notes: ''
            });
            setShowModal(false);
            alert('Cliente agregado exitosamente');
        } catch (error) {
            console.error('Error al agregar cliente:', error);
            alert('Error al agregar el cliente');
        }
    };

    const selectedClientData = selectedClient ? clients.find(c => c.id === selectedClient) : null;

    // Calculate client metrics from sales
    const clientSales = selectedClient ? sales.filter(s => s.clientId === selectedClient) : [];
    const totalPurchasesValue = clientSales.reduce((sum, sale) => sum + sale.total, 0);
    const averageTicket = clientSales.length > 0 ? totalPurchasesValue / clientSales.length : 0;

    const [selectedSale, setSelectedSale] = useState<any>(null);

    if (selectedClient && selectedClientData) {
        return (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => setSelectedClient(null)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Perfil del Cliente</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Client Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Restaurante "{selectedClientData.name}"</h2>
                            <p className="text-sm text-gray-500 mb-6">Información de contacto y fiscal del cliente.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <Receipt className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase">RFC</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">RCS9121219C</p>
                                </div>

                                <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase">Correo Electrónico</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">{selectedClientData.email || 'gerencia@lacasona.com'}</p>
                                </div>

                                <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase">Dirección</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">{selectedClientData.address || 'Calle Madero 45, Morelia, Mich.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Historial de Compras</h3>
                            <p className="text-sm text-gray-500 mb-6">Todas las ventas registradas para este cliente.</p>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Producto</th>
                                            <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha</th>
                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Cantidad</th>
                                            <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Monto Total</th>
                                            <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {clientSales.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center">
                                                    <p className="text-sm text-gray-400">Este cliente aún no tiene compras registradas.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            clientSales.map(sale => (
                                                <tr key={sale.id} className="hover:bg-gray-50">
                                                    <td className="py-3 px-2">
                                                        <div className="text-sm font-medium text-gray-900">Venta General</div>
                                                        <div className="text-xs text-gray-500">{sale.products.length} productos</div>
                                                    </td>
                                                    <td className="py-3 px-2 text-sm text-gray-600">
                                                        {new Date(sale.createdAt).toLocaleDateString('es-MX')}
                                                    </td>
                                                    <td className="py-3 px-2 text-sm text-gray-600 text-right">
                                                        {sale.products.reduce((acc, p) => acc + p.quantity, 0)}
                                                    </td>
                                                    <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">
                                                        {formatCurrency(sale.total)}
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <button
                                                            onClick={() => setSelectedSale(sale)}
                                                            className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                                                        >
                                                            Ver
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Summary */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Resumen del Cliente</h3>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <span className="text-sm text-gray-600">Valor Total</span>
                                <span className="text-lg font-bold text-gray-900">{formatCurrency(totalPurchasesValue)}</span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <span className="text-sm text-gray-600">Ticket Promedio</span>
                                <span className="text-lg font-bold text-gray-900">{formatCurrency(averageTicket)}</span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <span className="text-sm text-gray-600">Total de Compras</span>
                                <span className="text-lg font-bold text-gray-900">{clientSales.length}</span>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-6">
                            <div className="flex items-center gap-2 mb-3">
                                <QrCode className="w-5 h-5 text-teal-600" />
                                <h4 className="font-bold text-gray-900">Código QR de Cliente</h4>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                El cliente puede mostrar este código para que lo escanees en el punto de venta y registrar su compra rápidamente.
                            </p>

                            <div className="bg-white border-2 border-gray-200 rounded-lg p-4 flex items-center justify-center">
                                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                                    <QrCode className="w-32 h-32 text-gray-300" />
                                </div>
                            </div>

                            <p className="text-center text-sm font-medium text-gray-900 mt-4">Restaurante "{selectedClientData.name}"</p>
                            <p className="text-center text-xs text-gray-500">ID: {selectedClientData.id}</p>
                        </div>
                    </div>
                </div>

                {/* Sale Details Modal */}
                {selectedSale && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900">Detalle de Venta</h2>
                                <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Fecha: {new Date(selectedSale.createdAt).toLocaleDateString('es-MX')}</p>
                                    <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-900">{formatCurrency(selectedSale.total)}</span></p>
                                </div>
                                <h3 className="font-bold text-sm text-gray-900 mb-2">Productos:</h3>
                                <ul className="space-y-2">
                                    {selectedSale.products.map((product: any, index: number) => (
                                        <li key={index} className="flex justify-between text-sm">
                                            <span>{product.quantity}x {product.productName}</span>
                                            <span>{formatCurrency(product.subtotal)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Clientes</h1>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar cliente por nombre o RFC..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCamera(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                        disabled={isScanning}
                    >
                        <QrCode className="w-4 h-4" />
                        {isScanning ? 'Escaneando...' : 'Escanear Tarjeta/QR'}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Cliente
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map((client) => (
                    <div
                        key={client.id}
                        onClick={() => setSelectedClient(client.id)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-6 cursor-pointer group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">{client.name}</h3>
                                <p className="text-xs text-gray-500">Restaurante</p>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-gray-100 rounded">
                                <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {client.address && (
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{client.address}</span>
                                </div>
                            )}
                            {client.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Mail className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{client.email}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Client Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Añadir Nuevo Cliente</h2>
                                <p className="text-sm text-gray-500">Registra la información fiscal de tu cliente para poder facturarle.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre o Razón Social</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Restaurante 'El Buen Gusto'"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                                <input
                                    type="text"
                                    placeholder="Ej: XEXX010101000"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.rfc}
                                    onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Fiscal</label>
                                <input
                                    type="text"
                                    placeholder="Calle, número, colonia, C.P., ciudad"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    placeholder="Ej: contacto@cliente.com"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                <textarea
                                    placeholder="Anotaciones importantes sobre el cliente. Ej: Entrega antes de las 10 AM"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent h-20 resize-none"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddClient}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
                            >
                                Guardar Cliente
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanContact}
            />
        </div>
    );
}
