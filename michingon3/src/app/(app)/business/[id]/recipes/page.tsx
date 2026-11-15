'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ChefHat, Clock, DollarSign, FileText, MoreVertical, Edit, Trash2, Copy, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { getRecipeCategories, businessUsesRecipes } from '@/lib/business-categories';
import RecipeMethodSelector from '@/components/recipes/RecipeMethodSelector';
import QuickRecipeEntry from '@/components/recipes/QuickRecipeEntry';
import RecipeScannerModal from '@/components/recipes/RecipeScannerModal';
import RecipeFileUpload from '@/components/recipes/RecipeFileUpload';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface RecipeData {
    id?: string;
    name: string;
    code: string;
    category: string;
    emoji: string;
    yield: number;
    yieldUnit: string;
    totalTime: number;
    difficulty: string;
    costPerUnit: number;
    sellingPrice: number;
    margin: number;
    imageUrl?: string;
    isActive: boolean;
    lastUpdate: string;
    ingredients: { name: string; quantity: number; unit: string; cost: number }[];
    laborSteps: { description: string; timeMinutes: number }[];
    procedure: string[];
    businessId: string;
}

// Categorías dinámicas - se cargan según el tipo de negocio

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function RecipesPage() {
    const params = useParams();
    const businessId = params.id as string;

    const [recipes, setRecipes] = useState<RecipeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [categories, setCategories] = useState<string[]>(['Todos']);
    const [businessCategory, setBusinessCategory] = useState<string>('other');
    const [creationMethod, setCreationMethod] = useState<'manual' | 'scan' | 'upload' | null>(null);

    // Load business info and recipes from Firebase
    useEffect(() => {
        const loadData = async () => {
            try {
                // Cargar info del negocio primero
                const businessDoc = await getDoc(doc(db, 'businesses', businessId));
                if (businessDoc.exists()) {
                    const bizData = businessDoc.data();
                    const bizCategory = bizData.category || 'other';
                    setBusinessCategory(bizCategory);

                    // Obtener categorías dinámicas según el tipo de negocio
                    const dynamicCategories = getRecipeCategories(bizCategory);
                    setCategories(['Todos', ...dynamicCategories]);
                }

                // Cargar recetas
                const recipesRef = collection(db, 'businesses', businessId, 'recipes');
                const snapshot = await getDocs(recipesRef);
                const loadedRecipes: RecipeData[] = [];
                snapshot.forEach(doc => {
                    loadedRecipes.push({ id: doc.id, ...doc.data() } as RecipeData);
                });
                setRecipes(loadedRecipes);
            } catch (err) {
                console.error('Error loading data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [businessId]);

    // Save new recipe to Firebase
    const saveRecipe = async (recipeData: Omit<RecipeData, 'id'>) => {
        try {
            const recipesRef = collection(db, 'businesses', businessId, 'recipes');
            const docRef = await addDoc(recipesRef, {
                ...recipeData,
                businessId,
                createdAt: new Date().toISOString()
            });
            setRecipes(prev => [...prev, { ...recipeData, id: docRef.id }]);
            return docRef.id;
        } catch (err) {
            console.error('Error saving recipe:', err);
            throw err;
        }
    };

    // Delete recipe
    const deleteRecipe = async (recipeId: string) => {
        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'recipes', recipeId));
            setRecipes(prev => prev.filter(r => r.id !== recipeId));
        } catch (err) {
            console.error('Error deleting recipe:', err);
        }
    };

    const filteredRecipes = recipes.filter(recipe => {
        const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            recipe.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todos' || recipe.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <ChefHat className="w-8 h-8 text-teal-600" />
                        Recetas y Fichas Técnicas
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gestiona tus recetas, fórmulas y calcula costos automáticamente
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition shadow-lg shadow-teal-200"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Receta
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o código..."
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${selectedCategory === category
                                ? 'bg-teal-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Total Recetas</p>
                    <p className="text-2xl font-bold text-gray-900">{recipes.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Margen Promedio</p>
                    <p className="text-2xl font-bold text-emerald-600">
                        {recipes.length > 0 ? Math.round(recipes.reduce((acc, r) => acc + (r.margin || 0), 0) / recipes.length) : 0}%
                    </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Costo Promedio</p>
                    <p className="text-2xl font-bold text-gray-900">
                        ${recipes.length > 0 ? (recipes.reduce((acc, r) => acc + (r.costPerUnit || 0), 0) / recipes.length).toFixed(0) : 0}
                    </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Categorías</p>
                    <p className="text-2xl font-bold text-gray-900">{categories.length - 1}</p>
                </div>
            </div>

            {/* Recipes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecipes.map(recipe => (
                    <RecipeCard key={recipe.id} recipe={recipe} businessId={businessId} />
                ))}

                {/* Empty State */}
                {filteredRecipes.length === 0 && (
                    <div className="col-span-full text-center py-16">
                        <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No hay recetas
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {searchTerm ? 'No se encontraron recetas con ese término' : 'Crea tu primera receta para empezar'}
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition"
                        >
                            Crear Primera Receta
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal - New System */}
            {showCreateModal && !creationMethod && (
                <RecipeMethodSelector
                    onSelectMethod={(method) => {
                        setCreationMethod(method);
                    }}
                    onClose={() => {
                        setShowCreateModal(false);
                        setCreationMethod(null);
                    }}
                />
            )}

            {/* Quick Entry */}
            {showCreateModal && creationMethod === 'manual' && (
                <QuickRecipeEntry
                    onClose={() => {
                        setShowCreateModal(false);
                        setCreationMethod(null);
                    }}
                    onSave={async (data) => { await saveRecipe(data); }}
                    businessId={businessId}
                    categories={categories}
                />
            )}

            {/* File Upload */}
            {showCreateModal && creationMethod === 'upload' && (
                <RecipeFileUpload
                    onClose={() => {
                        setShowCreateModal(false);
                        setCreationMethod(null);
                    }}
                    onSave={async (data) => { await saveRecipe(data); }}
                    businessId={businessId}
                    categories={categories}
                />
            )}

            {/* Scanner */}
            {showCreateModal && creationMethod === 'scan' && (
                <RecipeScannerModal
                    onClose={() => {
                        setShowCreateModal(false);
                        setCreationMethod(null);
                    }}
                    onSave={async (data) => { await saveRecipe(data); }}
                    businessId={businessId}
                    categories={categories}
                />
            )}

            {/* OLD Modal - Commented for now, can be restored as "Advanced Mode" */}
            {/* {showCreateModal && creationMethod === 'advanced' && (
                <CreateRecipeModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={saveRecipe}
                    businessId={businessId}
                    categories={categories}
                />
            )} */}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// RECIPE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

interface RecipeCardProps {
    recipe: RecipeData;
    businessId: string;
    onDelete?: (id: string) => void;
}

function RecipeCard({ recipe, businessId }: RecipeCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    const marginColor = recipe.margin >= 60 ? 'text-emerald-600 bg-emerald-50' :
        recipe.margin >= 40 ? 'text-amber-600 bg-amber-50' :
            'text-red-600 bg-red-50';

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition group">
            {/* Image */}
            <div className="relative h-40 bg-gray-100">
                {recipe.imageUrl ? (
                    <img
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                        {recipe.emoji}
                    </div>
                )}

                {/* Menu Button */}
                <div className="absolute top-2 right-2">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 bg-white/90 hover:bg-white rounded-lg shadow transition"
                    >
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                <Eye className="w-4 h-4" /> Ver Ficha
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                <Edit className="w-4 h-4" /> Editar
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                <Copy className="w-4 h-4" /> Duplicar
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                        </div>
                    )}
                </div>

                {/* Margin Badge */}
                <div className={`absolute bottom-2 left-2 px-2 py-1 rounded-lg text-xs font-bold ${marginColor}`}>
                    {recipe.margin}% margen
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <p className="text-xs text-gray-400 font-mono">{recipe.code}</p>
                        <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {recipe.totalTime} min
                    </span>
                    <span>
                        {recipe.yield} {recipe.yieldUnit}
                    </span>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                        <p className="text-xs text-gray-400">Costo</p>
                        <p className="font-bold text-gray-900">${recipe.costPerUnit.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Precio Venta</p>
                        <p className="font-bold text-emerald-600">${recipe.sellingPrice}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// CREATE RECIPE MODAL
// ═══════════════════════════════════════════════════════════════

interface CreateRecipeModalProps {
    onClose: () => void;
    onSave: (recipe: any) => Promise<string>;
    businessId: string;
    categories: string[];
}

function CreateRecipeModal({ onClose, onSave, businessId, categories }: CreateRecipeModalProps) {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [recipe, setRecipe] = useState({
        name: '',
        code: '',
        category: '',
        yield: 1,
        yieldUnit: 'porciones',
        ingredients: [] as { name: string; quantity: number; unit: string; cost: number }[],
        laborSteps: [] as { description: string; timeMinutes: number }[],
        procedure: [] as string[],
        sellingPrice: 0
    });

    // Placeholder ingredient for demo
    const [newIngredient, setNewIngredient] = useState({ name: '', quantity: 0, unit: 'kg', cost: 0 });

    const addIngredient = () => {
        if (newIngredient.name && newIngredient.quantity > 0) {
            setRecipe(prev => ({
                ...prev,
                ingredients: [...prev.ingredients, { ...newIngredient }]
            }));
            setNewIngredient({ name: '', quantity: 0, unit: 'kg', cost: 0 });
        }
    };

    // Calculate costs
    const ingredientsCost = recipe.ingredients.reduce((sum, i) => sum + i.cost, 0);
    const laborCost = recipe.laborSteps.reduce((sum, s) => sum + (s.timeMinutes / 60) * 50, 0); // $50/hr default
    const fixedCost = 3; // Demo fixed cost
    const totalCost = ingredientsCost + laborCost + fixedCost;
    const costPerUnit = recipe.yield > 0 ? totalCost / recipe.yield : 0;
    const margin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - costPerUnit) / recipe.sellingPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Nueva Receta</h2>
                        <p className="text-sm text-gray-500">Paso {step} de 4</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <span className="text-2xl text-gray-400">×</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">📝 Información Básica</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Receta</label>
                                    <input
                                        type="text"
                                        value={recipe.name}
                                        onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                                        placeholder="Ej: Orden de 10 Tacos de Bistec"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                                    <input
                                        type="text"
                                        value={recipe.code}
                                        onChange={(e) => setRecipe({ ...recipe, code: e.target.value })}
                                        placeholder="TAC-001"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                    <select
                                        value={recipe.category}
                                        onChange={(e) => setRecipe({ ...recipe, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.filter(c => c !== 'Todos').map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rendimiento</label>
                                    <input
                                        type="number"
                                        value={recipe.yield}
                                        onChange={(e) => setRecipe({ ...recipe, yield: parseInt(e.target.value) || 1 })}
                                        min="1"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                                    <input
                                        type="text"
                                        value={recipe.yieldUnit}
                                        onChange={(e) => setRecipe({ ...recipe, yieldUnit: e.target.value })}
                                        placeholder="porciones, tacos, servicios..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">🥩 Ingredientes / Materiales</h3>

                            {/* Add Ingredient Form */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            value={newIngredient.name}
                                            onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                            placeholder="Nombre del ingrediente"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            value={newIngredient.quantity || ''}
                                            onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
                                            placeholder="Cantidad"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <select
                                            value={newIngredient.unit}
                                            onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">g</option>
                                            <option value="ml">ml</option>
                                            <option value="L">L</option>
                                            <option value="pza">pza</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={newIngredient.cost || ''}
                                                onChange={(e) => setNewIngredient({ ...newIngredient, cost: parseFloat(e.target.value) || 0 })}
                                                placeholder="Costo"
                                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={addIngredient}
                                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Ingredients List */}
                            {recipe.ingredients.length > 0 ? (
                                <div className="space-y-2">
                                    {recipe.ingredients.map((ing, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                            <span className="font-medium">{ing.name}</span>
                                            <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                                            <span className="font-bold text-teal-600">${ing.cost.toFixed(2)}</span>
                                            <button
                                                onClick={() => setRecipe(prev => ({
                                                    ...prev,
                                                    ingredients: prev.ingredients.filter((_, idx) => idx !== i)
                                                }))}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="text-right pt-2 border-t">
                                        <span className="text-gray-500">Subtotal Insumos: </span>
                                        <span className="font-bold text-lg">${ingredientsCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <p>Agrega los ingredientes necesarios</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">👷 Mano de Obra</h3>
                            <p className="text-sm text-gray-500">
                                Define los pasos de preparación y el tiempo de cada uno.
                                Se calculará el costo basado en la tarifa de mano de obra configurada.
                            </p>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Descripción del paso"
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        id="labor-step-desc"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        id="labor-step-time"
                                    />
                                    <button
                                        onClick={() => {
                                            const descInput = document.getElementById('labor-step-desc') as HTMLInputElement;
                                            const timeInput = document.getElementById('labor-step-time') as HTMLInputElement;
                                            if (descInput.value && timeInput.value) {
                                                setRecipe(prev => ({
                                                    ...prev,
                                                    laborSteps: [...prev.laborSteps, {
                                                        description: descInput.value,
                                                        timeMinutes: parseInt(timeInput.value)
                                                    }]
                                                }));
                                                descInput.value = '';
                                                timeInput.value = '';
                                            }
                                        }}
                                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            {recipe.laborSteps.length > 0 && (
                                <div className="space-y-2">
                                    {recipe.laborSteps.map((step, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                            <span className="font-medium">{step.description}</span>
                                            <span className="text-gray-500">{step.timeMinutes} min</span>
                                            <span className="font-bold text-blue-600">
                                                ${((step.timeMinutes / 60) * 50).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="text-right pt-2 border-t">
                                        <span className="text-gray-500">Subtotal Mano de Obra: </span>
                                        <span className="font-bold text-lg">${laborCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">💰 Costeo Final y Precio</h3>

                            {/* Cost Breakdown */}
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">💰 Insumos/Materiales</span>
                                    <span className="font-semibold">${ingredientsCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">👷 Mano de Obra</span>
                                    <span className="font-semibold">${laborCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">🏢 Infraestructura (prorrateo)</span>
                                    <span className="font-semibold">${fixedCost.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-300 pt-4">
                                    <div className="flex justify-between text-lg">
                                        <span className="font-bold">COSTO TOTAL</span>
                                        <span className="font-bold text-gray-900">${totalCost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                                        <span>Costo por {recipe.yieldUnit || 'unidad'}</span>
                                        <span>${costPerUnit.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Selling Price */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    💵 Tu Precio de Venta (por {recipe.yieldUnit || 'unidad'})
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                                    <input
                                        type="number"
                                        value={recipe.sellingPrice || ''}
                                        onChange={(e) => setRecipe({ ...recipe, sellingPrice: parseFloat(e.target.value) || 0 })}
                                        placeholder="0.00"
                                        className="w-full pl-10 pr-4 py-4 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                                    />
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                    💡 Precio sugerido (50% margen): ${(costPerUnit * 1.5).toFixed(2)}
                                </p>
                            </div>

                            {/* Margin Result */}
                            {recipe.sellingPrice > 0 && (
                                <div className={`rounded-xl p-6 ${margin >= 50 ? 'bg-emerald-50 border border-emerald-200' :
                                    margin >= 30 ? 'bg-amber-50 border border-amber-200' :
                                        'bg-red-50 border border-red-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Tu ganancia por {recipe.yieldUnit || 'unidad'}</p>
                                            <p className="text-3xl font-bold">
                                                ${(recipe.sellingPrice - costPerUnit).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">Margen</p>
                                            <p className={`text-3xl font-bold ${margin >= 50 ? 'text-emerald-600' :
                                                margin >= 30 ? 'text-amber-600' :
                                                    'text-red-600'
                                                }`}>
                                                {margin.toFixed(0)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                        {step === 1 ? 'Cancelar' : '← Atrás'}
                    </button>
                    <button
                        onClick={async () => {
                            if (step < 4) {
                                setStep(step + 1);
                            } else {
                                // Guardar receta en Firebase
                                setSaving(true);
                                try {
                                    const totalTime = recipe.laborSteps.reduce((sum, s) => sum + s.timeMinutes, 0);
                                    await onSave({
                                        name: recipe.name,
                                        code: recipe.code || `REC-${Date.now()}`,
                                        category: recipe.category || 'General',
                                        emoji: '📋',
                                        yield: recipe.yield,
                                        yieldUnit: recipe.yieldUnit,
                                        totalTime,
                                        difficulty: 'medio',
                                        costPerUnit,
                                        sellingPrice: recipe.sellingPrice,
                                        margin: Math.round(margin),
                                        isActive: true,
                                        lastUpdate: new Date().toISOString().split('T')[0],
                                        ingredients: recipe.ingredients,
                                        laborSteps: recipe.laborSteps,
                                        procedure: recipe.procedure,
                                        businessId
                                    });
                                    onClose();
                                } catch (err) {
                                    console.error('Error saving recipe:', err);
                                } finally {
                                    setSaving(false);
                                }
                            }
                        }}
                        disabled={saving}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg disabled:bg-gray-400"
                    >
                        {saving ? 'Guardando...' : step < 4 ? 'Siguiente →' : '✅ Guardar Receta'}
                    </button>
                </div>
            </div>
        </div>
    );
}
