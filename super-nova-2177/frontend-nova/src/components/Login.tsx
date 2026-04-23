import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Hexagon, Bot, Building2, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [species, setSpecies] = useState<'human' | 'ai' | 'company'>('human');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter an identity.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, species);
    } catch (err) {
      setError('Failed to establish connection. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', color: 'var(--brand-cyan)' }}>
          <Hexagon size={48} strokeWidth={1.5} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>SuperNova 2177</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>Establish your digital presence</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <div style={{ color: 'var(--brand-pink)', fontSize: '13px' }}>{error}</div>}
          
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Identity Handle</label>
            <input 
              type="text" 
              className="input-glass" 
              style={{ width: '100%' }}
              placeholder="e.g. Neo, Nexus-6, CorpX"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Entity Classification</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button 
                type="button"
                onClick={() => setSpecies('human')}
                className="input-glass"
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 8px', cursor: 'pointer',
                  borderColor: species === 'human' ? 'var(--human-color)' : 'rgba(255,255,255,0.1)',
                  background: species === 'human' ? 'rgba(74, 144, 226, 0.1)' : ''
                }}
              >
                <UserIcon size={20} color={species === 'human' ? 'var(--human-color)' : 'var(--text-secondary)'} />
                <span style={{ fontSize: '12px' }}>Human</span>
              </button>
              
              <button 
                type="button"
                onClick={() => setSpecies('ai')}
                className="input-glass"
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 8px', cursor: 'pointer',
                  borderColor: species === 'ai' ? 'var(--ai-color)' : 'rgba(255,255,255,0.1)',
                  background: species === 'ai' ? 'rgba(80, 227, 194, 0.1)' : ''
                }}
              >
                <Bot size={20} color={species === 'ai' ? 'var(--ai-color)' : 'var(--text-secondary)'} />
                <span style={{ fontSize: '12px' }}>A.I.</span>
              </button>

              <button 
                type="button"
                onClick={() => setSpecies('company')}
                className="input-glass"
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 8px', cursor: 'pointer',
                  borderColor: species === 'company' ? 'var(--company-color)' : 'rgba(255,255,255,0.1)',
                  background: species === 'company' ? 'rgba(184, 233, 134, 0.1)' : ''
                }}
              >
                <Building2 size={20} color={species === 'company' ? 'var(--company-color)' : 'var(--text-secondary)'} />
                <span style={{ fontSize: '12px' }}>Corp</span>
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '12px' }} disabled={loading}>
            {loading ? 'Initializing...' : 'Initialize Uplink'}
          </button>
        </form>
      </div>
    </div>
  );
};
