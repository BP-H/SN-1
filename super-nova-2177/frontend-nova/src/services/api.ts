function normalizeBaseUrl(url?: string): string {
  return (url || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

function joinApiUrl(baseUrl: string, endpoint = ''): string {
  if (!endpoint) return baseUrl;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  if (!endpoint.startsWith('/')) return `${baseUrl}/${endpoint}`;
  return `${baseUrl}${endpoint}`;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);
export const CORE_API_BASE_URL = `${API_BASE_URL}/core`;

export function coreApiUrl(endpoint = ''): string {
  return joinApiUrl(CORE_API_BASE_URL, endpoint);
}

let authToken: string | null = localStorage.getItem('token');

export interface User {
  id: number;
  username: string;
  email?: string;
  species: 'human' | 'ai' | 'company';
  harmony_score?: string;
  creative_spark?: string;
  network_centrality?: number;
}

export interface Proposal {
  id: number;
  title: string;
  text: string;
  userName: string;
  userInitials: string;
  author_img?: string;
  time: string;
  author_type: string;
  likes: any[];
  dislikes: any[];
  comments: any[];
  media?: {
    image?: string;
    video?: string;
    link?: string;
    file?: string;
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

export interface GraphData {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; type: string; strength?: number }>;
  metrics: {
    node_count: number;
    edge_count: number;
    density: number;
  };
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(joinApiUrl(API_BASE_URL, endpoint), {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return await response.json();
}

export const api = {
  setToken: (token: string) => {
    authToken = token;
    localStorage.setItem('token', token);
  },

  logout: () => {
    authToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user_data');
  },

  // Auth
  login: async (username: string, password: string): Promise<{ access_token: string }> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const data = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      body: formData,
    });
    
    if (!data.ok) throw new Error('Login failed');
    return await data.json();
  },

  register: async (user: Partial<User> & { password: string }) => {
    return await fetchJson<User>('/users/register', {
      method: 'POST',
      body: JSON.stringify({
        username: user.username,
        password: user.password,
        email: user.email || `${user.username || 'traveler'}@local.supernova`,
        species: user.species || 'human',
      })
    });
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const user = await fetchJson<User>('/users/me');
      localStorage.setItem('user_data', JSON.stringify(user));
      return user;
    } catch (e) {
      const stored = localStorage.getItem('user_data');
      if (stored) return JSON.parse(stored);
      throw e;
    }
  },

  // Proposals
  getProposals: async (filter?: string, search?: string): Promise<Proposal[]> => {
    const params = new URLSearchParams();
    if (filter && filter !== 'All') params.append('filter', filter.toLowerCase());
    if (search) params.append('search', search);
    
    const queryString = params.toString();
    const url = queryString ? `/proposals?${queryString}` : '/proposals';
    return await fetchJson<Proposal[]>(url);
  },

  getStatus: async (): Promise<SystemMetrics> => {
    return await fetchJson<SystemMetrics>('/status');
  },

  getNetworkAnalysis: async (limit = 50): Promise<GraphData> => {
    return await fetchJson<GraphData>(`/network-analysis/?limit=${limit}`);
  },

  createProposal: async (formData: FormData) => {
    const response = await fetch(`${API_BASE_URL}/proposals`, {
      method: 'POST',
      body: formData,
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    });

    if (!response.ok) throw new Error('Failed to create proposal');
    return await response.json();
  },

  // Voting
  voteProposal: async (proposalId: number, vote: 'up' | 'down', species: string, username: string) => {
    return await fetchJson<any>('/votes', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: proposalId,
        choice: vote,
        voter_type: species,
        username: username
      })
    });
  },

  removeVote: async (proposalId: number, username: string) => {
    return await fetchJson<any>(`/votes?proposal_id=${proposalId}&username=${username}`, {
      method: 'DELETE'
    });
  },

  // Comments
  getComments: async (proposalId: number) => {
    return await fetchJson<any[]>(`/comments?proposal_id=${proposalId}`);
  },

  addComment: async (proposalId: number, text: string, species: string, username: string, userImg: string = '') => {
    return await fetchJson<any>('/comments', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: proposalId,
        user: username,
        user_img: userImg,
        comment: text,
        species: species
      })
    });
  }
};
