import axios from 'axios';

import type { Settings } from '@/types';

const adminClient = axios.create({ baseURL: '', timeout: 60000 });

adminClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('feiye-admin');
    const token = raw ? JSON.parse(raw)?.state?.accessToken : null;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore parse errors
  }
  return config;
});

type AdminSettingsUpdatePayload = Partial<
  Omit<
    Settings,
    | 'id'
    | 'owner_user_id'
    | 'scope'
    | 'api_key_length'
    | 'mineru_token_length'
    | 'baidu_api_key_length'
    | 'text_api_key_length'
    | 'image_api_key_length'
    | 'image_caption_api_key_length'
    | 'created_at'
    | 'updated_at'
  >
> & {
  api_key?: string;
  mineru_token?: string;
  baidu_api_key?: string;
  text_api_key?: string;
  image_api_key?: string;
  image_caption_api_key?: string;
  lazyllm_api_keys?: Record<string, string>;
};

export const adminApi = {
  login: (username: string, password: string) =>
    adminClient.post('/api/admin/login', { username, password }),

  getStats: () => adminClient.get('/api/admin/stats'),

  listUsers: (params?: { page?: number; per_page?: number; search?: string }) =>
    adminClient.get('/api/admin/users', { params }),

  createAdmin: (data: { username: string; password: string }) =>
    adminClient.post('/api/admin/users', data),

  updateUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    adminClient.put(`/api/admin/users/${id}`, data),

  adjustPoints: (id: string, amount: number, description?: string) =>
    adminClient.post(`/api/admin/users/${id}/points`, { amount, description }),

  activateSubscription: (id: string, plan: 'monthly' | 'yearly') =>
    adminClient.post(`/api/admin/users/${id}/subscribe`, { plan }),

  listSubscriptions: (params?: { page?: number; per_page?: number; status?: string }) =>
    adminClient.get('/api/admin/subscriptions', { params }),

  listTransactions: (params?: { page?: number; per_page?: number; user_id?: string }) =>
    adminClient.get('/api/admin/transactions', { params }),

  changePassword: (data: { current_password: string; new_password: string }) =>
    adminClient.post('/api/admin/account/password', data),

  getSettings: async () => (await adminClient.get('/api/admin/settings')).data,

  updateSettings: async (data: AdminSettingsUpdatePayload) =>
    (await adminClient.put('/api/admin/settings', data)).data,

  resetSettings: async () => (await adminClient.post('/api/admin/settings/reset')).data,

  testBaiduOcr: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/baidu-ocr', settings || {})).data,

  testTextModel: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/text-model', settings || {})).data,

  testCaptionModel: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/caption-model', settings || {})).data,

  testBaiduInpaint: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/baidu-inpaint', settings || {})).data,

  testImageModel: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/image-model', settings || {})).data,

  testMineruPdf: async (settings?: Record<string, unknown>) =>
    (await adminClient.post('/api/admin/settings/tests/mineru-pdf', settings || {})).data,

  getTestStatus: async (taskId: string) =>
    (await adminClient.get(`/api/admin/settings/tests/${taskId}/status`)).data,
};
