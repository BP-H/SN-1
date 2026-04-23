import React, { useState } from 'react';
import { ArrowBigUp, ArrowBigDown, Users, Cpu, Briefcase } from 'lucide-react';
import { api } from '../services/api';
import { VoteSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { SPECIES_WEIGHTS } from '../constants';

interface VoteControlProps {
   proposalId: number;
   summary: VoteSummary;
   initialUserVote?: 'up' | 'down' | null;
}

export const VoteControl: React.FC<VoteControlProps> = ({ proposalId, summary, initialUserVote }) => {
   const { user } = useAuth();
   const [userVote, setUserVote] = useState(initialUserVote);
   const [isVoting, setIsVoting] = useState(false);

   // Calculate raw totals
   const humanUp = summary.up_human || 0;
   const humanDown = summary.down_human || 0;
   const aiUp = summary.up_ai || 0;
   const aiDown = summary.down_ai || 0;
   const companyUp = summary.up_company || 0;
   const companyDown = summary.down_company || 0;

   // Calculate weighted score
   const calculateWeightedScore = () => {
      const activeSpecies = [];
      if (humanUp + humanDown > 0) activeSpecies.push('human');
      if (aiUp + aiDown > 0) activeSpecies.push('ai');
      if (companyUp + companyDown > 0) activeSpecies.push('company');

      if (activeSpecies.length === 0) return 0;

      // Calculate share per species (1 / N active species)
      // Assuming equal weights for now as per SPECIES_WEIGHTS
      const totalWeight = activeSpecies.reduce((sum, s) => sum + SPECIES_WEIGHTS[s as keyof typeof SPECIES_WEIGHTS], 0);

      let weightedUp = 0;
      let weightedDown = 0;

      if (activeSpecies.includes('human')) {
         const count = humanUp + humanDown;
         if (count > 0) {
            const share = SPECIES_WEIGHTS.human / totalWeight;
            weightedUp += (humanUp / count) * share;
            weightedDown += (humanDown / count) * share;
         }
      }
      if (activeSpecies.includes('ai')) {
         const count = aiUp + aiDown;
         if (count > 0) {
            const share = SPECIES_WEIGHTS.ai / totalWeight;
            weightedUp += (aiUp / count) * share;
            weightedDown += (aiDown / count) * share;
         }
      }
      if (activeSpecies.includes('company')) {
         const count = companyUp + companyDown;
         if (count > 0) {
            const share = SPECIES_WEIGHTS.company / totalWeight;
            weightedUp += (companyUp / count) * share;
            weightedDown += (companyDown / count) * share;
         }
      }

      // Return net score (Up - Down) scaled to 100 for display
      return Math.round((weightedUp - weightedDown) * 100);
   };

   const weightedScore = calculateWeightedScore();

   const handleVote = async (direction: 'up' | 'down') => {
      if (!user || isVoting) return;
      setIsVoting(true);

      // Optimistic update
      const previousVote = userVote;
      setUserVote(direction === previousVote ? null : direction);

      try {
         if (userVote === direction) {
            // Toggle off (remove vote)
            await api.removeVote(proposalId, user.username);
            setUserVote(null);
         } else {
            await api.voteProposal(proposalId, direction, user.species, user.username);
            setUserVote(direction);
         }
      } catch (e) {
         console.error("Vote failed", e);
         // Revert on failure
         setUserVote(previousVote);
      } finally {
         setIsVoting(false);
      }
   };

   return (
      <div className="flex flex-col gap-2">
         {/* Visual Bar */}
         <div className="h-1.5 w-full bg-white/10 rounded-full flex overflow-hidden">
            <div style={{ flex: Math.max(0, humanUp - humanDown) }} className="bg-nova-pink shadow-[0_0_10px_var(--nova-pink)]"></div>
            <div style={{ flex: Math.max(0, aiUp - aiDown) }} className="bg-nova-acid shadow-[0_0_10px_var(--nova-acid)]"></div>
            <div style={{ flex: Math.max(0, companyUp - companyDown) }} className="bg-nova-purple shadow-[0_0_10px_var(--nova-purple)]"></div>
         </div>

         <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1">
               <button
                  onClick={() => handleVote('up')}
                  className={`p-1 rounded hover:bg-white/10 transition-colors ${userVote === 'up' ? 'text-nova-acid' : 'text-gray-400'}`}
               >
                  <ArrowBigUp size={24} className={userVote === 'up' ? 'fill-nova-acid' : ''} />
               </button>
               <span className={`text-xl font-bold font-orbitron ${weightedScore >= 0 ? 'text-white' : 'text-red-500'}`} title="Weighted Harmony Score">
                  {weightedScore}%
               </span>
               <button
                  onClick={() => handleVote('down')}
                  className={`p-1 rounded hover:bg-white/10 transition-colors ${userVote === 'down' ? 'text-red-500' : 'text-gray-400'}`}
               >
                  <ArrowBigDown size={24} className={userVote === 'down' ? 'fill-red-500' : ''} />
               </button>
            </div>

            {/* Breakdown Species Icons */}
            <div className="flex gap-3 text-xs font-mono text-gray-500">
               <div className="flex items-center gap-1" title="Human Score">
                  <Users size={12} className={humanUp > humanDown ? "text-nova-pink" : ""} /> {humanUp - humanDown}
               </div>
               <div className="flex items-center gap-1" title="AI Score">
                  <Cpu size={12} className={aiUp > aiDown ? "text-nova-acid" : ""} /> {aiUp - aiDown}
               </div>
               <div className="flex items-center gap-1" title="Company Score">
                  <Briefcase size={12} className={companyUp > companyDown ? "text-nova-purple" : ""} /> {companyUp - companyDown}
               </div>
            </div>
         </div>
      </div>
   );
};
