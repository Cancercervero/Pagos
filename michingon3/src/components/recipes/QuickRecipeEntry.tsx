'use client';

import { useState, useRef } from 'react';
import { X, Upload, Camera, Plus, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface QuickRecipeEntryProps {
    onClose: () => void;
    onSave: (recipe: any) => Promise<void>;
    businessId: string;
    categories: string[];
}

interface Ingredient {
    name: string;
    quantity: string;
    unit: string;
}

export default function QuickRecipeEntry({ onClose, onSave, businessId, categories }: QuickRecipeEntryProps) {
    const [saving, setSaving] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [recipe, setRecipe] = useState({
        name: '',
        category: '',
        ingredients: [] as Ingredient[],
        procedure: '',
        imageUrl: ''
    });

    const [newIngredient, setNewIngredient] = useState<Ingredient>({
        name: '',
        quantity: '',
        unit: 'g'
    });

    const handleAddIngredient = () => {
        if (newIngredient.name && newIngredient.quantity) {
            setRecipe(prev => ({
                ...prev,
                ingredients: [...prev.ingredients, { ...newIngredient }]
            }));
            setNewIngredient({ name: '', quantity: '', unit: 'g' });
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setRecipe(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index)
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setImagePreview(result);
                setRecipe(prev => ({ ...prev, imageUrl: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!recipe.name || recipe.ingredients.length === 0) {
            alert('Por favor completa el nombre y al menos un ingrediente');
            return;
        }

        setSaving(true);
        try {
            // Preparar datos para guardar
            const recipeData = {
                name: recipe.name,
                code: `REC-${Date.now()}`,
                category: recipe.category || 'General',
                emoji: '📋',
                yield: 1,
                yieldUnit: 'porción',
                totalTime: 0,
                difficulty: 'medio',
                costPerUnit: 0, // Se calculará en el backend
                sellingPrice: 0,
                margin: 0,
                isActive: true,
                lastUpdate: new Date().toISOString().split('T')[0],
                ingredients: recipe.ingredients.map(ing => ({
                    name: ing.name,
                    quantity: parseFloat(ing.quantity) || 0,
                    unit: ing.unit,
                    cost: 0 // Se buscará en inventario
                })),
                laborSteps: [],
                procedure: recipe.procedure.split('\n').filter(p => p.trim()),
                imageUrl: recipe.imageUrl,
                businessId
            };

            await onSave(recipeData);
            onClose();
        } catch (error) {
            console.error('Error saving recipe:', error);
            alert('Error al guardar receta');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">📝 Entrada Rápida</h2>
                        <p className="text-sm text-gray-500">Solo ingredientes y pasos - nosotros calculamos costos</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nombre de la Receta *
                            </label>
                            <input
                                type="text"
                                value={recipe.name}
                                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                                placeholder="Ej: Gorditas de chicharrón"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categoría
                            </label>
                            <select
                                value={recipe.category}
                                onChange={(e) => setRecipe({ ...recipe, category: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                            >
                                <option value="">Seleccionar...</option>
                                {categories.filter(c => c !== 'Todos').map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Foto del Platillo
                            </label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-teal-500 transition flex items-center justify-center gap-2 text-gray-600"
                            >
                                {imagePreview ? <Camera className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                                {imagePreview ? 'Cambiar foto' : 'Subir foto'}
                            </button>
                        </div>
                    </div>

                    {/* Image Preview */}
                    {imagePreview && (
                        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200">
                            <Image
                                src={imagePreview}
                                alt="Preview"
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}

                    {/* Ingredients */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Ingredientes *
                        </label>

                        {/* Add Ingredient Form */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-3">
                            <div className="grid grid-cols-12 gap-3">
                                <input
                                    type="text"
                                    value={newIngredient.name}
                                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                    placeholder="Nombre del ingrediente"
                                    className="col-span-6 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={newIngredient.quantity}
                                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                    placeholder="Cantidad"
                                    className="col-span-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 outline-none"
                                />
                                <select
                                    value={newIngredient.unit}
                                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                    className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 outline-none"
                                >
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    <option value="ml">ml</option>
                                    <option value="L">L</option>
                                    <option value="pza">pza</option>
                                    <option value="cda">cda</option>
                                    <option value="cdta">cdta</option>
                                </select>
                                <button
                                    onClick={handleAddIngredient}
                                    className="col-span-1 p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Ingredients List */}
                        {recipe.ingredients.length > 0 ? (
                            <div className="space-y-2">
                                {recipe.ingredients.map((ing, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                        <span className="font-medium">{ing.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                                            <button
                                                onClick={() => handleRemoveIngredient(i)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                <p>Agrega los ingredientes uno por uno</p>
                            </div>
                        )}
                    </div>

                    {/* Procedure */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Procedimiento
                        </label>
                        <textarea
                            value={recipe.procedure}
                            onChange={(e) => setRecipe({ ...recipe, procedure: e.target.value })}
                            placeholder="Escribe los pasos de preparación (uno por línea)"
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none resize-none"
                        />
                    </div>

                    {/* Info Box */}
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                        <p className="text-sm text-teal-800">
                            💡 <strong>No te preocupes por los costos</strong> - Buscaremos automáticamente los precios
                            de tus ingredientes en el inventario y calcularemos el costo total y precio sugerido.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !recipe.name || recipe.ingredients.length === 0}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            '✅ Guardar Receta'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
