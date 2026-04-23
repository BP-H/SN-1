
import React from 'react';
import { VibeNode } from '../types';
import { PostCard } from './PostCard';

interface VibeFeedProps {
  nodes: VibeNode[];
}

export const VibeFeed: React.FC<VibeFeedProps> = ({ nodes }) => {
  if (nodes.length === 0) {
      return <div className="text-gray-500 font-mono text-sm p-4 border border-white/10 rounded-xl">No VibeNodes detected in the current sector.</div>
  }

  return (
    <div className="space-y-6">
      {nodes.map(node => (
          <PostCard key={node.id} item={node} type="vibe" />
      ))}
    </div>
  );
};
