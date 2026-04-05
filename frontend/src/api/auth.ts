import apiClient from './client';

export const authApi = {
  sendSms: (phone: string) =>
    apiClient.post('/api/auth/send-sms', { phone }),

  register: (data: { phone: string; code: string; username?: string; password?: string }) =>
    apiClient.post('/api/auth/register', data),

  loginPhone: (data: { phone: string; code: string }) =>
    apiClient.post('/api/auth/login/phone', data),

  loginPassword: (data: { username: string; password: string }) =>
    apiClient.post('/api/auth/login/password', data),

  refresh: (refresh_token: string) =>
    apiClient.post('/api/auth/refresh', { refresh_token }),

  logout: () =>
    apiClient.post('/api/auth/logout'),
};
