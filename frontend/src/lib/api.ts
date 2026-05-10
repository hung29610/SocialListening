import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const auth = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
    }
    
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('access_token');
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Keywords
export const keywords = {
  listGroups: async () => {
    const response = await api.get('/api/keywords/groups');
    return response.data;
  },
  
  createGroup: async (data: any) => {
    const response = await api.post('/api/keywords/groups', data);
    return response.data;
  },
  
  createKeyword: async (data: any) => {
    const response = await api.post('/api/keywords/keywords', data);
    return response.data;
  },
  
  updateKeyword: async (id: number, data: any) => {
    const response = await api.put(`/api/keywords/keywords/${id}`, data);
    return response.data;
  },
  
  deleteKeyword: async (id: number) => {
    const response = await api.delete(`/api/keywords/keywords/${id}`);
    return response.data;
  },
  
  listKeywordsInGroup: async (groupId: number) => {
    const response = await api.get(`/api/keywords/groups/${groupId}/keywords`);
    return response.data;
  },
};

// Sources
export const sources = {
  list: async () => {
    const response = await api.get('/api/sources');
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/api/sources', data);
    return response.data;
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/api/sources/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/sources/${id}`);
    return response.data;
  },
};

// Crawl
export const crawl = {
  manual: async (data: { source_ids: number[]; keyword_group_ids: number[] }) => {
    const response = await api.post('/api/crawl/manual', data);
    return response.data;
  },
};

// Mentions
export const mentions = {
  list: async (params?: any) => {
    const response = await api.get('/api/mentions', { params });
    return response.data;
  },
  
  get: async (id: number) => {
    const response = await api.get(`/api/mentions/${id}`);
    return response.data;
  },
};

// Alerts
export const alerts = {
  list: async (params?: any) => {
    const response = await api.get('/api/alerts', { params });
    return response.data;
  },
  
  acknowledge: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/acknowledge`);
    return response.data;
  },
  
  resolve: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/resolve`, {});
    return response.data;
  },
};

// Incidents
export const incidents = {
  list: async (params?: any) => {
    const response = await api.get('/api/incidents', { params });
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/api/incidents', data);
    return response.data;
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/api/incidents/${id}`, data);
    return response.data;
  },
};

// Dashboard
export const dashboard = {
  get: async (days?: number) => {
    const response = await api.get('/api/dashboard', { params: { days } });
    return response.data;
  },
};
