'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addMonths,
    subMonths,
    getDay,
    startOfWeek,
    endOfWeek,
    startOfYear,
    endOfYear,
    isSameDay,
    isWithinInterval,
    subDays,
    subWeeks,
    subMonths as subMonthsFn,
    isAfter
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useDateFilter, Period } from '@/contexts/DateFilterContext';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function CalendarWidget() {
    const { startDate, endDate, period, setDateRange } = useDateFilter();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selecting, setSelecting] = useState(false);
    const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [open, setOpen] = useState(false);

    // Sincronizar el mes visible con la fecha seleccionada al abrir
    useEffect(() => {
        if (open) {
            setCurrentMonth(startDate);
        }
    }, [open, startDate]);

    const handlePresetSelect = (preset: Period | 'ayer' | 'semana_pasada' | 'mes_pasado') => {
        const today = new Date();
        let newStart: Date, newEnd: Date;
        let newPeriod: Period = 'custom';

        switch (preset) {
            case 'hoy':
                newStart = newEnd = today;
                newPeriod = 'hoy';
                break;
            case 'ayer':
                newStart = newEnd = subDays(today, 1);
                newPeriod = 'custom';
                break;
            case 'semana':
                newStart = startOfWeek(today, { locale: es });
                newEnd = endOfWeek(today, { locale: es });
                newPeriod = 'semana';
                break;
            case 'semana_pasada':
                const lastWeek = subWeeks(today, 1);
                newStart = startOfWeek(lastWeek, { locale: es });
                newEnd = endOfWeek(lastWeek, { locale: es });
                newPeriod = 'custom';
                break;
            case 'mes':
                newStart = startOfMonth(today);
                newEnd = endOfMonth(today);
                newPeriod = 'mes';
                break;
            case 'mes_pasado':
                const lastMonth = subMonthsFn(today, 1);
                newStart = startOfMonth(lastMonth);
                newEnd = endOfMonth(lastMonth);
                newPeriod = 'custom';
                break;
            case 'año':
                newStart = startOfYear(today);
                newEnd = endOfYear(today);
                newPeriod = 'año';
                break;
            default:
                return;
        }

        setDateRange(newStart, newEnd, newPeriod);
        setOpen(false);
        setSelecting(false);
        setTempStartDate(null);
    };

    const handleDateClick = (date: Date) => {
        if (!selecting) {
            setSelecting(true);
            setTempStartDate(date);
        } else {
            if (tempStartDate) {
                let start = tempStartDate;
                let end = date;
                if (isAfter(start, end)) {
                    [start, end] = [end, start];
                }
                setDateRange(start, end, 'custom');
                setSelecting(false);
                setTempStartDate(null);
                setOpen(false);
            }
        }
    };

    const handleMouseEnter = (date: Date) => {
        if (selecting) {
            setHoverDate(date);
        }
    };

    const prevMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const nextMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const startingDayIndex = getDay(firstDayOfMonth);
    const adjustedStartingDayIndex = startingDayIndex === 0 ? 6 : startingDayIndex - 1;
    const paddingDays = Array.from({ length: adjustedStartingDayIndex });
    const weekDays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

    const getDayClass = (day: Date) => {
        const isToday = isSameDay(day, new Date());
        let isSelected = false;
        let isInRange = false;

        if (selecting && tempStartDate && hoverDate) {
            let start = tempStartDate;
            let end = hoverDate;
            if (isAfter(start, end)) [start, end] = [end, start];
            isSelected = isSameDay(day, start) || isSameDay(day, end);
            isInRange = isWithinInterval(day, { start, end });
        } else {
            isSelected = isSameDay(day, startDate) || isSameDay(day, endDate);
            isInRange = isWithinInterval(day, { start: startDate, end: endDate });
        }

        let baseClass = "h-9 w-full flex items-center justify-center text-sm transition relative z-10 cursor-pointer ";

        if (isSelected) return baseClass + "bg-teal-600 text-white font-bold rounded-md shadow-sm";
        if (isInRange) return baseClass + "bg-teal-50 text-teal-900 rounded-none";
        if (isToday) return baseClass + "text-teal-600 font-bold hover:bg-gray-100 rounded-md";

        return baseClass + "text-gray-700 hover:bg-gray-100 rounded-md";
    };

    const getPeriodLabel = () => {
        if (period === 'custom') {
            if (isSameDay(startDate, endDate)) {
                return format(startDate, 'd MMM yyyy', { locale: es });
            }
            return `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM, yyyy')}`;
        }
        switch (period) {
            case 'hoy': return 'Hoy';
            case 'semana': return 'Esta Semana';
            case 'mes': return 'Este Mes';
            case 'año': return 'Este Año';
            default: return 'Personalizado';
        }
    };

    return (
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
            <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm outline-none focus:ring-2 focus:ring-teal-500">
                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 capitalize">{getPeriodLabel()}</span>
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-[1000] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col md:flex-row w-[320px] md:w-[550px] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                    align="end"
                    sideOffset={5}
                >
                    {/* Sidebar Presets */}
                    <div className="bg-gray-50 p-4 border-b md:border-b-0 md:border-r border-gray-200 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible min-w-[140px]">
                        {[
                            { label: 'Hoy', value: 'hoy' },
                            { label: 'Ayer', value: 'ayer' },
                            { label: 'Esta Semana', value: 'semana' },
                            { label: 'Semana Pasada', value: 'semana_pasada' },
                            { label: 'Este Mes', value: 'mes' },
                            { label: 'Mes Pasado', value: 'mes_pasado' },
                            { label: 'Este Año', value: 'año' },
                        ].map((preset) => (
                            <button
                                key={preset.value}
                                onClick={() => handlePresetSelect(preset.value as any)}
                                className={`px-3 py-2 text-sm font-medium rounded-lg text-left transition whitespace-nowrap ${(period === preset.value) || (period === 'custom' && preset.value === 'custom')
                                        ? 'bg-white text-teal-600 shadow-sm border border-gray-200'
                                        : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendar Area */}
                    <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-gray-900">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-base font-semibold text-gray-900 capitalize">
                                {format(currentMonth, 'MMMM yyyy', { locale: es })}
                            </h3>
                            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-gray-900">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        <div>
                            <div className="grid grid-cols-7 mb-2">
                                {weekDays.map((day) => (
                                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-2 uppercase tracking-wider">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-y-1">
                                {paddingDays.map((_, i) => <div key={`padding-${i}`} className="h-9" />)}
                                {daysInMonth.map((day) => (
                                    <button
                                        key={day.toString()}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleDateClick(day);
                                        }}
                                        onMouseEnter={() => handleMouseEnter(day)}
                                        className={getDayClass(day)}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                            <span>{selecting ? "Selecciona fecha final" : "Haz clic para seleccionar rango"}</span>
                            {selecting && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setSelecting(false);
                                        setTempStartDate(null);
                                    }}
                                    className="text-red-500 hover:text-red-700 font-medium"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
