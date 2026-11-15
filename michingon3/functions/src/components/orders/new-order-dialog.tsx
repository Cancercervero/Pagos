'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Product } from '@/types/business';

interface NewOrderDialogProps {
    open: boolean;
    onClose: () => void;
}

interface OrderItem {
    product: Product;
    quantity: number;
    notes?: string;
}

export function NewOrderDialog({ open, onClose }: NewOrderDialogProps) {
    const { products, clients, addOrder } = useData();
    const [selectedClient, setSelectedClient] = useState('');
    const [items, setItems] = useState<OrderItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
    const [deliveryTime, setDeliveryTime] = useState('12:00');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const addItem = () => {
        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        const existingItem = items.find(item => item.product.id === product.id);
        if (existingItem) {
            setItems(items.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            ));
        } else {
            setItems([...items, { product, quantity }]);
        }

        setSelectedProduct('');
        setQuantity(1);
    };

    const removeItem = (productId: string) => {
        setItems(items.filter(item => item.product.id !== productId));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0 || !selectedClient) {
            alert('Selecciona un cliente y agrega productos');
            return;
        }

        setLoading(true);
        try {
            const client = clients.find(c => c.id === selectedClient);
            await addOrder({
                clientName: client?.name || 'Cliente Desconocido',
                items: items.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    notes: item.notes
                })),
                status: 'pending',
                deliveryDate: new Date(deliveryDate),
                deliveryTime,
                notes
            });

            // Reset form
            setItems([]);
            setSelectedClient('');
            setNotes('');
            onClose();
            alert('Pedido creado exitosamente');
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error al crear el pedido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Nuevo Pedido</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Client Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cliente (Requerido)
                        </label>
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none"
                            required
                        >
                            <option value="">Seleccionar cliente</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Delivery Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha de Entrega
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Entrega
                            </label>
                            <input
                                type="time"
                                value={deliveryTime}
                                onChange={(e) => setDeliveryTime(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Add Products */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Agregar Productos
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none"
                            >
                                <option value="">Seleccionar producto</option>
                                {products.map(product => (
                                    <option key={product.id} value={product.id}>
                                        {product.name} - ${product.price}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                className="w-20 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none"
                                placeholder="Cant"
                            />
                            <button
                                type="button"
                                onClick={addItem}
                                disabled={!selectedProduct}
                                className="px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Productos en el pedido
                            </label>
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div
                                        key={item.product.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl"
                                    >
                                        <div className="flex-1">
                                            <p className="text-gray-900 font-medium">{item.product.name}</p>
                                            <p className="text-gray-500 text-sm">
                                                {item.quantity} x ${item.product.price} = ${item.product.price * item.quantity}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.product.id)}
                                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notas Generales
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:border-teal-500 focus:outline-none resize-none h-24"
                            placeholder="Instrucciones especiales..."
                        />
                    </div>

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-700 font-medium">Total Estimado:</span>
                                <span className="text-2xl font-bold text-teal-600">
                                    ${calculateTotal().toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={items.length === 0 || loading}
                            className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Guardando...' : 'Crear Pedido'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
