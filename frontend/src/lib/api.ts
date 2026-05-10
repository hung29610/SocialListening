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
  
  register: async (email: string, password: string, full_name: string) => {
    const response = await api.post('/api/auth/register', {
      email,
      password,
      full_name
    });
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

// Dashboard
export const dashboard = {
  get: async () => {
    const response = await api.get('/api/dashboard');
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

// Crawl/Scan
export const crawl = {
  manualScan: async (data: { keyword_group_ids: number[]; source_ids?: number[]; url?: string }) => {
    const response = await api.post('/api/crawl/manual-scan', data);
    return response.data;
  },
  
  getScanHistory: async (page: number = 1, page_size: number = 20) => {
    const response = await api.get('/api/crawl/scan-history', { params: { page, page_size } });
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
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/mentions/${id}`);
    return response.data;
  },
};

// Alerts
export const alerts = {
  list: async (params?: any) => {
    const response = await api.get('/api/alerts', { params });
    return response.data;
  },
  
  get: async (id: number) => {
    const response = await api.get(`/api/alerts/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/api/alerts', data);
    return response.data;
  },
  
  acknowledge: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/acknowledge`);
    return response.data;
  },
  
  resolve: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/resolve`);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/alerts/${id}`);
    return response.data;
  },
};

// Incidents
export const incidents = {
  list: async (params?: any) => {
    const response = await api.get('/api/incidents', { params });
    return response.data;
  },
  
  get: async (id: number) => {
    const response = await api.get(`/api/incidents/${id}`);
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
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/incidents/${id}`);
    return response.data;
  },
  
  getLogs: async (id: number) => {
    const response = await api.get(`/api/incidents/${id}/logs`);
    return response.data;
  },
};

// Services
export const services = {
  // Categories
  listCategories: async () => {
    const response = await api.get('/api/services/categories');
    return response.data;
  },
  
  createCategory: async (data: any) => {
    const response = await api.post('/api/services/categories', data);
    return response.data;
  },
  
  updateCategory: async (id: number, data: any) => {
    const response = await api.put(`/api/services/categories/${id}`, data);
    return response.data;
  },
  
  deleteCategory: async (id: number) => {
    const response = await api.delete(`/api/services/categories/${id}`);
    return response.data;
  },
  
  // Services
  list: async (params?: any) => {
    const response = await api.get('/api/services', { params });
    return response.data;
  },
  
  get: async (id: number) => {
    const response = await api.get(`/api/services/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/api/services', data);
    return response.data;
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/api/services/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/services/${id}`);
    return response.data;
  },
  
  // Service Requests
  listRequests: async (params?: any) => {
    const response = await api.get('/api/services/requests', { params });
    return response.data;
  },
  
  getRequest: async (id: number) => {
    const response = await api.get(`/api/services/requests/${id}`);
    return response.data;
  },
  
  createRequest: async (data: any) => {
    const response = await api.post('/api/services/requests', data);
    return response.data;
  },
  
  updateRequest: async (id: number, data: any) => {
    const response = await api.put(`/api/services/requests/${id}`, data);
    return response.data;
  },
  
  submitRequest: async (id: number, data?: any) => {
    const response = await api.post(`/api/services/requests/${id}/submit`, data || {});
    return response.data;
  },
  
  approveRequest: async (id: number, data?: any) => {
    const response = await api.post(`/api/services/requests/${id}/approve`, data || {});
    return response.data;
  },
  
  rejectRequest: async (id: number, data: any) => {
    const response = await api.post(`/api/services/requests/${id}/reject`, data);
    return response.data;
  },
  
  completeRequest: async (id: number, data: any) => {
    const response = await api.post(`/api/services/requests/${id}/complete`, data);
    return response.data;
  },
  
  cancelRequest: async (id: number, data: any) => {
    const response = await api.post(`/api/services/requests/${id}/cancel`, data);
    return response.data;
  },
  
  // Service Request Logs
  getRequestLogs: async (id: number) => {
    const response = await api.get(`/api/services/requests/${id}/logs`);
    return response.data;
  },
  
  createRequestLog: async (id: number, data: any) => {
    const response = await api.post(`/api/services/requests/${id}/logs`, data);
    return response.data;
  },
  
  // Service Deliverables
  getDeliverables: async (id: number) => {
    const response = await api.get(`/api/services/requests/${id}/deliverables`);
    return response.data;
  },
  
  createDeliverable: async (id: number, data: any) => {
    const response = await api.post(`/api/services/requests/${id}/deliverables`, data);
    return response.data;
  },
  
  updateDeliverable: async (id: number, data: any) => {
    const response = await api.put(`/api/services/deliverables/${id}`, data);
    return response.data;
  },
  
  // Dashboard
  getDashboardSummary: async () => {
    const response = await api.get('/api/services/dashboard-summary');
    return response.data;
  },
};
