
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Send, User as UserIcon, Bot, Building2 } from 'lucide-react';

interface Comment {
    id: number;
    user: string;
    comment: string;
    species: string;
    user_img?: string;
    created_at?: string;
}

interface CommentSectionProps {
    proposalId: number;
    initialComments?: Comment[];
}

export const CommentSection: React.FC<CommentSectionProps> = ({ proposalId, initialComments = [] }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (expanded && comments.length === 0) {
            loadComments();
        }
    }, [expanded]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const data = await api.getComments(proposalId);
            if (Array.isArray(data)) {
                setComments(data);
            }
        } catch (e) {
            console.error("Failed to load comments", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        try {
            const res = await api.addComment(proposalId, newComment, user.species, user.username, '');
            // Optimistic update or use response
            const commentObj: Comment = {
                id: Date.now(), // temp id
                user: user.username,
                comment: newComment,
                species: user.species,
                user_img: '',
                created_at: new Date().toISOString()
            };
            setComments([commentObj, ...comments]);
            setNewComment('');
        } catch (e) {
            console.error("Failed to post comment", e);
        }
    };

    return (
        <div className="mt-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-gray-400 hover:text-white transition-colors mb-4 flex items-center gap-2"
            >
                {expanded ? 'Hide Comments' : `Show Comments (${comments.length})`}
            </button>

            {expanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Input */}
                    {user && (
                        <form onSubmit={handleSubmit} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nova-purple to-nova-pink flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-white">{user.username[0]}</span>
                            </div>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Transmit your thoughts..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm text-white focus:border-nova-cyan outline-none pr-10"
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-nova-cyan hover:text-white disabled:opacity-50 transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* List */}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="text-center text-xs text-gray-500 py-4">Loading transmission...</div>
                        ) : comments.length === 0 ? (
                            <div className="text-center text-xs text-gray-500 py-4">No signals detected yet.</div>
                        ) : (
                            comments.map((comment, idx) => (
                                <div key={idx} className="flex gap-3 group">
                                    <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${comment.species === 'ai' ? 'border-nova-acid text-nova-acid bg-nova-acid/10' :
                                        comment.species === 'company' ? 'border-nova-purple text-nova-purple bg-nova-purple/10' :
                                            'border-nova-pink text-nova-pink bg-nova-pink/10'
                                        }`}>
                                        {comment.species === 'ai' ? <Bot size={12} /> : comment.species === 'company' ? <Building2 size={12} /> : <UserIcon size={12} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-white">{comment.user}</span>
                                            <span className="text-[10px] text-gray-500 uppercase border border-white/10 px-1 rounded">{comment.species}</span>
                                            {comment.created_at && (
                                                <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed">{comment.comment}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
