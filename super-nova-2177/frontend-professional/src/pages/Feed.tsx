import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Proposal, VibeNode } from '../types';
import { PostCard } from '../components/PostCard';
import { CreatePostWidget } from '../components/CreatePostWidget';
import { Loader2 } from 'lucide-react';

export const Feed: React.FC = () => {
    const [items, setItems] = useState<(Proposal | VibeNode)[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const proposals = await api.getProposals();
                // Sort by date, newest first
                const sorted = proposals.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setItems(sorted);
            } catch (error) {
                console.error("Failed to fetch feed", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center pt-10">
                <Loader2 className="animate-spin text-professional-blue" size={32} />
            </div>
        );
    }

    return (
        <div className="pb-4">
            <CreatePostWidget />

            {/* Sort Divider */}
            <div className="flex items-center gap-1 px-4 py-2 mb-2">
                <div className="h-[1px] bg-gray-300 flex-1"></div>
                <span className="text-xs text-gray-500">Sort by: <span className="font-bold text-gray-700">Top</span></span>
            </div>

            <div className="space-y-2">
                {items.map((item) => (
                    <PostCard
                        key={'title' in item ? `p-${item.id}` : `v-${item.id}`}
                        item={item}
                        type={'title' in item ? 'proposal' : 'vibe'}
                    />
                ))}
            </div>
        </div>
    );
};
