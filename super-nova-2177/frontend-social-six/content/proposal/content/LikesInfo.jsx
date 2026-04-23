"use client";
import { useEffect, useState } from "react";
import LiquidGlass from '@/content/liquid glass/LiquidGlass';
import { BiSolidLike, BiSolidDislike } from 'react-icons/bi';
import { FaUser, FaBriefcase } from 'react-icons/fa';
import { BsFillCpuFill } from 'react-icons/bs';
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";

function LikeSection({ icon: Icon, label, likes, dislikes }) {
  
  return (
    <LiquidGlass className="rounded-full">
      <div className="flex rounded-[30px] px-1 py-1 w-70 justify-between items-center gap-3">
        <Icon className="rounded-full bg-[var(--gray)] w-20 p-0.5" />
        <p className="text-[0.6em] w-full">{label}</p>
        <div className="flex text-[var(--text-black)] text-[0.6em] bg-[var(--gray)] shadow-md w-fit gap-2 rounded-full px-1 py-1 items-center justify-between">
          <button className="flex items-center justify-center gap-1 rounded-full px-2 py-0 h-[30px] cursor-pointer">
            <BiSolidLike />
            <p className="h-fit">{likes}</p>
          </button>
          <button className="flex items-center justify-center gap-1 rounded-full px-2 h-[30px] py-0 cursor-pointer">
            <BiSolidDislike />
            <p className="h-fit">{dislikes}</p>
          </button>
        </div>
      </div>
    </LiquidGlass>
  );
}

function ApprovalHeatmap({ humanLikes, humanDislikes, companyLikes, companyDislikes, aiLikes, aiDislikes, approval }) {
  const calcPercentage = (likes, dislikes) => {
    const total = likes + dislikes;
    return total === 0 ? 0 : (likes / total) * 100;
  };

  const humanPercentage = calcPercentage(humanLikes, humanDislikes);
  const companyPercentage = calcPercentage(companyLikes, companyDislikes);
  const aiPercentage = calcPercentage(aiLikes, aiDislikes);

  const avgPercentage = (humanPercentage + companyPercentage + aiPercentage) / 3;
  const clampedPercentage = Math.min(Math.max(avgPercentage, 0), 100);

  return (
    <div className={`relative h-6 overflow-hidden bg-gray-300 rounded-full shadow-md`}>
      <div
        className="w-full h-full transition-all duration-500 rounded-full"
        style={{ width: `${clampedPercentage}%`, background: 'linear-gradient(to right, var(--blue), var(--pink))' }}
      />
      <div className="absolute inset-0 flex items-center justify-center w-full font-semibold text-white shadow-md select-none text-[0.45em]">
        {approval ? `Approval rate: ${clampedPercentage.toFixed(0)}%` : `${clampedPercentage.toFixed(0)}%`}
      </div>
    </div>
  );
}

function LikesInfo({ proposalId }) {
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [approval, setApproval] = useState(false);
  const [error, setError] = useState("");
  const { userData } = useUser();
  const backendUrl = userData?.activeBackend || API_BASE_URL;

  useEffect(() => {
    async function fetchVotes() {
      if (!backendUrl) {
        setError("API base URL is not configured.");
        return;
      }

      try {
        setError("");
        const res = await fetch(`${backendUrl}/proposals/${proposalId}`);
        if (!res.ok) {
          setError(`Failed to load proposal: ${res.status} ${res.statusText}`);
          return;
        }

        const data = await res.json();
        setLikes(data.likes || []);
        setDislikes(data.dislikes || []);
      } catch (err) {
        setError(`Failed to fetch likes/dislikes: ${err.message}`);
      }
    }
    fetchVotes();
  }, [backendUrl, proposalId]);

  const humanLikes = likes.filter(v => v.type === 'human').length;
  const companyLikes = likes.filter(v => v.type === 'company').length;
  const aiLikes = likes.filter(v => v.type === 'ai').length;

  const humanDislikes = dislikes.filter(v => v.type === 'human').length;
  const companyDislikes = dislikes.filter(v => v.type === 'company').length;
  const aiDislikes = dislikes.filter(v => v.type === 'ai').length;

  return (
    <LiquidGlass className={"rounded-[25px] z-999"}>
      <div className="flex flex-col rounded-[25px] p-2 gap-2">
        {error && (
          <p className="text-red-500 text-sm" role="alert">
            {error}
          </p>
        )}
        <LikeSection icon={FaUser} label="Humans" likes={humanLikes} dislikes={humanDislikes} />
        <LikeSection icon={FaBriefcase} label="Companies" likes={companyLikes} dislikes={companyDislikes} />
        <LikeSection icon={BsFillCpuFill} label="AI" likes={aiLikes} dislikes={aiDislikes} />
        <LiquidGlass className="rounded-full mt-[-10px] w-full max-w-full">
          <button onClick={() => setApproval(!approval)} className="p-1 w-70">
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
        </LiquidGlass>
      </div>
    </LiquidGlass>
  );
}

export default LikesInfo;
