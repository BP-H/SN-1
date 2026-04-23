
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { RefreshCcw, Wifi, WifiOff, Plus } from 'lucide-react';

import { Dashboard } from './components/Dashboard';
import { VibeFeed } from './components/VibeFeed';
import { Governance } from './components/Governance';
import { CosmicChat } from './components/CosmicChat';
import { NetworkGraph } from './components/NetworkGraph';
import { Sidebar } from './components/Sidebar';
import { CreatePostModal } from './components/CreatePostModal';
import { api } from './services/api';
import { SystemMetrics, GraphData, VibeNode } from './types';
import { useAuth } from './context/AuthContext';

const MainLayout: React.FC = () => {
    const { user, login } = useAuth();

    // Data State
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [vibeNodes, setVibeNodes] = useState<VibeNode[]>([]);
    const [entropyHistory, setEntropyHistory] = useState<{ name: string, entropy: number }[]>([]);

    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(false);

    // Auth Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedSpecies, setSelectedSpecies] = useState<'human' | 'ai' | 'company'>('human');
    const [isRegistering, setIsRegistering] = useState(false);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const fetchData = async () => {
        // Don't set full loading on refresh to avoid flickering, just initial load
        if (!metrics) setLoading(true);

        const health = await api.checkHealth();
        setIsOnline(health);

        try {
            // Fetch in parallel but handle failures individually in api service
            const [statusData, netData, nodesData] = await Promise.all([
                api.getStatus(),
                api.getNetworkAnalysis(50),
                api.getVibeNodes()
            ]);

            setMetrics(statusData);
            setGraphData(netData);
            setVibeNodes(nodesData);

            // Update history
            setEntropyHistory(prev => {
                const newPoint = {
                    name: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    entropy: statusData.metrics.current_system_entropy
                };
                // Avoid duplicate time points if fetching too fast
                if (prev.length > 0 && prev[prev.length - 1].name === newPoint.name) return prev;

                const newHistory = [...prev, newPoint];
                if (newHistory.length > 20) newHistory.shift(); // Keep last 20 points
                return newHistory;
            });

            setError(null);
        } catch (error) {
            console.error("System Failure:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
                    <h1 className="text-3xl font-orbitron font-bold text-center text-white mb-2">SUPERNOVA_2177</h1>
                    <p className="text-center text-gray-400 font-mono text-sm mb-8">
                        {isRegistering ? 'Establish New Identity' : 'Enter the Neural Lattice'}
                    </p>

                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setSelectedSpecies('human')}
                            className={`flex-1 p-3 rounded-xl border transition-all ${selectedSpecies === 'human' ? 'bg-nova-pink/20 border-nova-pink text-white' : 'bg-black/40 border-white/10 text-gray-500 hover:bg-white/5'}`}
                        >
                            <div className="text-xs uppercase font-mono mb-1">Species</div>
                            <div className="font-bold">HUMAN</div>
                        </button>
                        <button
                            onClick={() => setSelectedSpecies('ai')}
                            className={`flex-1 p-3 rounded-xl border transition-all ${selectedSpecies === 'ai' ? 'bg-nova-acid/20 border-nova-acid text-white' : 'bg-black/40 border-white/10 text-gray-500 hover:bg-white/5'}`}
                        >
                            <div className="text-xs uppercase font-mono mb-1">Species</div>
                            <div className="font-bold">AI</div>
                        </button>
                        <button
                            onClick={() => setSelectedSpecies('company')}
                            className={`flex-1 p-3 rounded-xl border transition-all ${selectedSpecies === 'company' ? 'bg-nova-purple/20 border-nova-purple text-white' : 'bg-black/40 border-white/10 text-gray-500 hover:bg-white/5'}`}
                        >
                            <div className="text-xs uppercase font-mono mb-1">Species</div>
                            <div className="font-bold">CORP</div>
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder="Identity"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white mb-4 focus:border-nova-cyan outline-none"
                    />
                    <input
                        type="password"
                        placeholder="Access Code"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white mb-6 focus:border-nova-pink outline-none"
                    />
                    <button
                        onClick={async () => {
                            setError(null);
                            try {
                                if (isRegistering) {
                                    await api.register({
                                        username,
                                        password,
                                        species: selectedSpecies,
                                        harmony_score: '50', // Default starting score
                                        creative_spark: '50',
                                        network_centrality: 0
                                    });
                                    const res = await api.login(username, password);
                                    await login(res.access_token);
                                } else {
                                    const res = await api.login(username, password);
                                    await login(res.access_token);
                                }
                            } catch (err: any) {
                                console.error(err);
                                const errorMessage = err.message || (isRegistering ? "Registration Failed" : "Authentication Failed");
                                setError(errorMessage);
                            }
                        }}
                        className="w-full bg-gradient-to-r from-nova-purple to-nova-pink text-white font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(242,0,137,0.3)]"
                    >
                        {isRegistering ? 'ESTABLISH IDENTITY' : 'INITIALIZE UPLINK'}
                    </button>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError(null);
                            }}
                            className="text-nova-cyan hover:text-white text-sm font-mono transition-colors"
                        >
                            {isRegistering ? '< RETURN TO LOGIN' : 'NO IDENTITY? CREATE ONE >'}
                        </button>
                    </div>

                    {error && <div className="text-red-500 text-center mt-4 font-mono text-sm">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#050505] to-black text-white md:pl-24 p-4 py-6 font-sans">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
            <CreatePostModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

            <main className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end pb-4 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between">
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </button>
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-orbitron font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                SUPERNOVA<span className="text-nova-cyan">_2177</span>
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-gray-500 font-mono text-[10px] md:text-xs uppercase tracking-widest">Resonance Engine v5.0</span>
                                <div className="h-px w-8 md:w-12 bg-gray-800"></div>
                                <span className="text-nova-pink font-mono text-[10px] md:text-xs uppercase">
                                    {isOnline ? 'LIVE FEED' : 'SIMULATION MODE'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                        <div className="flex flex-col items-end mr-4">
                            <div className={`text-xs font-mono flex items-center gap-2 ${isOnline ? 'text-nova-acid' : 'text-yellow-500'}`}>
                                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                                {isOnline ? 'SYSTEM OPTIMAL' : 'OFFLINE SIMULATION'}
                            </div>
                        </div>

                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-white text-black hover:bg-nova-cyan hover:scale-105 transition-all p-3 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <Routes>
                    <Route path="/" element={
                        <div className="space-y-8 animate-float">
                            {metrics && <Dashboard metrics={metrics} history={entropyHistory} />}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-orbitron text-white">Neural Feed</h3>
                                    </div>
                                    <VibeFeed nodes={vibeNodes} />
                                </div>
                                <div className="space-y-8">
                                    <div className="glass-panel p-1 rounded-2xl hidden lg:block">
                                        <NetworkGraph data={graphData || { nodes: [], edges: [], metrics: { node_count: 0, edge_count: 0, density: 0 } }} />
                                    </div>
                                    <CosmicChat />
                                </div>
                            </div>
                        </div>
                    } />
                    <Route path="/vibes" element={<VibeFeed nodes={vibeNodes} />} />
                    <Route path="/nexus" element={<div className="max-w-4xl mx-auto h-[80vh]"><CosmicChat /></div>} />
                    <Route path="/graph" element={<div className="h-[80vh] glass-panel rounded-3xl overflow-hidden"><NetworkGraph data={graphData || { nodes: [], edges: [], metrics: { node_count: 0, edge_count: 0, density: 0 } }} /></div>} />
                    <Route path="/gov" element={<Governance />} />
                </Routes>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <MainLayout />
        </HashRouter>
    );
};

export default App;
