import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Image as ImageIcon, Link as LinkIcon, X, Loader2, Send } from 'lucide-react';

interface ComposerProps {
  onClose: () => void;
  onPostCreated: () => void;
}

export const Composer: React.FC<ComposerProps> = ({ onClose, onPostCreated }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', content);
      formData.append('userName', user?.username || 'Unknown');
      formData.append('author_type', user?.species || 'human');
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await api.createProposal(formData);
      onPostCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to transmit resonance.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Broadcast Resonance</h2>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="text" 
            placeholder="Transmission Title..." 
            className="input-glass" 
            style={{ fontSize: '20px', fontWeight: 600, padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0 }}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          
          <textarea 
            placeholder="Detail your conceptual framework..." 
            className="input-glass"
            style={{ minHeight: '150px', resize: 'vertical', padding: '16px', background: 'transparent', border: 'none' }}
            value={content}
            onChange={e => setContent(e.target.value)}
          />

          {imageFile && (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <img src={URL.createObjectURL(imageFile)} alt="Preview" style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)' }} />
              <button 
                type="button" 
                onClick={() => setImageFile(null)} 
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', padding: '4px', borderRadius: '50%', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-icon" title="Attach Media">
                <ImageIcon size={20} />
              </button>
              <button type="button" className="btn-icon" title="Attach Link">
                <LinkIcon size={20} />
              </button>
            </div>

            <button type="submit" className="btn-primary" disabled={loading || !title.trim() || !content.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Broadcast</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
