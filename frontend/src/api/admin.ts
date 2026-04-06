import axios from 'axios';

// Dedicated axios instance for admin API — always injects admin token from store
const adminClient = axios.create({ baseURL: '', timeout: 60000 });

adminClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('feiye-admin');
    const token = raw ? JSON.parse(raw)?.state?.accessToken : null;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch { /* ignore */ }
  return config;
});

export const adminApi = {
  login: (username: string, password: string) =>
    adminClient.post('/api/admin/login', { username, password }),

  getStats: () =>
    adminClient.get('/api/admin/stats'),

  listUsers: (params?: { page?: number; per_page?: number; search?: string }) =>
    adminClient.get('/api/admin/users', { params }),

  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    adminClient.put(`/api/admin/users/${id}`, data),

  adjustPoints: (id: number, amount: number, description?: string) =>
    adminClient.post(`/api/admin/users/${id}/points`, { amount, description }),

  activateSubscription: (id: number, plan: 'monthly' | 'yearly') =>
    adminClient.post(`/api/admin/users/${id}/subscribe`, { plan }),

  listSubscriptions: (params?: { page?: number; per_page?: number; status?: string }) =>
    adminClient.get('/api/admin/subscriptions', { params }),

  listTransactions: (params?: { page?: number; per_page?: number; user_id?: number }) =>
    adminClient.get('/api/admin/transactions', { params }),
};
