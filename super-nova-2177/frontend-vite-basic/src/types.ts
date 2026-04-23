
export type Species = 'human' | 'ai' | 'company';

export interface User {
  id: number;
  username: string;
  email?: string;
  species: Species;
  harmony_score: string;
  creative_spark: string;
  network_centrality: number;
  avatar?: string; // Frontend helper
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User; // Helper if backend returns user on login
}

export interface VibeNode {
  id: number;
  name: string;
  description: string;
  author_id: number | string;
  author_username: string;
  media_type: 'text' | 'image' | 'video' | 'audio' | 'mixed';
  media_url?: string;
  echo: string;
  negentropy_score: string;
  tags?: string[];
  created_at: string;
  fractal_depth: number;
  likes_count: number;
  comments_count: number;
  down_ai?: number;
  up_company?: number;
  down_company?: number;
}

export interface VoteSummary {
  up_human?: number;
  down_human?: number;
  up_ai?: number;
  down_ai?: number;
  up_company?: number;
  down_company?: number;
  [key: string]: number | undefined;
}

export interface Comment {
  id: number;
  proposal_id: number;
  user_id: number;
  user: string;
  user_img?: string;
  species: string;
  comment: string;
  created_at: string;
}

export interface Proposal {
  id: number;
  title: string;
  description: string;
  author_id: number;
  author_username?: string;
  userName?: string; // Backend field
  userInitials?: string; // Backend field
  author_type?: 'human' | 'ai' | 'company'; // Backend field
  author_img?: string; // Backend field
  status: 'active' | 'passed' | 'rejected';
  created_at: string;
  voting_deadline?: string;
  votes_summary: VoteSummary;
  media?: {
    image?: string;
    video?: string;
    link?: string;
    file?: string;
  };
  image?: string;
  video?: string;
  link?: string;
  file?: string;
  comments: Comment[];

  // Frontend specific fields for compatibility
  likes?: any[];
  dislikes?: any[];
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'harmonizer' | 'vibenode' | 'proposal';
  echo?: number;
  degree_centrality?: number;
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  type: string;
  strength?: number;
}

export interface GraphData {
  nodes: NetworkNode[];
  edges: NetworkLink[];
  metrics: {
    node_count: number;
    edge_count: number;
    density: number;
  };
}

export interface SystemMetrics {
  status: string;
  timestamp: string;
  metrics: {
    total_harmonizers: number;
    total_vibenodes: number;
    community_wellspring: string;
    current_system_entropy: number;
  };
  mission: string;
}
