import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, Globe, MoreHorizontal, Bot, Building2, User as UserIcon } from 'lucide-react';
import type { VibeNode, Proposal } from '../types';
import clsx from 'clsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PostCardProps {
    item: VibeNode | Proposal;
    type: 'vibe' | 'proposal';
}

export const PostCard: React.FC<PostCardProps> = ({ item, type }) => {
    const isProposal = type === 'proposal';
    const proposal = item as Proposal;
    const vibe = item as VibeNode;
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    const [localLikes, setLocalLikes] = useState(isProposal ? (proposal.likes?.length || 0) : vibe.likes_count);
    const [localDislikes, setLocalDislikes] = useState(isProposal ? (proposal.dislikes?.length || 0) : 0);
    const [voteState, setVoteState] = useState<'like' | 'dislike' | null>(null);

    // Comment state
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<any[]>(isProposal ? (proposal.comments || []) : []);
    const [newComment, setNewComment] = useState('');

    // Helper to safely get description
    const description = (isProposal ? proposal.description : vibe.description) || "";
    const authorName = isProposal ? (proposal.userName || proposal.author_username || "Supernova Citizen") : (vibe.author_username || "Supernova Citizen");
    const authorHeadline = "Explorer of Supernova 2177";
    const timeAgo = new Date(item.created_at).toLocaleDateString();

    const handleLike = async () => {
        if (!user) return;
        if (!isProposal) {
            if (voteState === 'like') return; // Prevent double like on local state
            try {
                await api.likeVibeNode(vibe.id, user.species, user.username);
                setLocalLikes(prev => prev + 1);
                setVoteState('like');
            } catch (e) {
                console.error("Failed to like vibe", e);
            }
            return;
        }

        try {
            if (voteState === 'like') {
                // Unlike: remove vote
                await api.removeVote(proposal.id, user.username);
                setLocalLikes(prev => prev - 1);
                setVoteState(null);
            } else {
                // Switching from dislike: remove old vote first
                if (voteState === 'dislike') {
                    await api.removeVote(proposal.id, user.username);
                    setLocalDislikes(prev => prev - 1);
                }
                await api.voteProposal(proposal.id, 'up', user.species, user.username);
                setLocalLikes(prev => prev + 1);
                setVoteState('like');
            }
        } catch (error) {
            console.error("Failed to vote", error);
        }
    };

    const handleDislike = async () => {
        if (!user || !isProposal) return;

        try {
            if (voteState === 'dislike') {
                // Un-dislike: remove vote
                await api.removeVote(proposal.id, user.username);
                setLocalDislikes(prev => prev - 1);
                setVoteState(null);
            } else {
                // Switching from like: remove old vote first
                if (voteState === 'like') {
                    await api.removeVote(proposal.id, user.username);
                    setLocalLikes(prev => prev - 1);
                }
                await api.voteProposal(proposal.id, 'down', user.species, user.username);
                setLocalDislikes(prev => prev + 1);
                setVoteState('dislike');
            }
        } catch (error) {
            console.error("Failed to vote", error);
        }
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;
        try {
            const created = await api.addComment(isProposal ? proposal.id : vibe.id, newComment, user.species, user.username, '');
            setComments(prev => [created || { user: user.username, comment: newComment, species: user.species }, ...prev]);
            setNewComment('');
        } catch (e) {
            console.error("Failed to post comment", e);
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/#/vibes/${item.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: isProposal ? proposal.title : vibe.name,
                    text: 'Check out this resonance on SuperNova 2177!',
                    url: url
                });
            } catch (err) {}
        } else {
            navigator.clipboard.writeText(url);
            alert("Link copied to clipboard!");
        }
    };

    const mediaUrl = isProposal ? (proposal.media?.image || proposal.image || proposal.media?.video || proposal.video) : (vibe.media_url);
    const isVideo = isProposal ? (!!proposal.media?.video || !!proposal.video) : (vibe.media_type === 'video');

    return (
        <div className="bg-white mb-2 pb-2">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex gap-3 relative">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${authorName}`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm text-professional-text-primary truncate leading-tight">
                                {authorName}
                            </span>
                            <span className="text-xs text-professional-text-secondary truncate leading-tight">
                                {authorHeadline}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-professional-text-secondary mt-0.5">
                                <span>{timeAgo}</span>
                                <span>•</span>
                                <Globe size={10} />
                            </div>
                        </div>
                        <button className="text-gray-500">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-2">
                <div className={clsx("text-sm text-professional-text-primary whitespace-pre-wrap", !isExpanded && "line-clamp-3")}>
                    {description}
                </div>
                {description.length > 150 && !isExpanded && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="text-professional-text-secondary text-sm hover:text-professional-blue hover:underline mt-1 block ml-auto"
                    >
                        ...more
                    </button>
                )}
            </div>

            {/* Media */}
            {mediaUrl && (
                <div className="w-full bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                        <video src={mediaUrl} controls className="w-full h-full object-cover" />
                    ) : (
                        <img src={mediaUrl} alt="Post content" className="w-full h-full object-cover" />
                    )}
                </div>
            )}

            {/* Stats Bar */}
            <div className="px-4 py-2 flex justify-between items-center text-xs text-professional-text-secondary border-b border-gray-100 mx-4">
                <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center z-20 border border-white">
                            <ThumbsUp size={8} className="text-white fill-white" />
                        </div>
                    </div>
                    <span>{localLikes}</span>
                    {isProposal && localDislikes > 0 && (
                        <>
                            <span>•</span>
                            <span>{localDislikes} dislikes</span>
                        </>
                    )}
                </div>
                <div>
                    <button onClick={() => setShowComments(!showComments)} className="hover:text-professional-blue hover:underline">
                        {comments.length} comments
                    </button>
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-2 py-1 flex justify-between items-center">
                <ActionButton icon={ThumbsUp} label="Like" onClick={handleLike} active={voteState === 'like'} />
                {isProposal && <ActionButton icon={ThumbsDown} label="Dislike" onClick={handleDislike} active={voteState === 'dislike'} />}
                <ActionButton icon={MessageSquare} label="Comment" onClick={() => setShowComments(!showComments)} />
                <ActionButton icon={Send} label="Share" onClick={handleShare} />
            </div>

            {/* Comment Section */}
            {showComments && (
                <div className="px-4 pb-4 space-y-3">
                    {user && (
                        <form onSubmit={handleSubmitComment} className="flex gap-2 items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="" className="w-full h-full" />
                            </div>
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:border-professional-blue outline-none"
                            />
                            <button type="submit" disabled={!newComment.trim()} className="text-professional-blue font-semibold text-sm disabled:opacity-50">Post</button>
                        </form>
                    )}
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {comments.map((c: any, i: number) => (
                            <div key={i} className="flex gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${c.species === 'ai' ? 'bg-green-500' : c.species === 'company' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                    {c.species === 'ai' ? <Bot size={12} /> : c.species === 'company' ? <Building2 size={12} /> : <UserIcon size={12} />}
                                </div>
                                <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2">
                                    <span className="text-xs font-semibold text-professional-text-primary">{c.user}</span>
                                    <p className="text-sm text-professional-text-primary">{c.comment}</p>
                                </div>
                            </div>
                        ))}
                        {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

const ActionButton: React.FC<{ icon: React.ElementType, label: string, onClick?: () => void, active?: boolean }> = ({ icon: Icon, label, onClick, active }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex flex-col items-center justify-center py-2 px-4 rounded hover:bg-gray-100 flex-1 active:scale-95 transition-transform",
            active ? "text-professional-blue" : "text-gray-600"
        )}
    >
        <Icon size={20} className={clsx(active ? "fill-current" : "")} />
        <span className="text-xs font-medium mt-1">{label}</span>
    </button>
);
