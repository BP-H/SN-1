import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Feed } from './Feed';
import { Composer } from './Composer';
import { Hexagon, Activity, Users, Plus, LogOut } from 'lucide-react';
import { api } from '../services/api';
import type { GraphData, Proposal, SystemMetrics } from '../services/api';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'governance' | 'network'>('feed');
  const [showComposer, setShowComposer] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [networkData, setNetworkData] = useState<GraphData | null>(null);
  const [governanceItems, setGovernanceItems] = useState<Proposal[]>([]);

  // We only reload the feed via a totally un-React-like hard trick, 
  // but since we want to be elegant, we just let Feed mount/unmount or use a key.
  const [feedKey, setFeedKey] = useState(0);

  useEffect(() => {
    const loadPanels = async () => {
      try {
        const [status, network, proposals] = await Promise.all([
          api.getStatus(),
          api.getNetworkAnalysis(20),
          api.getProposals('latest'),
        ]);
        setSystemMetrics(status);
        setNetworkData(network);
        setGovernanceItems(proposals.slice(0, 5));
      } catch (error) {
        console.error('Failed to load live dashboard panels', error);
      }
    };

    loadPanels();
  }, [feedKey]);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <nav className="sidebar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
        <div style={{ color: 'var(--brand-cyan)', marginBottom: '32px' }}>
          <Hexagon size={32} strokeWidth={1.5} />
        </div>

        <button 
          onClick={() => setActiveTab('feed')} 
          className="btn-icon" 
          style={{ color: activeTab === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          title="Neural Feed"
        >
          <Activity size={24} />
        </button>

        <button 
          onClick={() => setActiveTab('governance')} 
          className="btn-icon" 
          style={{ color: activeTab === 'governance' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          title="Governance"
        >
          <Hexagon size={24} />
        </button>

        <button 
          onClick={() => setActiveTab('network')} 
          className="btn-icon" 
          style={{ color: activeTab === 'network' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          title="Network Graph"
        >
          <Users size={24} />
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-purple), var(--brand-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '16px' }} title={user?.username}>
          {user?.username.slice(0, 2).toUpperCase() || 'UN'}
        </div>

        <button onClick={logout} className="btn-icon" title="Disconnect" style={{ marginBottom: '16px' }}>
          <LogOut size={20} />
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content" style={{ padding: '0 40px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', paddingTop: '40px', paddingBottom: '100px' }}>
          <header style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.5px' }}>
              {activeTab === 'feed' && 'Neural Feed'}
              {activeTab === 'governance' && 'Governance Chamber'}
              {activeTab === 'network' && 'Resonance Network'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              {activeTab === 'feed' && 'Global transmission signals from all active entities.'}
              {activeTab === 'governance' && 'Directly shape the protocol architecture.'}
              {activeTab === 'network' && 'Visualize inter-species connectivity.'}
            </p>
          </header>

          {activeTab === 'feed' && <Feed key={feedKey} />}
          {activeTab === 'governance' && (
            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Harmonizers</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{systemMetrics?.metrics.total_harmonizers ?? 0}</div>
                </div>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Resonances</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{systemMetrics?.metrics.total_vibenodes ?? 0}</div>
                </div>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Entropy</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{systemMetrics?.metrics.current_system_entropy ?? 0}</div>
                </div>
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Latest Proposals</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {governanceItems.length > 0 ? governanceItems.map((proposal) => (
                    <div key={proposal.id} className="glass-panel" style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{proposal.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                        by {proposal.userName} · {proposal.likes.length} upvotes · {proposal.comments.length} comments
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No proposals yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'network' && (
            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Nodes</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{networkData?.metrics.node_count ?? 0}</div>
                </div>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Edges</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{networkData?.metrics.edge_count ?? 0}</div>
                </div>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Density</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{networkData?.metrics.density ?? 0}</div>
                </div>
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Recent Network Topology</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(networkData?.edges || []).slice(0, 8).map((edge, index) => (
                    <div key={`${edge.source}-${edge.target}-${index}`} className="glass-panel" style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{edge.source} → {edge.target}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                        {edge.type}
                      </div>
                    </div>
                  ))}
                  {(!networkData || networkData.edges.length === 0) && (
                    <div style={{ color: 'var(--text-secondary)' }}>Network data will appear as proposals accumulate.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      {activeTab === 'feed' && (
        <button 
          onClick={() => setShowComposer(true)}
          style={{
            position: 'absolute', bottom: '40px', right: '40px', 
            width: '64px', height: '64px', borderRadius: '50%', 
            background: 'linear-gradient(135deg, var(--brand-purple), var(--brand-pink))',
            color: 'white', border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(255, 0, 85, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s ease', zIndex: 50
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={32} />
        </button>
      )}

      {showComposer && (
        <Composer 
          onClose={() => setShowComposer(false)} 
          onPostCreated={() => setFeedKey(prev => prev + 1)} 
        />
      )}
    </div>
  );
};
