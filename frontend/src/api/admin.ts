import apiClient from './client';

export const adminApi = {
  getStats: () =>
    apiClient.get('/api/admin/stats'),

  listUsers: (params?: { page?: number; per_page?: number; search?: string }) =>
    apiClient.get('/api/admin/users', { params }),

  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    apiClient.put(`/api/admin/users/${id}`, data),

  adjustPoints: (id: number, amount: number, description?: string) =>
    apiClient.post(`/api/admin/users/${id}/points`, { amount, description }),

  activateSubscription: (id: number, plan: 'monthly' | 'yearly') =>
    apiClient.post(`/api/admin/users/${id}/subscribe`, { plan }),

  listSubscriptions: (params?: { page?: number; per_page?: number; status?: string }) =>
    apiClient.get('/api/admin/subscriptions', { params }),

  listTransactions: (params?: { page?: number; per_page?: number; user_id?: number }) =>
    apiClient.get('/api/admin/transactions', { params }),
};
