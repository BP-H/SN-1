import React, { useState, useEffect } from 'react';
import { LiquidGlass } from './LiquidGlass';
import { X, Save, Key, Bot, User, Building2, Cpu, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useLocal from '../hooks/useLocal';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { user, updateSpecies } = useAuth();
    const [apiKey, setApiKey] = useLocal('sn.api.key', '');
    const [selectedModel, setSelectedModel] = useLocal('sn.ai.model', 'gpt-4-turbo');
    const [theme, setTheme] = useLocal('sn.theme', 'cyberpunk');

    // Local state for form inputs to avoid constant re-renders/saves
    const [localKey, setLocalKey] = useState(apiKey);

    useEffect(() => {
        setLocalKey(apiKey);
    }, [apiKey]);

    if (!isOpen) return null;

    const handleSave = () => {
        setApiKey(localKey);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <LiquidGlass className="w-full max-w-2xl rounded-3xl animate-float overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <h3 className="text-2xl font-orbitron font-bold text-white flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-nova-cyan animate-pulse" />
                        System Configuration
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">

                    {/* Species Selection */}
                    <section>
                        <h4 className="text-nova-cyan font-mono text-sm mb-4 flex items-center gap-2">
                            <User size={16} /> IDENTITY_MATRIX
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => updateSpecies('human')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${user?.species === 'human'
                                        ? 'bg-nova-pink/20 border-nova-pink shadow-[0_0_15px_rgba(255,55,95,0.3)]'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <User size={32} className={user?.species === 'human' ? 'text-nova-pink' : 'text-gray-400'} />
                                <div className="text-center">
                                    <div className="font-bold text-white">Human</div>
                                    <div className="text-xs text-gray-400 font-mono">Biological Intelligence</div>
                                </div>
                            </button>

                            <button
                                onClick={() => updateSpecies('ai')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${user?.species === 'ai'
                                        ? 'bg-nova-acid/20 border-nova-acid shadow-[0_0_15px_rgba(217,255,0,0.3)]'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <Bot size={32} className={user?.species === 'ai' ? 'text-nova-acid' : 'text-gray-400'} />
                                <div className="text-center">
                                    <div className="font-bold text-white">AI Agent</div>
                                    <div className="text-xs text-gray-400 font-mono">Synthetic Intelligence</div>
                                </div>
                            </button>

                            <button
                                onClick={() => updateSpecies('company')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${user?.species === 'company'
                                        ? 'bg-nova-purple/20 border-nova-purple shadow-[0_0_15px_rgba(124,131,255,0.3)]'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <Building2 size={32} className={user?.species === 'company' ? 'text-nova-purple' : 'text-gray-400'} />
                                <div className="text-center">
                                    <div className="font-bold text-white">Company</div>
                                    <div className="text-xs text-gray-400 font-mono">Corporate Entity</div>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* API Configuration */}
                    <section>
                        <h4 className="text-nova-purple font-mono text-sm mb-4 flex items-center gap-2">
                            <Key size={16} /> NEURAL_LINK_KEYS
                        </h4>
                        <div className="space-y-4">
                            <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                                <label className="block text-xs text-gray-400 font-mono mb-2">OPENAI_API_KEY</label>
                                <input
                                    type="password"
                                    value={localKey}
                                    onChange={(e) => setLocalKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-nova-purple transition-colors font-mono text-sm"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Model Selection */}
                    <section>
                        <h4 className="text-nova-acid font-mono text-sm mb-4 flex items-center gap-2">
                            <Cpu size={16} /> INFERENCE_ENGINE
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            {['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'].map(model => (
                                <button
                                    key={model}
                                    onClick={() => setSelectedModel(model)}
                                    className={`px-4 py-3 rounded-lg text-sm font-mono text-left transition-all ${selectedModel === model
                                            ? 'bg-white/10 text-nova-acid border border-nova-acid/50'
                                            : 'bg-black/40 text-gray-400 border border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    {model}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-mono text-sm"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2 rounded-xl bg-gradient-to-r from-nova-cyan to-nova-purple text-white font-bold shadow-lg shadow-nova-purple/20 hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        <Save size={18} /> SAVE SYSTEM
                    </button>
                </div>
            </LiquidGlass>
        </div>
    );
};
