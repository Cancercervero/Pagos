'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Product } from '@/types/business';

interface NewSaleDialogProps {
    open: boolean;
    onClose: () => void;
}

interface SaleItem {
    product: Product;
    quantity: number;
}

export function NewSaleDialog({ open, onClose }: NewSaleDialogProps) {
    const { products, clients, addSale } = useData();
    const [selectedClient, setSelectedClient] = useState('');
    const [items, setItems] = useState<SaleItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
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
        if (items.length === 0) return;

        setLoading(true);
        try {
            await addSale({
                clientId: selectedClient || undefined,
                products: items.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.product.price * item.quantity
                })),
                total: calculateTotal(),
                paymentMethod,
                status: 'completed'
            });

            // Reset form
            setItems([]);
            setSelectedClient('');
            setPaymentMethod('cash');
            onClose();
        } catch (error) {
            console.error('Error creating sale:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Nueva Venta</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Client Selection */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Cliente (Opcional)
                        </label>
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                        >
                            <option value="">Sin cliente</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Add Products */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-white/80">
                            Agregar Productos
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
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
                                className="w-20 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                placeholder="Cant"
                            />
                            <button
                                type="button"
                                onClick={addItem}
                                disabled={!selectedProduct}
                                className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white/80">
                                Productos en la venta
                            </label>
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div
                                        key={item.product.id}
                                        className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl"
                                    >
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{item.product.name}</p>
                                            <p className="text-white/60 text-sm">
                                                {item.quantity} x ${item.product.price} = ${item.product.price * item.quantity}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.product.id)}
                                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Método de Pago
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                        >
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">Transferencia</option>
                        </select>
                    </div>

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-white/80 font-medium">Total:</span>
                                <span className="text-2xl font-bold text-purple-400">
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
                            className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={items.length === 0 || loading}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Guardando...' : 'Registrar Venta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
