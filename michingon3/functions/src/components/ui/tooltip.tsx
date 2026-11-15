"use client"

import * as React from "react"

const TooltipContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | undefined>(undefined)

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

export const Tooltip = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)
    return (
        <TooltipContext.Provider value={{ open, setOpen }}>
            <div className="relative flex items-center" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
                {children}
            </div>
        </TooltipContext.Provider>
    )
}

export const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    return <>{children}</>
}

export const TooltipContent = ({ children }: { children: React.ReactNode }) => {
    const context = React.useContext(TooltipContext)
    if (!context?.open) return null

    return (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95">
            {children}
            {/* Arrow */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
        </div>
    )
}
