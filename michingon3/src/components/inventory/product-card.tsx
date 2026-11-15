'use client';

import { Product } from '@/types/business';
import { Trash2, Edit, Package, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-dialog';

interface ProductCardProps {
    product: Product;
    onDelete: (id: string) => void;
    onEdit?: (product: Product) => void;
}

export function ProductCard({ product, onDelete, onEdit }: ProductCardProps) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    };

    return (
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 hover:border-purple-500/30 transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Package className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{product.name}</h3>
                        <p className="text-xs text-gray-400">{product.category}</p>
                    </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock <= (product.minStock || 5)
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>
                    {product.stock} {product.unit || 'units'}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Precio</p>
                    <p className="text-sm font-medium text-white">{formatCurrency(product.price)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Costo</p>
                    <p className="text-sm font-medium text-gray-300">{formatCurrency(product.cost)}</p>
                </div>
            </div>

            <div className="flex space-x-2 mt-2 pt-4 border-t border-white/5">
                <button
                    onClick={() => onEdit?.(product)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    <Edit className="h-3 w-3" />
                    <span>Editar</span>
                </button>

                <AlertDialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialog.Trigger asChild>
                        <button
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            <Trash2 className="h-3 w-3" />
                            <span>Eliminar</span>
                        </button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Portal>
                        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                        <AlertDialog.Content className="fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-[#1a1a1a] p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-50 border border-white/10">
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-6 w-6 text-red-500" />
                                </div>
                                <AlertDialog.Title className="text-lg font-bold text-white mb-2">
                                    ¿Estás seguro?
                                </AlertDialog.Title>
                                <AlertDialog.Description className="text-sm text-gray-400">
                                    Esta acción eliminará permanentemente el producto <span className="text-white font-medium">"{product.name}"</span>. No se puede deshacer.
                                </AlertDialog.Description>
                            </div>
                            <div className="flex justify-end gap-[25px]">
                                <AlertDialog.Close asChild>
                                    <button className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
                                        Cancelar
                                    </button>
                                </AlertDialog.Close>
                                <AlertDialog.Close asChild>
                                    <button
                                        onClick={() => {
                                            onDelete(product.id);
                                            setIsDeleteDialogOpen(false);
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Sí, eliminar
                                    </button>
                                </AlertDialog.Close>
                            </div>
                        </AlertDialog.Content>
                    </AlertDialog.Portal>
                </AlertDialog.Root>
            </div>
        </div>
    );
}
