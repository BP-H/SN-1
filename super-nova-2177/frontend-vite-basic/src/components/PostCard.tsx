import React from 'react';
import { VibeNode, Proposal } from '../types';
import { LiquidGlass } from './LiquidGlass';
import { LikesDeslikes } from './LikesDeslikes';
import { CommentSection } from './CommentSection';
import { Heart, MessageCircle, Share2, Zap, ExternalLink, FileText } from 'lucide-react';
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

    const [localLikesCount, setLocalLikesCount] = React.useState(vibe?.likes_count || 0);
    const [isLiked, setIsLiked] = React.useState(false);
    const [showComments, setShowComments] = React.useState(false);
    const [showCopied, setShowCopied] = React.useState(false);

    const handleLike = async () => {
        if (!isProposal) {
            if (!user) return;
            try {
                // Optimistic UI Update
                setLocalLikesCount(prev => isLiked ? prev - 1 : prev + 1);
                setIsLiked(!isLiked);
                await api.likeVibeNode(vibe.id, user.species, user.username);
            } catch (error) {
                console.error("Failed to like vibe:", error);
                // Revert on failure
                setLocalLikesCount(prev => isLiked ? prev + 1 : prev - 1);
                setIsLiked(!isLiked);
            }
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
            } catch (err) {
                // User cancelled or share failed
            }
        } else {
            navigator.clipboard.writeText(url);
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
        }
    };

    const getEmbedUrl = (url: string) => {
        if (!url) return "";
        try {
            if (url.includes("youtube.com/embed/")) return url;
            const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const match = url.match(regExp);
            if (match && match[1]) {
                return `https://www.youtube.com/embed/${match[1]}`;
            }
            return url;
        } catch {
            return url;
        }
    };

    const [imageZoom, setImageZoom] = React.useState(false);
    const [readMore, setReadMore] = React.useState(false);

    const renderMedia = () => {
        let mediaUrl = '';
        let mediaType = 'text';

        if (isProposal) {
            if (proposal.media?.video || proposal.video) {
                mediaUrl = proposal.media?.video || proposal.video || '';
                mediaType = 'video';
            } else if (proposal.media?.image || proposal.image) {
                mediaUrl = proposal.media?.image || proposal.image || '';
                mediaType = 'image';
            } else if (proposal.media?.link || proposal.link) {
                mediaUrl = proposal.media?.link || proposal.link || '';
                mediaType = 'link';
            } else if (proposal.media?.file || proposal.file) {
                mediaUrl = proposal.media?.file || proposal.file || '';
                mediaType = 'file';
            }
        } else {
            mediaUrl = vibe.media_url || '';
            mediaType = vibe.media_type;
        }

        if (!mediaUrl) return null;

        // Ensure URL is absolute if it's a relative path from backend
        const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${mediaUrl}`;

        switch (mediaType) {
            case 'video':
                return (
                    <div className="mt-4 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black aspect-video">
                        <iframe
                            src={getEmbedUrl(fullUrl)}
                            title="Video Content"
                            width="100%"
                            height="100%"
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                );
            case 'image':
                return (
                    <>
                        <div
                            className="mt-4 rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setImageZoom(true);
                            }}
                        >
                            <img src={fullUrl} alt="Content" className="w-full object-cover max-h-[500px]" />
                        </div>
                        {imageZoom && (
                            <div
                                className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImageZoom(false);
                                }}
                            >
                                <img src={fullUrl} alt="Content" className="max-w-full max-h-full object-contain" />
                            </div>
                        )}
                    </>
                );
            case 'link':
                return (
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/link">
                        <div className="p-2 bg-nova-cyan/20 rounded-lg text-nova-cyan group-hover/link:scale-110 transition-transform">
                            <ExternalLink size={20} />
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm text-gray-400 font-mono">External Link</div>
                            <div className="text-white truncate font-bold">{fullUrl}</div>
                        </div>
                    </a>
                );
            case 'file':
                return (
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/file">
                        <div className="p-2 bg-nova-purple/20 rounded-lg text-nova-purple group-hover/file:scale-110 transition-transform">
                            <FileText size={20} />
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm text-gray-400 font-mono">Attachment</div>
                            <div className="text-white truncate font-bold">Download File</div>
                        </div>
                    </a>
                );
            default:
                return null;
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Unknown Date';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid Date';
        }
    };

    return (
        <LiquidGlass className="rounded-3xl p-6 transition-all hover:border-nova-cyan/30 group">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-nova-purple to-nova-pink flex items-center justify-center font-bold text-lg text-white shadow-lg shrink-0 overflow-hidden">
                        {isProposal && proposal.author_img ? (
                            <img src={proposal.author_img} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            (isProposal ? (proposal.userInitials || proposal.userName?.[0] || proposal.author_username?.[0] || 'A') : (vibe.author_username?.[0] || 'A'))
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-white flex items-center gap-2">
                            {isProposal ? (proposal.userName || proposal.author_username || `User ${proposal.author_id}`) : vibe.author_username}
                            {isProposal && proposal.author_type && (
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-white shadow-md ${proposal.author_type === 'human' ? 'bg-[#ff375f] shadow-[0_0_7px_#ff375f]' :
                                        proposal.author_type === 'company' ? 'bg-[#7ec5f3] shadow-[0_0_7px_#3562c5]' :
                                            proposal.author_type === 'ai' ? 'bg-[#7ec5f3] shadow-[0_0_7px_#ff375f]' : ''
                                        }`}
                                >
                                    {proposal.author_type}
                                </span>
                            )}
                            {isProposal && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest ${proposal.status === 'active' ? 'bg-nova-acid/20 text-nova-acid' : 'bg-gray-700 text-gray-400'
                                    }`}>
                                    {proposal.status}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                            {formatDate(item.created_at)}
                        </div>
                    </div>
                </div>

                {!isProposal && (
                    <div className="text-nova-cyan font-mono text-xs flex items-center gap-1">
                        <Zap size={14} className="fill-nova-cyan" />
                        {parseFloat(vibe.echo).toFixed(1)} Echo
                    </div>
                )}
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{isProposal ? proposal.title : vibe.name}</h3>
                <div className="text-gray-300 font-light leading-relaxed whitespace-pre-wrap">
                    {(isProposal ? (proposal.description || "") : (vibe.description || "")).length > 250 && !readMore ? (
                        <>
                            {(isProposal ? (proposal.description || "") : (vibe.description || "")).slice(0, 250)}...
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setReadMore(true);
                                }}
                                className="text-nova-cyan ml-1 hover:underline"
                            >
                                Show More
                            </button>
                        </>
                    ) : (
                        <>
                            {isProposal ? (proposal.description || "") : (vibe.description || "")}
                            {(isProposal ? (proposal.description || "") : (vibe.description || "")).length > 250 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReadMore(false);
                                    }}
                                    className="text-nova-cyan ml-1 hover:underline"
                                >
                                    Show Less
                                </button>
                            )}
                        </>
                    )}
                </div>

                {renderMedia()}
            </div>

            <div className="pt-4 border-t border-white/5">
                {isProposal ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <LikesDeslikes
                                proposalId={proposal.id}
                                initialLikes={proposal.likes?.length || 0}
                                initialDislikes={proposal.dislikes?.length || 0}
                                initialClicked={
                                    proposal.likes?.some((l: any) => l.voter === user?.username) ? 'like' :
                                    proposal.dislikes?.some((l: any) => l.voter === user?.username) ? 'dislike' : null
                                }
                            />
                        </div>
                        <CommentSection proposalId={proposal.id} initialComments={proposal.comments} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                                <button onClick={handleLike} className={`flex items-center gap-2 transition-colors ${isLiked ? 'text-nova-pink' : 'text-gray-400 hover:text-nova-pink'}`}>
                                    <Heart size={20} className={isLiked ? 'fill-nova-pink' : ''} /> <span className="text-sm font-mono">{localLikesCount}</span>
                                </button>
                                <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 transition-colors ${showComments ? 'text-nova-cyan' : 'text-gray-400 hover:text-nova-cyan'}`}>
                                    <MessageCircle size={20} className={showComments ? 'fill-nova-cyan/20' : ''} /> <span className="text-sm font-mono">{vibe.comments_count}</span>
                                </button>
                            </div>
                            <div className="relative">
                                <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors">
                                    <Share2 size={20} />
                                </button>
                                {showCopied && (
                                    <span className="absolute -top-8 -right-2 bg-white text-black text-xs font-bold px-2 py-1 rounded shadow-lg animate-fade-in-up whitespace-nowrap">
                                        Copied!
                                    </span>
                                )}
                            </div>
                        </div>
                        {showComments && (
                            <CommentSection proposalId={vibe.id} initialComments={[]} />
                        )}
                    </div>
                )}
            </div>
        </LiquidGlass>
    );
};

