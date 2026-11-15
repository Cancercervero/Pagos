'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';

export type Period = 'hoy' | 'semana' | 'mes' | 'año' | 'custom';

interface DateFilterContextType {
    startDate: Date;
    endDate: Date;
    period: Period;
    setDateRange: (start: Date, end: Date, period: Period) => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: ReactNode }) {
    // Por defecto: Este Mes
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(endOfMonth(new Date()));
    const [period, setPeriod] = useState<Period>('mes');

    const setDateRange = (start: Date, end: Date, newPeriod: Period) => {
        setStartDate(start);
        setEndDate(end);
        setPeriod(newPeriod);
    };

    return (
        <DateFilterContext.Provider value={{ startDate, endDate, period, setDateRange }}>
            {children}
        </DateFilterContext.Provider>
    );
}

export function useDateFilter() {
    const context = useContext(DateFilterContext);
    if (context === undefined) {
        throw new Error('useDateFilter must be used within a DateFilterProvider');
    }
    return context;
}
