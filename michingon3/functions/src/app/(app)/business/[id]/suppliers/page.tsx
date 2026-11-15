'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Plus, User, Phone, Mail, Clock, CreditCard, FileText, MoreVertical, X, ArrowLeft, Scan, Eye, Camera, Upload } from 'lucide-react';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanContact, scanInvoice } from '@/app/actions/scan-actions';

export default function SuppliersPage() {
    const { suppliers, addSupplier, addExpense } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showScanModal, setShowScanModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

    const [showContactCamera, setShowContactCamera] = useState(false);
    const [isScanningContact, setIsScanningContact] = useState(false);

    const [showInvoiceCamera, setShowInvoiceCamera] = useState(false);
    const [isScanningInvoice, setIsScanningInvoice] = useState(false);
    const [scannedInvoiceData, setScannedInvoiceData] = useState<any>(null);

    const handleScanContact = async (file: File) => {
        setIsScanningContact(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanContact(formData);

            if (result.success && result.data) {
                const data = result.data;
                setFormData(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    category: (data.type === 'supplier' ? 'Proveedor General' : prev.category) || prev.category,
                    contactPerson: data.name || prev.contactPerson, // Often the name on card is the contact person
                    phone: data.phone || prev.phone,
                    email: data.email || prev.email,
                    // Address is not in supplier form state initially, but could be added if needed
                }));
                setShowModal(true); // Open modal with pre-filled data
            } else {
                alert('No se pudo escanear el contacto. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanningContact(false);
        }
    };

    const handleScanInvoice = async (file: File) => {
        setIsScanningInvoice(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanInvoice(formData);

            if (result.success && result.data) {
                setScannedInvoiceData(result.data);
                // Automatically create expense
                await handleScannedInvoice(result.data);
            } else {
                alert('No se pudo escanear la factura. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanningInvoice(false);
        }
    };

    const handleScannedInvoice = async (data: any) => {
        console.log("Scanned Invoice Data:", data);
        try {
            await addExpense({
                description: `Factura ${data.folio || 'S/N'} - ${data.supplierName || 'Proveedor Desconocido'}`,
                amount: data.total || 0,
                category: 'Inventario', // Default category
                date: data.date ? new Date(data.date) : new Date(),
                iva: data.tax || 0,
                invoiceUrl: '' // We could upload the image and put the URL here
            });

            setShowScanModal(false);
            alert(`Factura procesada correctamente. Total: ${formatCurrency(data.total)}`);
        } catch (error) {
            console.error("Error adding expense from scan:", error);
            alert("Error al guardar el gasto de la factura");
        }
    };

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        contactPerson: '',
        phone: '',
        email: '',
        workHours: '',
        creditDays: '0',
        notes: ''
    });

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddSupplier = async () => {
        if (!formData.name || !formData.category) {
            alert('Nombre y categoría son requeridos');
            return;
        }

        try {
            await addSupplier({
                name: formData.name,
                category: formData.category,
                contactPerson: formData.contactPerson,
                phone: formData.phone,
                email: formData.email,
                workHours: formData.workHours,
                creditDays: Number(formData.creditDays),
                notes: formData.notes
            });

            setFormData({
                name: '',
                category: '',
                contactPerson: '',
                phone: '',
                email: '',
                workHours: '',
                creditDays: '0',
                notes: ''
            });
            setShowModal(false);
            alert('Proveedor agregado exitosamente');
        } catch (error) {
            console.error('Error al agregar proveedor:', error);
            alert('Error al agregar el proveedor');
        }
    };

    const selectedSupplierData = selectedSupplier ? suppliers.find(s => s.id === selectedSupplier) : null;

    // Mock purchase history
    const mockPurchases = [
        {
            id: '1',
            product: 'Chorizo Argentino',
            date: new Date('2025-10-05'),
            stock: '15.00 de 35.00',
            unitCost: 117.00,
            hasInvoice: true
        },
        {
            id: '2',
            product: 'Costilla de Cerdo',
            date: new Date('2025-10-05'),
            stock: '21.00 de 22.00',
            unitCost: 81.00,
            hasInvoice: true
        }
    ];

    if (selectedSupplier && selectedSupplierData) {
        return (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => setSelectedSupplier(null)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Perfil del Proveedor</h1>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-teal-600" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedSupplierData.name}</h2>
                            <p className="text-sm text-gray-500">{selectedSupplierData.category}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <User className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase">Contacto</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{selectedSupplierData.contactPerson}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Phone className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase">Teléfono</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{selectedSupplierData.phone}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase">Horario Laboral</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{selectedSupplierData.workHours || 'L-V 8am-6pm'}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Mail className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase">Correo Electrónico</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{selectedSupplierData.email || 'No especificado'}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <CreditCard className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase">Condiciones de Pago</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{selectedSupplierData.creditDays} días de crédito.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Historial de Compras</h3>
                    <p className="text-sm text-gray-500 mb-6">Aquí se muestran todos los lotes de productos que le has comprado a este proveedor.</p>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Producto</th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Fecha Compra</th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Stock del Lote</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Costo Unitario</th>
                                    <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Factura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {mockPurchases.map((purchase) => (
                                    <tr key={purchase.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-2 text-sm font-medium text-gray-900">{purchase.product}</td>
                                        <td className="py-3 px-2 text-sm text-gray-600">{formatDate(purchase.date)}</td>
                                        <td className="py-3 px-2 text-sm text-gray-600">{purchase.stock}</td>
                                        <td className="py-3 px-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(purchase.unitCost)}</td>
                                        <td className="py-3 px-2 text-center">
                                            {purchase.hasInvoice && (
                                                <button className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                                                    <Eye className="w-3 h-3" />
                                                    Ver Factura
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Proveedores</h1>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar proveedor por nombre o categoría..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowInvoiceCamera(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                        disabled={isScanningInvoice}
                    >
                        <Camera className="w-4 h-4" />
                        {isScanningInvoice ? 'Escaneando...' : 'Escanear Factura'}
                    </button>
                    <button
                        onClick={() => setShowContactCamera(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                        disabled={isScanningContact}
                    >
                        <Scan className="w-4 h-4" />
                        {isScanningContact ? 'Escaneando...' : 'Escanear Tarjeta'}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Proveedor
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map((supplier) => (
                    <div
                        key={supplier.id}
                        onClick={() => setSelectedSupplier(supplier.id)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-6 cursor-pointer group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">{supplier.name}</h3>
                                <p className="text-xs text-gray-500">{supplier.category}</p>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-gray-100 rounded">
                                <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="w-4 h-4 flex-shrink-0" />
                                <span>{supplier.contactPerson}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span>{supplier.phone}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Supplier Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Añadir Nuevo Proveedor</h2>
                                <p className="text-sm text-gray-500">Registra un nuevo proveedor para tus compras.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proveedor</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Ganado del Norte S.A."
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Carne de Res"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Persona de Contacto</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Sr. Fernando Rojas"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    placeholder="Ej: 61-9344-5678"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    placeholder="Ej: ventas@proveedor.com"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Horario Laboral</label>
                                <input
                                    type="text"
                                    placeholder="Ej: L-V 9am a 6pm"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.workHours}
                                    onChange={(e) => setFormData({ ...formData, workHours: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Días de Crédito</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.creditDays}
                                    onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">¿Cuántos días de crédito te da este proveedor? (0 si es de contado)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                <textarea
                                    placeholder="Anotaciones importantes sobre el proveedor..."
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
                                onClick={handleAddSupplier}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
                            >
                                Guardar Proveedor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CameraModal
                isOpen={showInvoiceCamera}
                onClose={() => {
                    setShowInvoiceCamera(false);
                    setShowScanModal(false);
                }}
                onCapture={handleScanInvoice}
            />
            <CameraModal
                isOpen={showContactCamera}
                onClose={() => setShowContactCamera(false)}
                onCapture={handleScanContact}
            />
        </div>
    );
}
