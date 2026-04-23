import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export const MobileLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#f3f2ef] pb-16 pt-14">
            <TopBar />
            <main className="max-w-md mx-auto">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
};
