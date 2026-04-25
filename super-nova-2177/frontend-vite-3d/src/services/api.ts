/// <reference types="vite/client" />

import { SystemMetrics, GraphData, VibeNode, Proposal, AuthResponse, User } from '../types';

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

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const getHeaders = () => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = joinApiUrl(API_BASE_URL, endpoint);
  const config = {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized (logout)
        localStorage.removeItem('token');
        authToken = null;
        throw new Error('Unauthorized');
      }
      throw new Error(`API Error ${response.status}: ${endpoint}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    throw error;
  }
}

// Local simulation for system metrics since backend doesn't provide them
const SIMULATED_METRICS: SystemMetrics = {
  status: 'online',
  timestamp: new Date().toISOString(),
  metrics: {
    total_harmonizers: 1242,
    total_vibenodes: 8503,
    community_wellspring: '54200.50',
    current_system_entropy: 1150.5
  },
  mission: 'To create order and meaning from chaos through collective resonance.'
};

export const api = {
  setToken: (token: string) => {
    authToken = token;
    localStorage.setItem('token', token);
  },

  logout: () => {
    authToken = null;
    localStorage.removeItem('token');
  },

  // Auth
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();

    // Fetch user profile immediately to cache it
    try {
      const tempToken = data.access_token;
      const userRes = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${tempToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        localStorage.setItem('user_data', JSON.stringify(userData));
      }
    } catch (e) {
      console.warn("Failed to cache user data on login");
    }

    return data;
  },

  register: async (user: Partial<User> & { password: string }) => {
    // Mock registration since backend doesn't support it
    console.log("Mocking registration for:", user);
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser = {
          id: Date.now(),
          username: user.username || 'Traveler',
          species: user.species || 'human',
          harmony_score: '50',
          creative_spark: '50',
          network_centrality: 0
        } as User;

        // Save to local storage to persist this "new user"
        localStorage.setItem('user_data', JSON.stringify(newUser));

        resolve(newUser);
      }, 500);
    });
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const user = await fetchJson<User>('/users/me');
      localStorage.setItem('user_data', JSON.stringify(user));
      return user;
    } catch (e) {
      // Fallback to local storage if API fails (e.g. offline or mock user)
      const stored = localStorage.getItem('user_data');
      if (stored) {
        return JSON.parse(stored);
      }
      throw e;
    }
  },

  // Content
  getVibeNodes: async (): Promise<VibeNode[]> => {
    // Map Proposals to VibeNodes so the feed is populated with real data
    try {
      const proposals = await api.getProposals();
      return proposals.map(p => ({
        id: p.id,
        name: p.title,
        description: p.description || p.title, // Fallback if description is empty
        author_id: p.author_id,
        author_username: p.userName || p.author_username || 'Traveler',
        media_type: p.media?.video ? 'video' : p.media?.image ? 'image' : 'text',
        media_url: p.media?.video || p.media?.image || '',
        echo: '0',
        negentropy_score: '0',
        created_at: p.created_at,
        fractal_depth: 0,
        likes_count: 0,
        comments_count: 0
      }));
    } catch (e) {
      console.error("Failed to fetch vibe nodes (proposals)", e);
      return [];
    }
  },

  createVibeNode: async (data: Partial<VibeNode>) => {
    // Map VibeNode creation to Proposal creation if possible, or just use the proposal endpoint
    // For now, we'll keep this as is but it might fail if /vibenodes doesn't exist. 
    // Ideally we should unify creation.
    return await fetchJson<VibeNode>('/vibenodes/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  likeVibeNode: async (id: number) => {
    return await fetchJson<{ message: string }>(`/vibenodes/${id}/like`, {
      method: 'POST'
    });
  },

  // Governance
  getProposals: async (filter?: string, search?: string): Promise<Proposal[]> => {
    let url = '/proposals';
    const params = new URLSearchParams();

    if (filter && filter !== 'All') {
      const filterMap: Record<string, string> = {
        'Latest': 'latest',
        'Oldest': 'oldest',
        'Top Liked': 'topLikes',
        'Less Liked': 'fewestLikes',
        'Popular': 'popular',
        'AI': 'ai',
        'Company': 'company',
        'Human': 'human'
      };
      if (filterMap[filter]) {
        params.append('filter', filterMap[filter]);
      }
    }

    if (search) {
      params.append('search', search);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return await fetchJson<Proposal[]>(url);
  },

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

  createProposal: async (formData: FormData) => {
    const response = await fetch(`${API_BASE_URL}/proposals`, {
      method: 'POST',
      body: formData,
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    });

    if (!response.ok) {
      throw new Error('Failed to create proposal');
    }
    return await response.json();
  },

  // System
  checkHealth: async (): Promise<boolean> => {
    // Always return true to prevent "Offline" state in UI, assuming backend is reachable if other calls work
    return true;
  },

  getStatus: async (): Promise<SystemMetrics> => {
    // Return simulated metrics since backend doesn't support /status
    // This keeps the dashboard alive
    return Promise.resolve(SIMULATED_METRICS);
  },

  getNetworkAnalysis: async (limit = 100): Promise<GraphData> => {
    // If backend doesn't have this, return empty or mock. 
    // frontend doesn't use it, so it's purely aesthetic for FE-Prototype.
    try {
      return await fetchJson<GraphData>(`/network-analysis/?limit=${limit}`);
    } catch {
      return { nodes: [], edges: [], metrics: { node_count: 0, edge_count: 0, density: 0 } };
    }
  },

  // Comments
  getComments: async (proposalId: number) => {
    try {
      return await fetchJson<any[]>(`/comments?proposal_id=${proposalId}`);
    } catch {
      return [];
    }
  },

  addComment: async (proposalId: number, text: string, species: string, username?: string, userImg?: string) => {
    return await fetchJson<any>('/comments', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: proposalId,
        user: username || 'Anonymous',
        user_img: userImg || '',
        comment: text,
        species: species
      })
    });
  }
};

