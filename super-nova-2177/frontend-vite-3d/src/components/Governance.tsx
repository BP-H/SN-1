
import React, { useState, useEffect } from 'react';
import { Proposal } from '../types';
import { GovernancePostCard } from './GovernancePostCard';
import { Search, Filter as FilterIcon, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export const Governance: React.FC = () => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const filters = ['All', 'Latest', 'Top Liked', 'Popular', 'AI', 'Human'];

    useEffect(() => {
        const fetchProposals = async () => {
            setLoading(true);
            try {
                const data = await api.getProposals(filter, search);
                setProposals(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch proposals", error);
                setProposals([]);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchProposals();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [filter, search]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-orbitron font-bold text-white tracking-wider flex items-center gap-2">
                    <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                    Governance_Layer
                </h2>

                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-gray-500 group-focus-within:text-nova-cyan transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search protocols..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-black/40 border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-nova-cyan w-full md:w-64 transition-all"
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center gap-2 bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 hover:border-nova-cyan transition-all w-full md:w-auto justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <FilterIcon size={16} className="text-nova-purple" />
                                <span>{filter}</span>
                            </div>
                            <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-xl shadow-xl backdrop-blur-xl z-50 overflow-hidden">
                                {filters.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => {
                                            setFilter(f);
                                            setIsFilterOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors ${filter === f ? 'text-nova-cyan font-bold bg-white/5' : 'text-gray-400'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={40} className="text-nova-cyan animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {proposals.length > 0 ? (
                        proposals.map(prop => (
                            <GovernancePostCard key={prop.id} item={prop} type="proposal" />
                        ))
                    ) : (
                        <div className="glass-panel p-12 rounded-xl border border-white/10 text-center">
                            <h2 className="text-xl font-orbitron text-gray-400 mb-2">No Resonance Found</h2>
                            <p className="text-gray-500 font-mono text-sm">Adjust your scanners to detect signals.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
