import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, PlusSquare, Bell, Briefcase } from 'lucide-react';
import clsx from 'clsx';

export const BottomNav: React.FC = () => {
    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/network', label: 'My Network', icon: Users },
        { path: '/post', label: 'Post', icon: PlusSquare, isPost: true },
        { path: '/notifications', label: 'Notifications', icon: Bell },
        { path: '/jobs', label: 'Jobs', icon: Briefcase },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-1 pt-1 z-50">
            <ul className="flex justify-between items-center max-w-md mx-auto">
                {navItems.map((item) => (
                    <li key={item.label} className="flex-1">
                        <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                                clsx(
                                    "flex flex-col items-center justify-center py-1 gap-0.5",
                                    isActive && !item.isPost ? "text-black" : "text-gray-500",
                                    item.isPost && "text-gray-500"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon
                                        size={24}
                                        fill={isActive && !item.isPost ? "currentColor" : "none"}
                                        strokeWidth={isActive && !item.isPost ? 0 : 1.5}
                                    />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
};
