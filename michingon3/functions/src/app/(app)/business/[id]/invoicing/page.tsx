'use client';

import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Camera,
    Upload,
    Search,
    Calendar as CalendarIcon
} from 'lucide-react';
import { Invoice } from '@/types/business';

import { scanInvoice } from '@/app/actions/scan-actions';
import { CameraModal } from '@/components/ui/camera-modal';

export default function InvoicingPage() {
    const { invoices } = useData();
    const { startDate, endDate, setDateRange, period } = useDateFilter();

    // Local state for UI interactions
    const [activeTab, setActiveTab] = useState<'emitidas' | 'gastos'>('emitidas');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showScanModal, setShowScanModal] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState<any>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCamera, setShowCamera] = useState(false);

    // Calendar visual state (for the side calendar navigation)
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Filter invoices based on global date range
    const filteredInvoices = invoices.filter(inv =>
        isWithinInterval(new Date(inv.date), { start: startOfDay(startDate), end: endOfDay(endDate) })
    );

    const issuedInvoices = filteredInvoices.filter(inv => inv.type === 'issued');
    const expenseInvoices = filteredInvoices.filter(inv => inv.type === 'expense');

    // Calendar Logic for Side Panel
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const startingDayIndex = getDay(firstDayOfMonth);
    const adjustedStartingDayIndex = startingDayIndex === 0 ? 6 : startingDayIndex - 1;
    const paddingDays = Array.from({ length: adjustedStartingDayIndex });
    const weekDays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const handleDateClick = (date: Date) => {
        setDateRange(date, date, 'custom');
    };

    const filteredExpenses = expenseInvoices.filter(exp =>
        (exp.products?.[0]?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        setIsScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await scanInvoice(formData);

            if (result.success && result.data) {
                setScannedData(result.data);
            } else {
                alert('Error al escanear la factura');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la imagen');
        } finally {
            setIsScanning(false);
        }
    };

    const selectedInvoiceData = selectedInvoice || issuedInvoices[0];
    const subtotal = selectedInvoiceData?.products?.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0) || 0;
    const totalIVA = selectedInvoiceData?.products?.reduce((sum, p) => sum + p.iva, 0) || 0;

    const getDateLabel = () => {
        if (period === 'custom' && isSameDay(startDate, endDate)) {
            return format(startDate, 'd \'de\' MMMM \'de\' yyyy', { locale: es });
        }
        if (period === 'mes') {
            return `Todo el mes de ${format(startDate, 'MMMM', { locale: es })}`;
        }
        return `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM')}`;
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Panel: Calendar */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Calendario</h2>
                    <p className="text-sm text-gray-500 mb-6">Selecciona un día o usa el filtro superior.</p>

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-medium text-gray-900 capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: es })}
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full transition">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full transition">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-2 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {paddingDays.map((_, i) => (
                            <div key={`padding-${i}`} />
                        ))}

                        {daysInMonth.map((day) => {
                            const isToday = isSameDay(day, new Date());
                            // Check if day is within the selected global range
                            const isSelected = isWithinInterval(day, { start: startOfDay(startDate), end: endOfDay(endDate) });

                            // Check if there are invoices for this day (from all invoices, not just filtered)
                            const hasInvoices = invoices.some(inv => isSameDay(new Date(inv.date), day));

                            return (
                                <button
                                    key={day.toString()}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                    h-10 w-full flex items-center justify-center rounded text-sm transition relative
                    ${isSelected ? 'bg-teal-500 text-white font-bold' :
                                            isToday ? 'bg-teal-100 text-teal-700 font-bold' :
                                                'hover:bg-gray-100 text-gray-700'}
                  `}
                                >
                                    {format(day, 'd')}
                                    {hasInvoices && !isSelected && (
                                        <div className="absolute bottom-1 w-1 h-1 bg-teal-500 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Invoices */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('emitidas')}
                                className={`flex-1 px-6 py-3 text-sm font-medium transition ${activeTab === 'emitidas'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Facturas Emitidas
                            </button>
                            <button
                                onClick={() => setActiveTab('gastos')}
                                className={`flex-1 px-6 py-3 text-sm font-medium transition ${activeTab === 'gastos'
                                    ? 'text-teal-600 border-b-2 border-teal-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Facturas de Gastos
                            </button>
                        </div>

                        <div className="p-6">
                            {activeTab === 'emitidas' && (
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-2">Facturas Emitidas</h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Mostrando facturas: {getDateLabel()}
                                    </p>

                                    {issuedInvoices.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No hay facturas emitidas en este período.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Cliente / Folio</th>
                                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Monto</th>
                                                        <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Estado</th>
                                                        <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {issuedInvoices.map((invoice) => (
                                                        <tr key={invoice.id} className="hover:bg-gray-50">
                                                            <td className="py-3 px-2">
                                                                <div className="text-sm font-medium text-gray-900">{invoice.clientName}</div>
                                                                <div className="text-xs text-gray-500">{invoice.folio}</div>
                                                            </td>
                                                            <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">
                                                                {formatCurrency(invoice.amount)}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                                                    {invoice.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                <button
                                                                    onClick={() => setSelectedInvoice(invoice)}
                                                                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    Ver
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'gastos' && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-2">Facturas de Gastos</h3>
                                            <p className="text-sm text-gray-500">
                                                Mostrando gastos: {getDateLabel()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowScanModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                                        >
                                            <Camera className="w-4 h-4" />
                                            Escanear Factura
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por proveedor o descripción..."
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {filteredExpenses.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No hay facturas de gastos en este período.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Descripción</th>
                                                        <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Monto</th>
                                                        <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Estado</th>
                                                        <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredExpenses.map((expense) => (
                                                        <tr key={expense.id} className="hover:bg-gray-50">
                                                            <td className="py-3 px-2">
                                                                <div className="text-sm font-medium text-gray-900">{expense.products?.[0]?.name || 'Gasto General'}</div>
                                                                <div className="text-xs text-gray-500">{expense.supplierName || 'Proveedor Desconocido'}</div>
                                                            </td>
                                                            <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">
                                                                {formatCurrency(expense.amount)}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                <div className="relative inline-block">
                                                                    <select
                                                                        value={expense.status}
                                                                        className={`appearance-none px-3 py-1 pr-8 rounded text-xs font-medium border-0 cursor-pointer ${expense.status === 'Pagado'
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : 'bg-yellow-100 text-yellow-700'
                                                                            }`}
                                                                    >
                                                                        <option value="Pagado">✓ Pagado</option>
                                                                        <option value="Pendiente">○ Pendiente</option>
                                                                    </select>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                <button className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700">
                                                                    <Eye className="w-4 h-4" />
                                                                    Ver
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Factura de Venta General</h2>
                                <p className="text-sm text-gray-500">
                                    Factura para el {format(selectedInvoice.date, 'd \'de\' MMMM \'de\' yyyy', { locale: es })}.
                                </p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-3 gap-6 mb-6">
                                <div className="col-span-2">
                                    <div className="mb-4">
                                        <h3 className="text-sm font-medium text-gray-500 mb-1">Emisor:</h3>
                                        <p className="text-base font-bold text-teal-600">Carnicería "La Superior"</p>
                                        <p className="text-sm text-gray-600">SUMI5201XYZ</p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 mb-1">Cliente:</h3>
                                        <p className="text-base font-bold text-gray-900">{selectedInvoice.clientName}</p>
                                        <p className="text-sm text-gray-600">{selectedInvoice.folio}</p>
                                        <p className="text-sm text-gray-600">N/A</p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center border border-gray-200 rounded-lg p-4">
                                    <div className="text-center mb-2">
                                        <p className="text-xs font-medium text-gray-500 mb-1">Factura</p>
                                        <p className="text-xs text-gray-600">Folio Interno: {selectedInvoice.folio}</p>
                                        <p className="text-xs text-gray-600">Fecha: {format(selectedInvoice.date, 'd \'de\' MMMM \'de\' yyyy', { locale: es })}</p>
                                    </div>
                                    <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                                        <div className="text-xs text-gray-400 text-center">QR Code</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Producto</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Producto</th>
                                                <th className="text-center text-xs font-medium text-gray-500 uppercase py-2">Cant.</th>
                                                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">P. Unit.</th>
                                                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">IVA</th>
                                                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoiceData?.products?.map((product, i) => (
                                                <tr key={i} className="border-b border-gray-100">
                                                    <td className="py-2 text-sm text-gray-900">
                                                        <div>{product.name}</div>
                                                        <div className="text-xs text-gray-500">Clave SAT: 50121503</div>
                                                    </td>
                                                    <td className="py-2 text-sm text-gray-600 text-center">{product.quantity.toFixed(2)}</td>
                                                    <td className="py-2 text-sm text-gray-600 text-right">{formatCurrency(product.unitPrice)}</td>
                                                    <td className="py-2 text-sm text-gray-600 text-right">{formatCurrency(product.iva)}</td>
                                                    <td className="py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(product.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-end mb-6">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">IVA (16%)</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(totalIVA)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                                        <span className="text-gray-900">Total</span>
                                        <span className="text-teal-600">{formatCurrency(selectedInvoice.amount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
                                <h4 className="font-medium text-gray-900 mb-2">Datos Fiscales del CFDI (Simulado)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="font-medium">Folio Fiscal (UUID):</span> {selectedInvoice.fiscalUUID}</div>
                                    <div><span className="font-medium">Fecha de Certificación:</span> {format(selectedInvoice.date, 'dd/MM/yyyy HH:mm:ss')}</div>
                                    <div><span className="font-medium">SAT:</span> ...</div>
                                    <div><span className="font-medium">Sello del SAT:</span> ...</div>
                                    <div className="col-span-2"><span className="font-medium">Cadena Original del Timbre:</span> ||1.1||{selectedInvoice.fiscalUUID}||...</div>
                                </div>
                                <p className="mt-3 text-center text-xs">
                                    Datos para QR del Proveedor SAT
                                </p>
                                <p className="mt-2 text-center text-xs italic">
                                    Esto es un documento simulado para fines de control interno. No tiene validez fiscal real. Compruébalo Fiscal Digital (CFDI)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Invoice Modal */}
            {showScanModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Escanear Factura</h2>
                                <p className="text-sm text-gray-500">Sube una foto o toma una captura. La IA leerá los datos y pre-llenará el formulario de gastos por ti.</p>
                            </div>
                            <button onClick={() => setShowScanModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-3">
                            {isScanning ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
                                    <p className="text-lg font-medium text-gray-900">Analizando Factura...</p>
                                    <p className="text-sm text-gray-500">La IA está extrayendo los datos</p>
                                </div>
                            ) : scannedData ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        {previewUrl && (
                                            <div className="mb-4 flex justify-center">
                                                <img src={previewUrl} alt="Factura escaneada" className="max-h-48 rounded shadow-sm" />
                                            </div>
                                        )}
                                        <h3 className="font-bold text-green-800 mb-2">¡Datos Extraídos!</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><span className="font-medium">Proveedor:</span> {scannedData.supplierName}</div>
                                            <div><span className="font-medium">Total:</span> {formatCurrency(scannedData.total)}</div>
                                            <div><span className="font-medium">Fecha:</span> {scannedData.date}</div>
                                            <div><span className="font-medium">Folio:</span> {scannedData.folio}</div>
                                        </div>
                                        {scannedData.items && (
                                            <div className="mt-2">
                                                <p className="font-medium text-xs text-green-700 mb-1">Conceptos:</p>
                                                <ul className="list-disc list-inside text-xs text-green-800">
                                                    {scannedData.items.map((item: any, i: number) => (
                                                        <li key={i}>{item.quantity}x {item.description} - {formatCurrency(item.total)}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setScannedData(null);
                                                setPreviewUrl(null);
                                            }}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                        >
                                            Escanear Otra
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowScanModal(false);
                                                setScannedData(null);
                                                setPreviewUrl(null);
                                                alert('Factura guardada correctamente (Simulado)');
                                            }}
                                            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                        >
                                            Confirmar y Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => document.getElementById('invoice-upload-input')?.click()}
                                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition cursor-pointer text-left group"
                                    >
                                        <div className="p-3 bg-gray-100 rounded-full group-hover:bg-teal-100 transition">
                                            <Upload className="w-6 h-6 text-gray-600 group-hover:text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Subir imagen de Factura</p>
                                            <p className="text-xs text-gray-500">Selecciona un archivo de tu dispositivo</p>
                                        </div>
                                    </button>
                                    <input
                                        id="invoice-upload-input"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleScan}
                                        aria-label="Subir imagen de factura"
                                    />

                                    <button
                                        onClick={() => setShowCamera(true)}
                                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition cursor-pointer text-left group"
                                    >
                                        <div className="p-3 bg-gray-100 rounded-full group-hover:bg-teal-100 transition">
                                            <Camera className="w-6 h-6 text-gray-600 group-hover:text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Tomar Foto con Cámara</p>
                                            <p className="text-xs text-gray-500">Usa tu cámara web o móvil</p>
                                        </div>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Camera Modal */}
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={(file) => {
                    // Create a fake event to reuse handleScan logic
                    const event = {
                        target: {
                            files: [file]
                        }
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleScan(event);
                }}
            />
        </div>
    );
}
