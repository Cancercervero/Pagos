'use client';

import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { logOut } from '@/lib/firebase/auth';
import { useState, useEffect } from 'react';
import { DateFilterProvider } from '@/contexts/DateFilterContext';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { TutorialOverlay } from '@/components/onboarding/tutorial-overlay';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { Sidebar } from '@/components/dashboard/sidebar';

export default function BusinessLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { id: string };
}) {
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialChecked, setTutorialChecked] = useState(false);

    // Check if tutorial should be shown (new business after onboarding)
    useEffect(() => {
        const checkTutorialStatus = async () => {
            try {
                const businessDoc = await getDoc(doc(db, 'businesses', params.id));
                if (businessDoc.exists()) {
                    const data = businessDoc.data();
                    // Show tutorial if onboarding is complete but tutorial is not
                    if (data.onboardingCompleted && !data.tutorialCompleted) {
                        setShowTutorial(true);
                    }
                }
            } catch (err) {
                console.error('Error checking tutorial status:', err);
            } finally {
                setTutorialChecked(true);
            }
        };
        checkTutorialStatus();
    }, [params.id]);

    const handleTutorialComplete = async () => {
        try {
            await updateDoc(doc(db, 'businesses', params.id), {
                tutorialCompleted: true
            });
        } catch (err) {
            console.error('Error updating tutorial status:', err);
        }
        setShowTutorial(false);
    };

    const handleTutorialSkip = async () => {
        try {
            await updateDoc(doc(db, 'businesses', params.id), {
                tutorialCompleted: true
            });
        } catch (err) {
            console.error('Error updating tutorial status:', err);
        }
        setShowTutorial(false);
    };

    return (
        <DateFilterProvider>
            <div className="min-h-screen bg-gray-50 flex">
                {/* Sidebar */}
                <Sidebar businessId={params.id} />

                {/* Main content */}
                <main className="ml-64 flex-1 flex flex-col">
                    <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                        <DashboardHeader />
                    </header>
                    <div className="flex-1">
                        {children}
                    </div>
                </main>

                {/* Tutorial Overlay - shows after onboarding */}
                {showTutorial && tutorialChecked && (
                    <TutorialOverlay
                        onComplete={handleTutorialComplete}
                        onSkip={handleTutorialSkip}
                    />
                )}
            </div>
        </DateFilterProvider>
    );
}
