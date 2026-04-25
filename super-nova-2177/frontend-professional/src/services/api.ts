/// <reference types="vite/client" />

import type { SystemMetrics, GraphData, VibeNode, Proposal, AuthResponse, User } from '../types';

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

const getHeaders = (optionsHeaders?: HeadersInit): HeadersInit => {
  const headers: HeadersInit = {
    ...(optionsHeaders || {}),
  };

  if (!(optionsHeaders instanceof FormData) && !('Content-Type' in (headers as Record<string, string>))) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.message || fallback;
  } catch {
    try {
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = joinApiUrl(API_BASE_URL, endpoint);
  const response = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      authToken = null;
    }
    throw new Error(await readError(response, `API Error ${response.status}: ${endpoint}`));
  }

  return await response.json();
}

function mapProposalToVibeNode(proposal: Proposal): VibeNode {
  const likesCount = Array.isArray(proposal.likes) ? proposal.likes.length : 0;
  return {
    id: proposal.id,
    name: proposal.title,
    description: proposal.description || proposal.title,
    author_id: proposal.author_id,
    author_username: proposal.userName || proposal.author_username || 'Traveler',
    media_type: proposal.media?.video ? 'video' : proposal.media?.image ? 'image' : 'text',
    media_url: proposal.media?.video || proposal.media?.image || proposal.video || proposal.image || '',
    echo: String(likesCount),
    negentropy_score: '0',
    created_at: proposal.created_at,
    fractal_depth: 0,
    likes_count: likesCount,
    comments_count: Array.isArray(proposal.comments) ? proposal.comments.length : 0,
  };
}

export const api = {
  setToken: (token: string) => {
    authToken = token;
    localStorage.setItem('token', token);
  },

  logout: () => {
    authToken = null;
    localStorage.removeItem('token');
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readError(response, 'Login failed'));
    }

    const data = await response.json();
    const token = data.access_token;
    if (token) {
      authToken = token;
      localStorage.setItem('token', token);
      try {
        const user = await fetchJson<User>('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        localStorage.setItem('user_data', JSON.stringify(user));
      } catch {
        // The login still succeeded; the app can fetch the user later.
      }
    }
    return data;
  },

  register: async (user: Partial<User> & { password: string }) => {
    const payload = {
      username: user.username,
      password: user.password,
      email: user.email || `${user.username || 'traveler'}@local.supernova`,
      species: user.species || 'human',
      bio: user.bio || '',
    };
    const created = await fetchJson<User>('/users/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    localStorage.setItem('user_data', JSON.stringify(created));
    return created;
  },

  getCurrentUser: async (): Promise<User> => {
    const user = await fetchJson<User>('/users/me');
    localStorage.setItem('user_data', JSON.stringify(user));
    return user;
  },

  getVibeNodes: async (): Promise<VibeNode[]> => {
    const proposals = await api.getProposals();
    return proposals.map(mapProposalToVibeNode);
  },

  createVibeNode: async (data: Partial<VibeNode>) => {
    const formData = new FormData();
    formData.append('title', data.name || 'Untitled resonance');
    formData.append('description', data.description || '');
    formData.append('userName', data.author_username || 'Traveler');
    formData.append('userInitials', (data.author_username || 'TR').slice(0, 2).toUpperCase());
    formData.append('author_type', 'human');
    if (data.media_type === 'image' && data.media_url) {
      formData.append('image', data.media_url);
    }
    if (data.media_type === 'video' && data.media_url) {
      formData.append('video', data.media_url);
    }
    const created = await api.createProposal(formData);
    return mapProposalToVibeNode(created as Proposal);
  },

  likeVibeNode: async (id: number, species = 'human', username = 'Traveler') => {
    return await fetchJson<any>('/votes', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: id,
        choice: 'up',
        voter_type: species,
        username,
      }),
    });
  },

  getProposals: async (filter?: string, search?: string): Promise<Proposal[]> => {
    let url = '/proposals';
    const params = new URLSearchParams();

    if (filter && filter !== 'All') {
      const filterMap: Record<string, string> = {
        Latest: 'latest',
        Oldest: 'oldest',
        'Top Liked': 'topLikes',
        'Less Liked': 'fewestLikes',
        Popular: 'popular',
        AI: 'ai',
        Company: 'company',
        Human: 'human',
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
        username,
      }),
    });
  },

  removeVote: async (proposalId: number, username: string) => {
    return await fetchJson<any>(`/votes?proposal_id=${proposalId}&username=${username}`, {
      method: 'DELETE',
    });
  },

  createProposal: async (formData: FormData) => {
    const response = await fetch(`${API_BASE_URL}/proposals`, {
      method: 'POST',
      body: formData,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    if (!response.ok) {
      throw new Error(await readError(response, 'Failed to create proposal'));
    }
    return await response.json();
  },

  checkHealth: async (): Promise<boolean> => {
    try {
      const result = await fetchJson<{ ok?: boolean }>('/health');
      return !!result.ok;
    } catch {
      return false;
    }
  },

  getStatus: async (): Promise<SystemMetrics> => {
    return await fetchJson<SystemMetrics>('/status');
  },

  getNetworkAnalysis: async (limit = 100): Promise<GraphData> => {
    return await fetchJson<GraphData>(`/network-analysis/?limit=${limit}`);
  },

  getComments: async (proposalId: number) => {
    return await fetchJson<any[]>(`/comments?proposal_id=${proposalId}`);
  },

  addComment: async (proposalId: number, text: string, species: string, username?: string, userImg?: string) => {
    return await fetchJson<any>('/comments', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: proposalId,
        user: username || 'Anonymous',
        user_img: userImg || '',
        comment: text,
        species,
      }),
    });
  },
};
