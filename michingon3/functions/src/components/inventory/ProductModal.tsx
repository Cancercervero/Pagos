'use client';

import { useState, useEffect } from 'react';
import { Product, PurchaseBatch } from '@/types/business';
import { X, Upload, Camera, Plus, Trash2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanProduct } from '@/app/actions/scan-actions';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: Partial<Product>) => void;
    product?: Product;
}

export default function ProductModal({ isOpen, onClose, onSave, product }: ProductModalProps) {
    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        description: '',
        category: '',
        unit: 'kg',
        price: 0,
        vatRate: 0.16,
        satKey: '',
        minStock: 0,
        maxStock: 0,
        batches: []
    });

    // Batch Form State
    const [newBatch, setNewBatch] = useState<Partial<PurchaseBatch>>({
        provider: '',
        invoice: '',
        date: new Date(),
        quantity: 0,
        cost: 0,
        merma: 0,
        mermaReason: ''
    });

    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData(product);
        } else {
            setFormData({
                name: '',
                description: '',
                category: '',
                unit: 'kg',
                price: 0,
                vatRate: 0.16,
                satKey: '',
                minStock: 0,
                maxStock: 0,
                batches: []
            });
        }
    }, [product, isOpen]);

    if (!isOpen) return null;

    const handleAddBatch = () => {
        if (!newBatch.provider || !newBatch.quantity || !newBatch.cost) return;

        const batch: PurchaseBatch = {
            id: Math.random().toString(36).substr(2, 9),
            provider: newBatch.provider,
            invoice: newBatch.invoice,
            date: newBatch.date || new Date(),
            quantity: Number(newBatch.quantity),
            cost: Number(newBatch.cost),
            merma: Number(newBatch.merma) || 0,
            mermaReason: newBatch.mermaReason
        };

        setFormData(prev => ({
            ...prev,
            batches: [...(prev.batches || []), batch]
        }));

        // Reset batch form
        setNewBatch({
            provider: '',
            invoice: '',
            date: new Date(),
            quantity: 0,
            cost: 0,
            merma: 0,
            mermaReason: ''
        });
    };

    const removeBatch = (id: string) => {
        setFormData(prev => ({
            ...prev,
            batches: prev.batches?.filter(b => b.id !== id)
        }));
    };

    const calculateRealCost = (cost: number, qty: number, merma: number) => {
        const vendible = qty - merma;
        if (vendible <= 0) return 0;
        return (cost * qty) / vendible;
    };

    const handleScanProduct = async (file: File) => {
        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanProduct(formData);

            if (result.success && result.data) {
                const data = result.data;
                setFormData(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    description: data.description || prev.description,
                    price: data.price || prev.price,
                    category: data.category || prev.category,
                    unit: (data.unit as any) || prev.unit,
                    // If barcode is found, we might want to store it, but Product interface doesn't have it explicitly shown in form state init
                    // Assuming we can add it if it exists in type
                }));
                // If image was captured, we can also set it as preview
                const url = URL.createObjectURL(file);
                setFormData(prev => ({ ...prev, imageUrl: url }));
            } else {
                alert('No se pudo escanear el producto. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    const totalStock = formData.batches?.reduce((sum, b) => sum + (b.quantity - (b.merma || 0)), 0) || 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {product ? 'Editar Producto' : 'Añadir Producto'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {product ? 'Edita los detalles del producto y sus lotes de compra.' : 'Registra un nuevo producto en el inventario.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCamera(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition text-sm font-medium"
                            disabled={isScanning}
                        >
                            <Camera className="w-4 h-4" />
                            {isScanning ? 'Escaneando...' : 'Escanear'}
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {/* Image Placeholder */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
                            {formData.imageUrl ? (
                                <img src={formData.imageUrl} alt="Preview" className="h-32 object-cover rounded mb-4" />
                            ) : (
                                <div className="h-32 w-full bg-gray-200 rounded mb-4 flex items-center justify-center text-gray-400">Sin Imagen</div>
                            )}
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                                    <Upload className="w-4 h-4" /> Subir Imagen
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                const url = URL.createObjectURL(e.target.files[0]);
                                                setFormData({ ...formData, imageUrl: url });
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent h-20 resize-none"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida</label>
                                <select
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value as any })}
                                >
                                    <option value="kg">Kg</option>
                                    <option value="unit">Unidad</option>
                                    <option value="liter">Litro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta por {formData.unit}</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tasa IVA (Decimal)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    value={formData.vatRate}
                                    onChange={e => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Clave de Producto SAT</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                value={formData.satKey}
                                onChange={e => setFormData({ ...formData, satKey: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">Use la IA para encontrar la clave fiscal para facturación.</p>
                        </div>
                    </div>

                    {/* Inventory Settings */}
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-orange-800 mb-1">Punto de Reorden (Mínimo)</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                    value={formData.minStock}
                                    onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                                />
                                <p className="text-xs text-orange-600 mt-1">Alerta cuando el stock baje de este nivel.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-orange-800 mb-1">Stock Máximo</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                    value={formData.maxStock}
                                    onChange={e => setFormData({ ...formData, maxStock: Number(e.target.value) })}
                                />
                                <p className="text-xs text-orange-600 mt-1">Define un tope para evitar sobre-inventario.</p>
                            </div>
                        </div>
                    </div>

                    {/* Batches Section */}
                    <div className="border rounded-lg p-4 border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">Lotes de Compra (Inventario)</h3>
                            <span className="text-sm font-bold text-gray-900">Stock Vendible: {totalStock.toFixed(2)} {formData.unit}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Aquí registras cada compra que haces del producto.</p>

                        {/* List of existing batches */}
                        <div className="space-y-3 mb-6">
                            {formData.batches?.map(batch => (
                                <div key={batch.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 relative">
                                    <button onClick={() => removeBatch(batch.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="text-sm font-medium text-gray-900">{batch.provider}</div>
                                    <div className="text-xs text-gray-500 flex gap-4 mt-1">
                                        <span>{batch.date.toLocaleDateString()}</span>
                                        <span>{batch.quantity} {formData.unit} @ {formatCurrency(batch.cost)}/{formData.unit}</span>
                                        {batch.merma > 0 && <span className="text-red-500">Merma: {batch.merma} {formData.unit}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add New Batch Form */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h4 className="text-sm font-bold text-blue-900 mb-3">Añadir Lote de Compra</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input
                                    placeholder="Proveedor"
                                    className="w-full p-2 border border-blue-200 rounded text-sm"
                                    value={newBatch.provider}
                                    onChange={e => setNewBatch({ ...newBatch, provider: e.target.value })}
                                />
                                <input
                                    placeholder="Factura (Opcional)"
                                    className="w-full p-2 border border-blue-200 rounded text-sm"
                                    value={newBatch.invoice}
                                    onChange={e => setNewBatch({ ...newBatch, invoice: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input
                                    type="number"
                                    placeholder={`Cantidad (${formData.unit})`}
                                    className="w-full p-2 border border-blue-200 rounded text-sm"
                                    value={newBatch.quantity || ''}
                                    onChange={e => setNewBatch({ ...newBatch, quantity: Number(e.target.value) })}
                                />
                                <input
                                    type="number"
                                    placeholder={`Costo por ${formData.unit}`}
                                    className="w-full p-2 border border-blue-200 rounded text-sm"
                                    value={newBatch.cost || ''}
                                    onChange={e => setNewBatch({ ...newBatch, cost: Number(e.target.value) })}
                                />
                            </div>

                            <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Trash2 className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs font-medium text-gray-700">Gestión de Merma</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        placeholder={`Cantidad Merma (${formData.unit})`}
                                        className="w-full p-2 border border-gray-200 rounded text-sm"
                                        value={newBatch.merma || ''}
                                        onChange={e => setNewBatch({ ...newBatch, merma: Number(e.target.value) })}
                                    />
                                    <input
                                        placeholder="Razón de Merma (Ej: Grasa)"
                                        className="w-full p-2 border border-gray-200 rounded text-sm"
                                        value={newBatch.mermaReason}
                                        onChange={e => setNewBatch({ ...newBatch, mermaReason: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Real Cost Calculation */}
                            {(newBatch.quantity || 0) > 0 && (
                                <div className="bg-white border border-blue-100 rounded p-3 mb-3 flex items-start gap-2">
                                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-900">Costo Real del Lote</p>
                                        <p className="text-xs text-gray-600">
                                            El costo de la merma se distribuye en el producto vendible.
                                            Tu costo real por {formData.unit} para este lote es de: <span className="font-bold text-gray-900">{formatCurrency(calculateRealCost(newBatch.cost || 0, newBatch.quantity || 0, newBatch.merma || 0))}</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleAddBatch}
                                className="w-full py-2 bg-white border border-blue-300 text-blue-700 font-medium rounded hover:bg-blue-50 transition text-sm flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Añadir Lote
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                        Cancelar
                    </button>
                    <button onClick={() => {
                        const totalStock = formData.batches?.reduce((sum, b) => sum + (b.quantity - (b.merma || 0)), 0) || 0;
                        const totalValue = formData.batches?.reduce((sum, b) => sum + (b.cost * b.quantity), 0) || 0;
                        const totalQty = formData.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0;
                        const averageCost = totalQty > 0 ? totalValue / totalQty : 0;

                        onSave({
                            ...formData,
                            stock: totalStock,
                            cost: averageCost
                        });
                    }} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                        Guardar Producto
                    </button>
                </div>
            </div>
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanProduct}
            />
        </div>
    );
}
