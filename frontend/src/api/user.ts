import apiClient from './client';

export const userApi = {
  getProfile: () =>
    apiClient.get('/api/user/profile'),

  updateProfile: (data: { username?: string; password?: string; old_password?: string }) =>
    apiClient.put('/api/user/profile', data),

  getPointsHistory: (page = 1, per_page = 20) =>
    apiClient.get('/api/user/points/history', { params: { page, per_page } }),

  subscribe: (plan: 'monthly' | 'yearly', payment_method: 'wechat' | 'alipay') =>
    apiClient.post('/api/user/subscribe', { plan, payment_method }),
};
