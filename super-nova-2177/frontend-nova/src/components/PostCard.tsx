import React, { useState } from 'react';
import { api } from '../services/api';
import type { Proposal } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageSquare, Share2, Send, Bot, Building2, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';

interface PostCardProps {
  post: Proposal;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState(post.likes || []);
  const [comments, setComments] = useState(post.comments || []);
  
  // Interaction states
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  // Check if current user liked
  const isLikedByMe = user ? likes.some(l => l.voter === user.username) : false;

  // Tri-Species Math (Weight on 3 Protocol)
  const calcSpeciesApproval = (speciesType: string) => {
    // In a real scenario, we'd know total population per species.
    // Assuming backend returns 'likes' array with 'voter_type'.
    // We just count the likes from this species.
    return likes.filter(l => l.voter_type === speciesType).length;
  };

  const humanLikes = calcSpeciesApproval('human');
  const aiLikes = calcSpeciesApproval('ai');
  const corpLikes = calcSpeciesApproval('company');

  // The protocol dictates each species gets 33.3% weight.
  // We approximate the fill by looking at total possible impact.
  // We'll just visualize raw numbers cleanly.
  
  const handleLike = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    
    try {
      if (isLikedByMe) {
        // Optimistic UI Unlike
        setLikes(prev => prev.filter(l => l.voter !== user.username));
        await api.removeVote(post.id, user.username);
      } else {
        // Optimistic UI Like
        setLikes(prev => [...prev, { voter: user.username, voter_type: user.species }]);
        await api.voteProposal(post.id, 'up', user.species, user.username);
      }
    } catch (e) {
      console.error("Vote failed", e);
      // Revert if failed (simplified: just ignore for now)
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/#/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    
    try {
      await api.addComment(post.id, newComment, user.species, user.username);
      // Just visually append it
      setComments(prev => [{ user: user.username, comment: newComment, species: user.species, created_at: new Date().toISOString() }, ...prev]);
      setNewComment('');
    } catch (e) {
      console.error("Comment fail", e);
    }
  };

  // Helper to get initials
  const initials = post.userInitials || post.userName.slice(0, 2).toUpperCase() || 'UN';

  return (
    <article className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-purple), var(--brand-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{post.userName}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{post.time}</div>
        </div>
      </div>

      {/* Content */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{post.title}</h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
          {post.text}
        </p>
      </div>

      {/* Media */}
      {post.media?.image && (
        <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
          <img src={post.media.image} style={{ width: '100%', height: 'auto', display: 'block' }} alt="Post media" />
        </div>
      )}
      
      {/* Harmony Bar (Tri-Species Weight Protocol Visualized) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <span>Tri-Species Resonance</span>
          <span>{likes.length} total</span>
        </div>
        <div style={{ display: 'flex', height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(5, (humanLikes / Math.max(1, likes.length)) * 100)}%`, background: 'var(--human-color)', opacity: humanLikes ? 1 : 0.3 }} />
          <div style={{ width: `${Math.max(5, (aiLikes / Math.max(1, likes.length)) * 100)}%`, background: 'var(--ai-color)', opacity: aiLikes ? 1 : 0.3 }} />
          <div style={{ width: `${Math.max(5, (corpLikes / Math.max(1, likes.length)) * 100)}%`, background: 'var(--company-color)', opacity: corpLikes ? 1 : 0.3 }} />
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleLike} className={clsx("btn-icon", isLikedByMe && "active-like")}>
            <Heart size={20} className={isLikedByMe ? "fill-current" : ""} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{likes.length}</span>
          </button>
          
          <button onClick={() => setShowComments(!showComments)} className={clsx("btn-icon", showComments && "active-dislike")}>
            <MessageSquare size={20} className={showComments ? "fill-current" : ""} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{comments.length}</span>
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={handleShare} className="btn-icon">
            <Share2 size={20} />
          </button>
          {showCopied && (
            <div style={{ position: 'absolute', bottom: '100%', right: '0', background: 'white', color: 'black', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }} className="animate-fade-in">
              Copied!
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
          {user && (
            <form onSubmit={submitComment} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="input-glass" 
                style={{ flex: 1, padding: '10px 14px', fontSize: '13px' }} 
                placeholder="Transmit your resonance..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <button type="submit" disabled={!newComment.trim()} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Send size={18} color="var(--brand-cyan)" />
              </button>
            </form>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
            {comments.map((c: any, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ 
                  width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: c.species === 'human' ? 'var(--human-color)' : c.species === 'ai' ? 'var(--ai-color)' : 'var(--company-color)' 
                }}>
                  {c.species === 'human' && <UserIcon size={12} color="#000" />}
                  {c.species === 'ai' && <Bot size={12} color="#000" />}
                  {c.species === 'company' && <Building2 size={12} color="#000" />}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px', color: 'rgba(255,255,255,0.6)' }}>{c.user || 'Unknown'}</div>
                  <div style={{ fontSize: '13px' }}>{c.comment}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </article>
  );
};
