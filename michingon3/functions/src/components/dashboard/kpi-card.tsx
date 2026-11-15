'use client';

import { ArrowUpRight, ArrowDownRight, MoreHorizontal, TrendingUp } from 'lucide-react';
import { ReactNode } from 'react';

interface KpiCardProps {
    title: string;
    value: string;
    icon: ReactNode;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    onClick?: () => void;
    className?: string;
}

export function KpiCard({ title, value, icon, trend, onClick, className }: KpiCardProps) {
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-teal-500/30' : ''
                } ${className}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                    {icon}
                </div>
                {onClick && (
                    <div className="text-gray-400">
                        <MoreHorizontal className="w-5 h-5" />
                    </div>
                )}
            </div>

            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            </div>

            {trend && (
                <div className="mt-4 flex items-center gap-2">
                    <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trend.isPositive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {trend.isPositive ? (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                        ) : (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                        )}
                        {trend.value}
                    </div>
                    <span className="text-xs text-gray-400">vs mes anterior</span>
                </div>
            )}
        </div>
    );
}
