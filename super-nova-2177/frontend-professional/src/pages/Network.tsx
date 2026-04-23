import React from 'react';
import { UserPlus, ChevronRight } from 'lucide-react';

export const Network: React.FC = () => {
    const connections = [
        { id: 1, name: "Sarah Johnson", role: "Product Manager at Google", mutual: 12 },
        { id: 2, name: "Michael Chen", role: "Senior Developer at Amazon", mutual: 5 },
        { id: 3, name: "Emily Davis", role: "UX Designer at Apple", mutual: 8 },
        { id: 4, name: "David Wilson", role: "Data Scientist at Meta", mutual: 3 },
    ];

    return (
        <div className="pb-4">
            <div className="bg-white mb-2 px-4 py-3 flex justify-between items-center">
                <h2 className="text-base font-semibold text-professional-text-primary">Manage my network</h2>
                <ChevronRight size={20} className="text-gray-500" />
            </div>

            <div className="bg-white mb-2 p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-professional-text-primary">Invitations (2)</h2>
                    <button className="text-professional-text-secondary font-semibold text-sm">Show all</button>
                </div>
                {/* Mock Invitations */}
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                            <div className="flex-1">
                                <div className="font-semibold text-sm">Recruiter Name</div>
                                <div className="text-xs text-gray-500">Talent Acquisition</div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center text-gray-500">X</button>
                                <button className="w-8 h-8 rounded-full border border-professional-blue flex items-center justify-center text-professional-blue">✓</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-4">
                <h2 className="text-base font-semibold text-professional-text-primary mb-4">People you may know</h2>
                <div className="grid grid-cols-2 gap-3">
                    {connections.map(conn => (
                        <div key={conn.id} className="border border-gray-200 rounded-lg overflow-hidden flex flex-col items-center pb-3 relative">
                            <button className="absolute top-2 right-2 text-gray-500 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs">X</button>
                            <div className="w-full h-14 bg-gray-100 mb-[-28px]"></div>
                            <div className="w-16 h-16 rounded-full bg-gray-300 border-2 border-white z-10 overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${conn.name}`} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-center px-2 mt-2 flex-1">
                                <div className="font-semibold text-sm truncate w-full">{conn.name}</div>
                                <div className="text-xs text-gray-500 line-clamp-2 h-8 leading-tight mt-0.5">{conn.role}</div>
                                <div className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
                                    <span className="text-[10px]">👥</span> {conn.mutual} mutual connections
                                </div>
                            </div>
                            <button className="mt-3 mx-3 w-[calc(100%-24px)] border border-professional-blue text-professional-blue font-semibold py-1 rounded-full text-sm hover:bg-blue-50 flex items-center justify-center gap-1">
                                <UserPlus size={16} /> Connect
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
