'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    Product,
    Sale,
    Expense,
    Client,
    Employee,
    KPIMetrics,
    Asset,
    Supplier,
    Invoice,
    Order
} from '@/types/business';
import {
    initialProducts,
    initialSales,
    initialExpenses,
    initialClients,
    initialEmployees
} from '@/lib/data';
import { calculateKpiMetrics } from '@/lib/utils';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from './AuthContext';

interface DataContextType {
    // State
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    clients: Client[];
    employees: Employee[];
    assets: Asset[];
    suppliers: Supplier[];
    invoices: Invoice[];
    orders: Order[];
    kpiMetrics: KPIMetrics;
    loading: boolean;

    // Product CRUD
    addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;

    // Sale CRUD
    addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => Promise<void>;
    updateSale: (id: string, sale: Partial<Sale>) => Promise<void>;
    deleteSale: (id: string) => Promise<void>;

    // Expense CRUD
    addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
    updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;

    // Client CRUD
    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalPurchases'>) => Promise<void>;
    updateClient: (id: string, client: Partial<Client>) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;

    // Employee CRUD
    addEmployee: (employee: Omit<Employee, 'id'>) => Promise<void>;
    updateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;

    // Asset CRUD
    addAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateAsset: (id: string, asset: Partial<Asset>) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;

    // Supplier CRUD
    addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;

    // Invoice CRUD
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<void>;
    updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
    deleteInvoice: (id: string) => Promise<void>;

    // Order CRUD
    addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
    completeOrder: (id: string) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [sales, setSales] = useState<Sale[]>(initialSales);
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [clients, setClients] = useState<Client[]>(initialClients);
    const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [businessId, setBusinessId] = useState<string | null>(null);

    // Calculate KPIs whenever data changes
    const kpiMetrics = React.useMemo(() => {
        return calculateKpiMetrics(sales, expenses, products);
    }, [sales, expenses, products]);

    // Get businessId from user document
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchBusinessId = async () => {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists() && userDoc.data().businessId) {
                    setBusinessId(userDoc.data().businessId);
                } else {
                    // If user doesn't have a businessId, use 'demo' as fallback
                    setBusinessId('demo');
                }
            } catch (error) {
                console.error('Error fetching businessId:', error);
                setBusinessId('demo'); // Fallback to demo
            }
        };

        fetchBusinessId();
    }, [user]);

    // Firebase sync - Real-time listeners for all collections
    useEffect(() => {
        if (!user || !businessId) {
            setLoading(false);
            return;
        }

        const unsubscribers: (() => void)[] = [];

        setLoading(true);

        try {
            // Products listener
            const productsQuery = query(collection(db, `businesses/${businessId}/products`));
            unsubscribers.push(
                onSnapshot(productsQuery, (snapshot) => {
                    const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                    setProducts(productsData);
                }, (error) => console.error('Products listener error:', error))
            );

            // Sales listener
            const salesQuery = query(collection(db, `businesses/${businessId}/sales`));
            unsubscribers.push(
                onSnapshot(salesQuery, (snapshot) => {
                    const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() } as Sale));
                    setSales(salesData);
                }, (error) => console.error('Sales listener error:', error))
            );

            // Expenses listener
            const expensesQuery = query(collection(db, `businesses/${businessId}/expenses`));
            unsubscribers.push(
                onSnapshot(expensesQuery, (snapshot) => {
                    const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() } as Expense));
                    setExpenses(expensesData);
                }, (error) => console.error('Expenses listener error:', error))
            );

            // Clients listener
            const clientsQuery = query(collection(db, `businesses/${businessId}/clients`));
            unsubscribers.push(
                onSnapshot(clientsQuery, (snapshot) => {
                    const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() } as Client));
                    setClients(clientsData);
                }, (error) => console.error('Clients listener error:', error))
            );

            // Employees listener
            const employeesQuery = query(collection(db, `businesses/${businessId}/employees`));
            unsubscribers.push(
                onSnapshot(employeesQuery, (snapshot) => {
                    const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                    setEmployees(employeesData);
                }, (error) => console.error('Employees listener error:', error))
            );

            // Assets listener
            const assetsQuery = query(collection(db, `businesses/${businessId}/assets`));
            unsubscribers.push(
                onSnapshot(assetsQuery, (snapshot) => {
                    const assetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date(), updatedAt: doc.data().updatedAt?.toDate() || new Date() } as Asset));
                    setAssets(assetsData);
                }, (error) => console.error('Assets listener error:', error))
            );

            // Suppliers listener
            const suppliersQuery = query(collection(db, `businesses/${businessId}/suppliers`));
            unsubscribers.push(
                onSnapshot(suppliersQuery, (snapshot) => {
                    const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date(), updatedAt: doc.data().updatedAt?.toDate() || new Date() } as Supplier));
                    setSuppliers(suppliersData);
                }, (error) => console.error('Suppliers listener error:', error))
            );

            // Invoices listener
            const invoicesQuery = query(collection(db, `businesses/${businessId}/invoices`));
            unsubscribers.push(
                onSnapshot(invoicesQuery, (snapshot) => {
                    const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() || new Date(), createdAt: doc.data().createdAt?.toDate() || new Date() } as Invoice));
                    setInvoices(invoicesData);
                }, (error) => console.error('Invoices listener error:', error))
            );

            // Orders listener
            const ordersQuery = query(collection(db, `businesses/${businessId}/orders`));
            unsubscribers.push(
                onSnapshot(ordersQuery, (snapshot) => {
                    const ordersData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        deliveryDate: doc.data().deliveryDate?.toDate() || new Date(),
                        createdAt: doc.data().createdAt?.toDate() || new Date(),
                        updatedAt: doc.data().updatedAt?.toDate() || new Date()
                    } as Order));
                    setOrders(ordersData);
                }, (error) => console.error('Orders listener error:', error))
            );
        } catch (error) {
            console.error('Error setting up Firestore listeners:', error);
        }

        setLoading(false);

        // Cleanup function
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [user, businessId]);

    // ===== PRODUCT CRUD =====
    const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newProduct: Product = {
            ...productData,
            id: `prod-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        setProducts(prev => [...prev, newProduct]);

        // Optional: Sync to Firebase
        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/products`), newProduct);
            } catch (error) {
                console.error('Error adding product to Firebase:', error);
            }
        }
    };

    const updateProduct = async (id: string, productData: Partial<Product>) => {
        setProducts(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, ...productData, updatedAt: new Date() }
                    : p
            )
        );

        if (user) {
            const businessId = 'demo';
            try {
                const productRef = doc(db, `businesses/${businessId}/products`, id);
                await updateDoc(productRef, { ...productData, updatedAt: new Date() });
            } catch (error) {
                console.error('Error updating product:', error);
            }
        }
    };

    const deleteProduct = async (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/products`, id));
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        }
    };

    // ===== SALE CRUD =====
    const addSale = async (saleData: Omit<Sale, 'id' | 'createdAt'>) => {
        const newSale: Sale = {
            ...saleData,
            id: `sale-${Date.now()}`,
            createdAt: new Date(),
        };

        setSales(prev => [...prev, newSale]);

        // Update client total purchases if clientId exists
        if (saleData.clientId && saleData.status === 'completed') {
            setClients(prev =>
                prev.map(c =>
                    c.id === saleData.clientId
                        ? { ...c, totalPurchases: c.totalPurchases + saleData.total }
                        : c
                )
            );
        }

        // Update product stock
        saleData.products.forEach(item => {
            setProducts(prev =>
                prev.map(p =>
                    p.id === item.productId
                        ? { ...p, stock: p.stock - item.quantity }
                        : p
                )
            );
        });

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/sales`), newSale);
            } catch (error) {
                console.error('Error adding sale:', error);
            }
        }
    };

    const updateSale = async (id: string, saleData: Partial<Sale>) => {
        setSales(prev =>
            prev.map(s => (s.id === id ? { ...s, ...saleData } : s))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/sales`, id), saleData);
            } catch (error) {
                console.error('Error updating sale:', error);
            }
        }
    };

    const deleteSale = async (id: string) => {
        setSales(prev => prev.filter(s => s.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/sales`, id));
            } catch (error) {
                console.error('Error deleting sale:', error);
            }
        }
    };

    // ===== EXPENSE CRUD =====
    const addExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
        const newExpense: Expense = {
            ...expenseData,
            id: `exp-${Date.now()}`,
            createdAt: new Date(),
        };

        setExpenses(prev => [...prev, newExpense]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/expenses`), newExpense);
            } catch (error) {
                console.error('Error adding expense:', error);
            }
        }
    };

    const updateExpense = async (id: string, expenseData: Partial<Expense>) => {
        setExpenses(prev =>
            prev.map(e => (e.id === id ? { ...e, ...expenseData } : e))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/expenses`, id), expenseData);
            } catch (error) {
                console.error('Error updating expense:', error);
            }
        }
    };

    const deleteExpense = async (id: string) => {
        setExpenses(prev => prev.filter(e => e.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/expenses`, id));
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
        }
    };

    // ===== CLIENT CRUD =====
    const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'totalPurchases'>) => {
        const newClient: Client = {
            ...clientData,
            id: `client-${Date.now()}`,
            totalPurchases: 0,
            createdAt: new Date(),
        };

        setClients(prev => [...prev, newClient]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/clients`), newClient);
            } catch (error) {
                console.error('Error adding client:', error);
            }
        }
    };

    const updateClient = async (id: string, clientData: Partial<Client>) => {
        setClients(prev =>
            prev.map(c => (c.id === id ? { ...c, ...clientData } : c))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/clients`, id), clientData);
            } catch (error) {
                console.error('Error updating client:', error);
            }
        }
    };

    const deleteClient = async (id: string) => {
        setClients(prev => prev.filter(c => c.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/clients`, id));
            } catch (error) {
                console.error('Error deleting client:', error);
            }
        }
    };

    // ===== EMPLOYEE CRUD =====
    const addEmployee = async (employeeData: Omit<Employee, 'id'>) => {
        const newEmployee: Employee = {
            ...employeeData,
            id: `emp-${Date.now()}`,
        };

        setEmployees(prev => [...prev, newEmployee]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/employees`), newEmployee);
            } catch (error) {
                console.error('Error adding employee:', error);
            }
        }
    };

    const updateEmployee = async (id: string, employeeData: Partial<Employee>) => {
        setEmployees(prev =>
            prev.map(e => (e.id === id ? { ...e, ...employeeData } : e))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/employees`, id), employeeData);
            } catch (error) {
                console.error('Error updating employee:', error);
            }
        }
    };

    const deleteEmployee = async (id: string) => {
        setEmployees(prev => prev.filter(e => e.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/employees`, id));
            } catch (error) {
                console.error('Error deleting employee:', error);
            }
        }
    };

    // Asset CRUD
    const addAsset = async (assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newAsset: Asset = {
            ...assetData,
            id: `asset-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        setAssets(prev => [...prev, newAsset]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/assets`), newAsset);
            } catch (error) {
                console.error('Error adding asset:', error);
            }
        }
    };

    const updateAsset = async (id: string, assetData: Partial<Asset>) => {
        setAssets(prev =>
            prev.map(a => (a.id === id ? { ...a, ...assetData, updatedAt: new Date() } : a))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/assets`, id), { ...assetData, updatedAt: new Date() });
            } catch (error) {
                console.error('Error updating asset:', error);
            }
        }
    };

    const deleteAsset = async (id: string) => {
        setAssets(prev => prev.filter(a => a.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/assets`, id));
            } catch (error) {
                console.error('Error deleting asset:', error);
            }
        }
    };

    // Supplier CRUD
    const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newSupplier: Supplier = {
            ...supplierData,
            id: `supplier-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        setSuppliers(prev => [...prev, newSupplier]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/suppliers`), newSupplier);
            } catch (error) {
                console.error('Error adding supplier:', error);
            }
        }
    };

    const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
        setSuppliers(prev =>
            prev.map(s => (s.id === id ? { ...s, ...supplierData, updatedAt: new Date() } : s))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/suppliers`, id), { ...supplierData, updatedAt: new Date() });
            } catch (error) {
                console.error('Error updating supplier:', error);
            }
        }
    };

    const deleteSupplier = async (id: string) => {
        setSuppliers(prev => prev.filter(s => s.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/suppliers`, id));
            } catch (error) {
                console.error('Error deleting supplier:', error);
            }
        }
    };

    // Invoice CRUD
    const addInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt'>) => {
        const newInvoice: Invoice = {
            ...invoiceData,
            id: `invoice-${Date.now()}`,
            createdAt: new Date()
        };
        setInvoices(prev => [...prev, newInvoice]);

        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/invoices`), newInvoice);
            } catch (error) {
                console.error('Error adding invoice:', error);
            }
        }
    };

    const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
        setInvoices(prev =>
            prev.map(i => (i.id === id ? { ...i, ...invoiceData } : i))
        );

        if (user) {
            const businessId = 'demo';
            try {
                await updateDoc(doc(db, `businesses/${businessId}/invoices`, id), invoiceData);
            } catch (error) {
                console.error('Error updating invoice:', error);
            }
        }
    };

    const deleteInvoice = async (id: string) => {
        setInvoices(prev => prev.filter(i => i.id !== id));

        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/invoices`, id));
            } catch (error) {
                console.error('Error deleting invoice:', error);
            }
        }
    };

    // ===== ORDER CRUD =====
    const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newOrder: Order = {
            ...orderData,
            id: `order-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setOrders(prev => [...prev, newOrder]);
        if (user) {
            const businessId = 'demo';
            try {
                await addDoc(collection(db, `businesses/${businessId}/orders`), newOrder);
            } catch (error) {
                console.error('Error adding order:', error);
            }
        }
    };

    const updateOrderStatus = async (id: string, status: Order['status']) => {
        setOrders(prev =>
            prev.map(order =>
                order.id === id ? { ...order, status, updatedAt: new Date() } : order
            )
        );
        if (user) {
            const businessId = 'demo';
            try {
                const orderRef = doc(db, `businesses/${businessId}/orders`, id);
                await updateDoc(orderRef, { status, updatedAt: new Date() });
            } catch (error) {
                console.error('Error updating order status:', error);
            }
        }
    };

    const completeOrder = async (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;
        setOrders(prev =>
            prev.map(o => o.id === id ? { ...o, status: 'completed' as const, updatedAt: new Date() } : o)
        );
        order.items.forEach(item => {
            setProducts(prev =>
                prev.map(product =>
                    product.id === item.productId
                        ? { ...product, stock: product.stock - item.quantity, updatedAt: new Date() }
                        : product
                )
            );
        });
        if (user) {
            const businessId = 'demo';
            try {
                const orderRef = doc(db, `businesses/${businessId}/orders`, id);
                await updateDoc(orderRef, { status: 'completed', updatedAt: new Date() });
                for (const item of order.items) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        const productRef = doc(db, `businesses/${businessId}/products`, item.productId);
                        await updateDoc(productRef, { stock: product.stock - item.quantity, updatedAt: new Date() });
                    }
                }
            } catch (error) {
                console.error('Error completing order:', error);
            }
        }
    };

    const deleteOrder = async (id: string) => {
        setOrders(prev => prev.filter(order => order.id !== id));
        if (user) {
            const businessId = 'demo';
            try {
                await deleteDoc(doc(db, `businesses/${businessId}/orders`, id));
            } catch (error) {
                console.error('Error deleting order:', error);
            }
        }
    };

    const value: DataContextType = {
        products,
        sales,
        expenses,
        clients,
        employees,
        assets,
        suppliers,
        invoices,
        kpiMetrics,
        loading,
        addProduct,
        updateProduct,
        deleteProduct,
        addSale,
        updateSale,
        deleteSale,
        addExpense,
        updateExpense,
        deleteExpense,
        addClient,
        updateClient,
        deleteClient,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addAsset,
        updateAsset,
        deleteAsset,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        orders,
        addOrder,
        updateOrderStatus,
        completeOrder,
        deleteOrder,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
