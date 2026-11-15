'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/utils';
import { Search, Scan, Minus, Plus, X, Camera } from 'lucide-react';
import Image from 'next/image';
import { Product } from '@/types/business';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanProduct } from '@/app/actions/scan-actions';

interface CartItem {
    product: Product;
    quantity: number;
}

export default function POSPage() {
    const { products, addSale, updateProduct } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.product.id === product.id);
        if (existingItem) {
            setCart(cart.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { product, quantity: 1 }]);
        }
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.product.id === productId) {
                const newQuantity = item.quantity + delta;
                return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        try {
            // Register sale
            await addSale({
                products: cart.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.product.price * item.quantity
                })),
                total,
                paymentMethod: 'cash',
                status: 'completed'
            });

            // Update inventory stock
            for (const item of cart) {
                const product = products.find(p => p.id === item.product.id);
                if (product) {
                    await updateProduct(product.id, {
                        stock: product.stock - item.quantity
                    });
                }
            }

            setCart([]);
            setShowCheckoutModal(false);
            alert('¡Venta registrada e inventario actualizado exitosamente!');
        } catch (error) {
            console.error('Error al registrar venta:', error);
            alert('Error al registrar la venta');
        }
    };

    const handleScanProduct = async (file: File) => {
        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanProduct(formData);

            if (result.success && result.data) {
                const scannedData = result.data;
                console.log("Scanned Product:", scannedData);

                // Try to find product by name match (fuzzy)
                const matchedProduct = products.find(p =>
                    p.name.toLowerCase().includes((scannedData.name || '').toLowerCase()) ||
                    (scannedData.barcode && p.id === scannedData.barcode) // Assuming ID might be barcode for now
                );

                if (matchedProduct) {
                    addToCart(matchedProduct);
                    alert(`Producto encontrado: ${matchedProduct.name}`);
                } else {
                    alert(`Producto no encontrado en inventario.\nDetectado: ${scannedData.name}\nPrecio sugerido: ${scannedData.price}`);
                }
            } else {
                alert('No se pudo identificar el producto.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Caja / Punto de Venta</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Products */}
                <div className="lg:col-span-2">
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Localiza productos por nombre o categoría..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-gray-600 uppercase">Productos</h2>
                        <p className="text-xs text-gray-400">Localiza productos para añadir al carrito.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col group cursor-pointer"
                            >
                                <div className="relative h-32 w-full bg-gray-100">
                                    {product.imageUrl ? (
                                        <Image
                                            src={product.imageUrl}
                                            alt={product.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                                            Sin Imagen
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col">
                                    <h3 className="font-bold text-sm text-gray-900 truncate mb-1">{product.name}</h3>
                                    <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                                    <div className="mt-auto">
                                        <span className="block text-base font-bold text-gray-900">{formatCurrency(product.price)}</span>
                                        <span className="text-[10px] text-gray-400">/ {product.unit || 'Kg'}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Cart */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit sticky top-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Carrito de Compra</h2>
                        <button
                            onClick={() => setShowCamera(true)}
                            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-xs font-medium"
                            disabled={isScanning}
                        >
                            <Camera className="w-3 h-3" />
                            {isScanning ? 'Escaneando...' : 'Escanear Producto'}
                        </button>
                    </div>

                    {cart.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-gray-400 text-sm">El carrito está vacío.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 mb-6">
                            {cart.map((item) => (
                                <div key={item.product.id} className="border-b border-gray-100 pb-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-sm text-gray-900">{item.product.name}</h3>
                                            <p className="text-xs text-gray-500">{formatCurrency(item.product.price)}</p>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.product.id)}
                                            className="text-gray-400 hover:text-red-600 transition"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.product.id, -1)}
                                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.product.id, 1)}
                                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <span className="font-bold text-sm text-gray-900">
                                            {formatCurrency(item.product.price * item.quantity)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-gray-200 pt-4 mb-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-lg font-bold text-gray-900">Total:</span>
                            <span className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</span>
                        </div>
                        <button
                            onClick={() => setShowCheckoutModal(true)}
                            disabled={cart.length === 0}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                        >
                            Cobrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckoutModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Finalizar Venta</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Esto registrará la venta y actualizará el inventario. Esta acción no se puede deshacer.
                        </p>

                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">Total a Cobrar:</span>
                            </div>
                            <div className="text-4xl font-bold text-gray-900 text-center py-4">
                                {formatCurrency(total)}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCheckoutModal(false)}
                                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCheckout}
                                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold"
                            >
                                Confirmar Venta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanProduct}
            />
        </div>
    );
}
