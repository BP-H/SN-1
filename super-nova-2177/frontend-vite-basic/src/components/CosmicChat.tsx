import React, { useState, useRef, useEffect } from 'react';
import { askCosmicNexus } from '../services/geminiService';
import { Send, Bot, Loader2 } from 'lucide-react';

interface CosmicChatProps {
    context?: string;
}

export const CosmicChat: React.FC<CosmicChatProps> = ({ context }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Greetings, Harmonizer. I am the Cosmic Nexus. I am connected to the live neural lattice. How may I assist your resonance today?' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const systemContext = context || "System Status: Online, Entropy: Variable.";
    const response = await askCosmicNexus(userMsg, systemContext);

    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setLoading(false);
  };

  return (
    <div className="glass-panel rounded-xl h-[500px] flex flex-col font-mono text-sm border-t-2 border-nova-acid">
      <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-nova-black/50">
        <Bot className="text-nova-acid animate-pulse-fast" size={20} />
        <h3 className="text-nova-acid font-bold uppercase tracking-widest">Cosmic Nexus Uplink</h3>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-nova-purple/20 border border-nova-purple/50 text-white rounded-tr-none' 
                : 'bg-green-900/20 border border-nova-acid/50 text-nova-acid rounded-tl-none shadow-[0_0_10px_rgba(204,255,0,0.1)]'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
            <div className="flex justify-start">
             <div className="bg-green-900/20 border border-nova-acid/50 p-3 rounded-lg flex items-center gap-2">
                 <Loader2 className="animate-spin text-nova-acid" size={16} />
                 <span className="text-xs text-nova-acid/70">Computing resonance...</span>
             </div>
            </div>
        )}
      </div>

      <div className="p-4 bg-nova-black/50 border-t border-white/10 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Query the multiverse..."
          className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-nova-acid transition-colors"
        />
        <button 
          onClick={handleSend}
          disabled={loading}
          className="bg-nova-acid text-black font-bold p-2 rounded hover:bg-white transition-colors disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
