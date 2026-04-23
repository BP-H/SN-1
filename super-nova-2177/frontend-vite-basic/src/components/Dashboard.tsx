
import React from 'react';
import { Activity, Users, Radio, Zap, AlertTriangle } from 'lucide-react';
import { SystemMetrics } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardProps {
  metrics: SystemMetrics;
  history?: { name: string; entropy: number }[];
}

export const Dashboard: React.FC<DashboardProps> = ({ metrics, history = [] }) => {
  const { current_system_entropy, total_harmonizers, total_vibenodes, community_wellspring } = metrics.metrics;

  // Calculate percentage (inverted entropy where 2000 is chaos/0% harmony and 0 is 100%)
  const harmonyPct = Math.max(0, Math.min(100, (1 - (current_system_entropy / 2000)) * 100));

  // Parse wellspring string to float for display
  const wellspringValue = parseFloat(community_wellspring) || 0;
  const isOffline = metrics.status === 'offline';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Metric Cards */}
      <div className="glass-panel p-4 rounded-xl border-l-4 border-nova-pink relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 bg-nova-pink/20 w-24 h-24 rounded-full blur-2xl group-hover:bg-nova-pink/40 transition-all"></div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-gray-400 text-xs font-mono uppercase">System Entropy</span>
          <Activity className="text-nova-pink" size={18} />
        </div>
        <div className="text-2xl font-orbitron font-bold text-white">{current_system_entropy.toFixed(1)}</div>
        <div className="text-xs text-nova-pink mt-1">Threshold: 1200.0</div>
      </div>

      <div className="glass-panel p-4 rounded-xl border-l-4 border-nova-cyan relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 bg-nova-cyan/20 w-24 h-24 rounded-full blur-2xl group-hover:bg-nova-cyan/40 transition-all"></div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-gray-400 text-xs font-mono uppercase">Harmonizers</span>
          <Users className="text-nova-cyan" size={18} />
        </div>
        <div className="text-2xl font-orbitron font-bold text-white">{total_harmonizers.toLocaleString()}</div>
        <div className="text-xs text-nova-cyan mt-1">Active Entities</div>
      </div>

      <div className="glass-panel p-4 rounded-xl border-l-4 border-nova-acid relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 bg-nova-acid/20 w-24 h-24 rounded-full blur-2xl group-hover:bg-nova-acid/40 transition-all"></div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-gray-400 text-xs font-mono uppercase">Resonance</span>
          <Radio className="text-nova-acid" size={18} />
        </div>
        <div className="text-2xl font-orbitron font-bold text-white">{harmonyPct.toFixed(1)}%</div>
        <div className="text-xs text-nova-acid mt-1">Harmony Index</div>
      </div>

      <div className="glass-panel p-4 rounded-xl border-l-4 border-purple-500 relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 bg-purple-500/20 w-24 h-24 rounded-full blur-2xl group-hover:bg-purple-500/40 transition-all"></div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-gray-400 text-xs font-mono uppercase">Wellspring</span>
          <Zap className="text-purple-500" size={18} />
        </div>
        <div className="text-2xl font-orbitron font-bold text-white">{wellspringValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        <div className="text-xs text-purple-500 mt-1">Total VibeNodes: {total_vibenodes}</div>
      </div>

      {isOffline && (
        <div className="md:col-span-4 bg-yellow-900/20 border border-yellow-500/30 text-yellow-500 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-mono">
          <AlertTriangle size={16} />
          <span>Resonance Link Unstable: Displaying simulated data. Re-establishing connection...</span>
        </div>
      )}

      {/* Chart */}
      <div className="md:col-span-4 glass-panel p-4 rounded-xl h-48 flex flex-col">
        <h3 className="text-xs text-gray-400 font-mono uppercase mb-4">Entropy Timeline (Live)</h3>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.length > 0 ? history : [{ name: 'Now', entropy: current_system_entropy }]}>
              <defs>
                <linearGradient id="colorEntropy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F20089" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#F20089" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px' }}
                itemStyle={{ color: '#F20089' }}
              />
              <Area type="monotone" dataKey="entropy" stroke="#F20089" fillOpacity={1} fill="url(#colorEntropy)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
