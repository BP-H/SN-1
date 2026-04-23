import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Link as LinkIcon, Pencil } from 'lucide-react';

export const Profile: React.FC = () => {
    const { user } = useAuth();
    const [networkStats, setNetworkStats] = React.useState({ views: 0, impressions: 0 });

    React.useEffect(() => {
        // Simulate fetching network stats or use real API if available
        // For now, we'll just use random numbers or 0 if we want to be strict
        setNetworkStats({
            views: Math.floor(Math.random() * 50),
            impressions: Math.floor(Math.random() * 200)
        });
    }, []);

    return (
        <div className="pb-4">
            {/* Banner & Header Card */}
            <div className="bg-white mb-2 pb-4 relative">
                {/* Banner */}
                <div className="h-24 bg-gradient-to-r from-blue-700 to-cyan-500 relative">
                    <button className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                        <Pencil size={16} />
                    </button>
                </div>

                {/* Avatar */}
                <div className="px-4 relative">
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 overflow-hidden absolute -top-12">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-3xl">
                                {user?.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end pt-3">
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                            <Pencil size={20} />
                        </button>
                    </div>
                </div>

                {/* Info */}
                <div className="px-4 mt-2">
                    <h1 className="text-2xl font-semibold text-professional-text-primary leading-tight">
                        {user?.username || "Supernova Citizen"}
                    </h1>
                    <p className="text-professional-text-primary mt-1 text-base leading-snug">
                        {user?.species ? `${user.species} Explorer` : 'Traveler'} | Harmony Score: {user?.harmony_score || 0}
                    </p>

                    <div className="flex items-center gap-1 text-professional-text-secondary text-sm mt-2">
                        <MapPin size={16} />
                        <span>Supernova 2177</span>
                        <span className="text-professional-blue font-semibold ml-1">Contact info</span>
                    </div>

                    <div className="flex items-center gap-1 text-professional-blue font-semibold text-sm mt-2">
                        <LinkIcon size={16} />
                        <span>supernova.net/{user?.username}</span>
                    </div>

                    <div className="mt-3 text-professional-blue font-semibold text-sm">
                        {user?.network_centrality || 0} connections
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button className="flex-1 bg-professional-blue text-white font-semibold py-1.5 rounded-full hover:bg-professional-dark-blue transition-colors">
                            Open to
                        </button>
                        <button className="flex-1 border border-professional-blue text-professional-blue font-semibold py-1.5 rounded-full hover:bg-blue-50 transition-colors">
                            Add section
                        </button>
                    </div>
                </div>
            </div>

            {/* Analytics Card */}
            <div className="bg-white mb-2 p-4">
                <h2 className="text-lg font-semibold text-professional-text-primary mb-1">Analytics</h2>
                <div className="flex items-center gap-2 text-professional-text-secondary text-sm mb-4">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-500 rounded-full flex items-center justify-center text-[8px] text-white">👁️</span> Private to you</span>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1 flex gap-2">
                        <div className="mt-1"><UsersIcon /></div>
                        <div>
                            <div className="font-semibold text-professional-text-primary">{networkStats.views} profile views</div>
                            <div className="text-xs text-professional-text-secondary">Discover who's viewed your profile.</div>
                        </div>
                    </div>
                    <div className="flex-1 flex gap-2">
                        <div className="mt-1"><BarChartIcon /></div>
                        <div>
                            <div className="font-semibold text-professional-text-primary">{networkStats.impressions} post impressions</div>
                            <div className="text-xs text-professional-text-secondary">Check out who's engaging with your posts.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* About Card */}
            <div className="bg-white mb-2 p-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-professional-text-primary">About</h2>
                    <button><Pencil size={20} className="text-gray-600" /></button>
                </div>
                <p className="text-sm text-professional-text-primary leading-relaxed">
                    {user?.bio || `A ${user?.species || 'traveler'} navigating the cosmos of Supernova 2177.`}
                </p>
            </div>
        </div>
    );
};

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const BarChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>
);
