'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/utils';
import {
    Search,
    Plus,
    ScanLine,
    ClipboardCheck,
    Camera
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProductModal from '@/components/inventory/ProductModal';
import { ProductCard } from '@/components/inventory/product-card';
import { Product } from '@/types/business';
import { CameraModal } from '@/components/ui/camera-modal';
import { scanInvoice } from '@/app/actions/scan-actions';

export default function InventoryPage() {
    const { products, addProduct, updateProduct, deleteProduct } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
    const router = useRouter();

    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleScanInvoice = async (file: File) => {
        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanInvoice(formData);

            if (result.success && result.data) {
                alert(`Factura escaneada: ${result.data.supplierName || 'Proveedor'} - Total: ${result.data.total}`);
                // Here you could create products from the invoice items
            } else {
                alert('No se pudo escanear la factura. Intenta de nuevo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (product?: Product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleSaveProduct = async (productData: Partial<Product>) => {
        try {
            if (selectedProduct) {
                await updateProduct(selectedProduct.id, productData);
            } else {
                await addProduct(productData as any);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Error al guardar el producto");
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            await deleteProduct(id);
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar producto por nombre o categoría.."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/business/demo/inventory/reconciliation`)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                    >
                        <ClipboardCheck className="w-4 h-4" />
                        Conciliar Inventario
                    </button>
                    <button
                        onClick={() => setShowCamera(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                        disabled={isScanning}
                    >
                        <Camera className="w-4 h-4" />
                        {isScanning ? 'Escaneando...' : 'Escanear Factura'}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Producto
                    </button>
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        onDelete={handleDeleteProduct}
                        onEdit={handleOpenModal}
                    />
                ))}
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProduct}
                product={selectedProduct}
            />
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleScanInvoice}
            />
        </div>
    );
}
