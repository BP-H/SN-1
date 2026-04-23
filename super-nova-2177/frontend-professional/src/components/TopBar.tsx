import React from 'react';
import { Search, MessageSquareMore } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const TopBar: React.FC = () => {
    const { user } = useAuth();

    return (
        <header className="fixed top-0 left-0 right-0 bg-white px-4 py-2 flex items-center gap-4 z-50 shadow-sm">
            {/* Profile Avatar */}
            <Link to="/profile" className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xs">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                )}
            </Link>

            {/* Search Bar */}
            <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-500" />
                </div>
                <input
                    type="text"
                    placeholder="Search"
                    className="w-full bg-[#eef3f8] text-sm rounded-md pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-black/50 transition-all placeholder-gray-500 font-light"
                />
            </div>

            {/* Message Icon */}
            <button className="text-gray-600 relative">
                <MessageSquareMore size={24} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">
                    3
                </span>
            </button>
        </header>
    );
};
