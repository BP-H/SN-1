import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, ChevronUp, X } from 'lucide-react';
import { LikesInfo } from "./LikesInfo";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";

interface LikesDeslikesProps {
    initialLikes: number;
    initialDislikes: number;
    initialClicked?: 'like' | 'dislike' | null;
    proposalId: number;
    setErrorMsg?: (msg: string | null) => void;
    className?: string;
}

export const LikesDeslikes: React.FC<LikesDeslikesProps> = ({
    initialLikes,
    initialDislikes,
    initialClicked = null,
    proposalId,
    setErrorMsg,
    className
}) => {
    const [clicked, setClicked] = useState<'like' | 'dislike' | null>(initialClicked);
    const [likes, setLikes] = useState(initialLikes);
    const [dislikes, setDislikes] = useState(initialDislikes);
    const [action, setAction] = useState(false);
    const { user } = useAuth();

    const validateProfile = () => {
        if (!user) {
            if (setErrorMsg) setErrorMsg("You must be logged in to vote.");
            return false;
        }
        if (!user.species) {
            if (setErrorMsg) setErrorMsg("Please select a species in your profile before voting.");
            return false;
        }
        return true;
    };

    async function sendVote(choice: 'up' | 'down') {
        if (!user) return false;
        try {
            await api.voteProposal(proposalId, choice, user.species, user.username);
            return true;
        } catch (error: any) {
            if (setErrorMsg) setErrorMsg(`Failed to send vote: ${error.message}`);
            return false;
        }
    }

    async function removeVote() {
        if (!user) return false;
        try {
            await api.removeVote(proposalId, user.username);
            return true;
        } catch (error: any) {
            if (setErrorMsg) setErrorMsg(`Failed to remove vote: ${error.message}`);
            return false;
        }
    }

    const handleLikeClick = async () => {
        if (!validateProfile()) return;

        if (clicked === "like") {
            const removed = await removeVote();
            if (removed) {
                setLikes(likes - 1);
                setClicked(null);
            }
        } else {
            // Switching from dislike → like: remove old vote first
            if (clicked === "dislike") {
                const removed = await removeVote();
                if (!removed) return;
                setDislikes(dislikes - 1);
            }
            const success = await sendVote("up");
            if (!success) return;
            setLikes(likes + 1);
            setClicked("like");
        }
    };

    const handleDislikeClick = async () => {
        if (!validateProfile()) return;

        if (clicked === "dislike") {
            const removed = await removeVote();
            if (removed) {
                setDislikes(dislikes - 1);
                setClicked(null);
            }
        } else {
            // Switching from like → dislike: remove old vote first
            if (clicked === "like") {
                const removed = await removeVote();
                if (!removed) return;
                setLikes(likes - 1);
            }
            const success = await sendVote("down");
            if (!success) return;
            setDislikes(dislikes + 1);
            setClicked("dislike");
        }
    };

    return (
        <>
            <div className="flex text-[#1e1e1e] bg-[#f0f1f6] shadow-md w-fit gap-2 rounded-full px-1 py-1 items-center justify-between backdrop-blur-sm border border-white/5">
                <button
                    onClick={handleLikeClick}
                    style={{
                        color: clicked === "like" ? "white" : "#1e1e1e",
                        background: clicked === "like" ? "#ff375f" : "transparent",
                        boxShadow: clicked === "like" ? "0 0 7px #ff375f" : "none",
                    }}
                    className={`flex items-center justify-center gap-1 rounded-full px-2 py-0 h-[30px] cursor-pointer transition-all hover:bg-black/5`}
                >
                    <ThumbsUp size={16} />
                    <p className="h-fit font-bold">{likes}</p>
                </button>
                <button
                    onClick={handleDislikeClick}
                    style={{
                        color: clicked === "dislike" ? "white" : "#1e1e1e",
                        background: clicked === "dislike" ? "#7ec5f3" : "transparent",
                        boxShadow: clicked === "dislike" ? "0 0 7px #3562c5" : "none",
                    }}
                    className={`flex items-center justify-center gap-1 rounded-full px-2 h-[30px] py-0 cursor-pointer transition-all hover:bg-black/5`}
                >
                    <ThumbsDown size={16} />
                    <p className="h-fit font-bold">{dislikes}</p>
                </button>
                {action ? (
                    <button
                        onClick={() => setAction(false)}
                        className="text-[#1e1e1e] rounded-full h-[30px] w-[30px] bg-black/5 flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                ) : (
                    <button
                        onClick={() => setAction(true)}
                        className="text-[#1e1e1e] rounded-full h-[30px] w-[30px] bg-black/5 flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors"
                    >
                        <ChevronUp size={16} />
                    </button>
                )}
            </div>
            <div className={`absolute ${className ? "-top-[-45px]" : "-top-55 md:-top-55 lg:-top-55 xl:-top-55"} left-0 right-0 z-50`}>
                {action ? (
                    <LikesInfo
                        proposalId={proposalId}
                    />
                ) : (
                    ""
                )}
            </div>
        </>
    );
};
