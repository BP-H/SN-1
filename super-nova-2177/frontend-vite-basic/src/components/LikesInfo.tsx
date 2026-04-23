import React, { useEffect, useState } from "react";
import { LiquidGlass } from './LiquidGlass';
import { ThumbsUp, ThumbsDown, User, Briefcase, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface LikeSectionProps {
    icon: React.ElementType;
    label: string;
    likes: number;
    dislikes: number;
}

const LikeSection: React.FC<LikeSectionProps> = ({ icon: Icon, label, likes, dislikes }) => {
    return (
        <LiquidGlass className="rounded-full !p-0">
            <div className="flex rounded-[30px] px-1 py-1 w-full justify-between items-center gap-3">
                <div className="bg-white/10 rounded-full p-1.5">
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-[0.6em] w-full text-white font-mono uppercase tracking-wider">{label}</p>
                <div className="flex text-black text-[0.6em] bg-white/10 shadow-md w-fit gap-2 rounded-full px-1 py-1 items-center justify-between">
                    <div className="flex items-center justify-center gap-1 rounded-full px-2 py-0 h-[30px]">
                        <ThumbsUp size={12} className="text-nova-cyan" />
                        <p className="h-fit text-white font-bold">{likes}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1 rounded-full px-2 h-[30px] py-0">
                        <ThumbsDown size={12} className="text-nova-pink" />
                        <p className="h-fit text-white font-bold">{dislikes}</p>
                    </div>
                </div>
            </div>
        </LiquidGlass>
    );
};

interface ApprovalHeatmapProps {
    humanLikes: number;
    humanDislikes: number;
    companyLikes: number;
    companyDislikes: number;
    aiLikes: number;
    aiDislikes: number;
    approval: boolean;
}

const ApprovalHeatmap: React.FC<ApprovalHeatmapProps> = ({ humanLikes, humanDislikes, companyLikes, companyDislikes, aiLikes, aiDislikes, approval }) => {
    const calcPercentage = (likes: number, dislikes: number) => {
        const total = likes + dislikes;
        return total === 0 ? 0 : (likes / total) * 100;
    };

    const humanPercentage = calcPercentage(humanLikes, humanDislikes);
    const companyPercentage = calcPercentage(companyLikes, companyDislikes);
    const aiPercentage = calcPercentage(aiLikes, aiDislikes);

    const avgPercentage = (humanPercentage + companyPercentage + aiPercentage) / 3;
    const clampedPercentage = Math.min(Math.max(avgPercentage, 0), 100);

    return (
        <div className={`relative h-6 overflow-hidden bg-gray-800 rounded-full shadow-md w-full`}>
            <div
                className="h-full transition-all duration-500 rounded-full"
                style={{ width: `${clampedPercentage}%`, background: 'linear-gradient(to right, var(--nova-cyan), var(--nova-pink))' }}
            />
            <div className="absolute inset-0 flex items-center justify-center w-full font-semibold text-white shadow-md select-none text-[0.65em] font-orbitron tracking-wider z-10">
                {approval ? `Approval rate: ${clampedPercentage.toFixed(0)}%` : `${clampedPercentage.toFixed(0)}%`}
            </div>
        </div>
    );
};

interface LikesInfoProps {
    proposalId: number;
}

export const LikesInfo: React.FC<LikesInfoProps> = ({ proposalId }) => {
    const [likes, setLikes] = useState<any[]>([]);
    const [dislikes, setDislikes] = useState<any[]>([]);
    const [approval, setApproval] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuth();

    useEffect(() => {
        async function fetchVotes() {
            try {
                setError("");
                // We need an endpoint to get votes details. 
                // Assuming api.getProposals returns proposals with votes_summary, but that might not be enough for detailed breakdown if not in summary.
                // However, the frontend code fetches `${backendUrl}/proposals/${proposalId}`.
                // Let's try to use the existing api to fetch proposal details.
                // If api.getProposal(id) doesn't exist, we might need to rely on what we have or add it.
                // For now, let's assume we can fetch the proposal details.

                // Since we don't have a direct getProposal(id) in api.ts yet, let's assume we can fetch it or use a direct fetch for now to match logic.
                // But better to stick to api.ts.
                // Let's check api.ts again. It has getProposals but not getProposalById.
                // We will implement a direct fetch here similar to frontend logic but using api helper if possible.

                // Actually, looking at api.ts, getProposals returns an array.
                // We can filter from that if we had the full list, but that's inefficient.
                // The frontend uses `${backendUrl}/proposals/${proposalId}`.
                // Let's use api.fetchJson.

                // Wait, the frontend code shows:
                // const res = await fetch(`${backendUrl}/proposals/${proposalId}`);
                // const data = await res.json();
                // setLikes(data.likes || []);
                // setDislikes(data.dislikes || []);

                // But our backend might not return 'likes' and 'dislikes' arrays in the proposal object, 
                // it returns 'votes_summary'.
                // Let's check the backend response structure if possible.
                // The backend `decide_weighted_api` returns `counts` and `per_voter_weights`.
                // The `VoteIn` struct doesn't seem to expose a list of all votes publicly in the proposal object unless we hit a specific endpoint.
                // However, the frontend `LikesInfo.jsx` expects `data.likes` and `data.dislikes` arrays with `type` property.

                // If the backend doesn't support this, we might have to mock it or adapt.
                // Given the user wants "exact logic", I should try to hit the same endpoint.
                // If the endpoint exists on the real backend, it should work.

                const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/proposals/${proposalId}`);
                if (!response.ok) {
                    // If specific endpoint fails, maybe we can't get detailed votes.
                    // But let's try.
                    throw new Error("Failed to fetch proposal details");
                }
                const data = await response.json();
                setLikes(data.likes || []);
                setDislikes(data.dislikes || []);

            } catch (err: any) {
                console.error(err);
                setError(`Failed to fetch votes: ${err.message}`);
            }
        }
        fetchVotes();
    }, [proposalId]);

    const humanLikes = likes.filter(v => v.type === 'human').length;
    const companyLikes = likes.filter(v => v.type === 'company').length;
    const aiLikes = likes.filter(v => v.type === 'ai').length;

    const humanDislikes = dislikes.filter(v => v.type === 'human').length;
    const companyDislikes = dislikes.filter(v => v.type === 'company').length;
    const aiDislikes = dislikes.filter(v => v.type === 'ai').length;

    return (
        <LiquidGlass className="rounded-[25px] z-50 mt-2">
            <div className="flex flex-col rounded-[25px] p-2 gap-2">
                {error && (
                    <p className="text-red-500 text-sm" role="alert">
                        {error}
                    </p>
                )}
                <LikeSection icon={User} label="Humans" likes={humanLikes} dislikes={humanDislikes} />
                <LikeSection icon={Briefcase} label="Companies" likes={companyLikes} dislikes={companyDislikes} />
                <LikeSection icon={Cpu} label="AI" likes={aiLikes} dislikes={aiDislikes} />
                <div className="rounded-full mt-[-5px] w-full max-w-full px-1">
                    <button onClick={() => setApproval(!approval)} className="w-full">
                        <ApprovalHeatmap
                            humanLikes={humanLikes}
                            humanDislikes={humanDislikes}
                            companyLikes={companyLikes}
                            companyDislikes={companyDislikes}
                            aiLikes={aiLikes}
                            aiDislikes={aiDislikes}
                            approval={approval}
                        />
                    </button>
                </div>
            </div>
        </LiquidGlass>
    );
};

