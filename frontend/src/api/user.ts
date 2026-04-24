import apiClient from './client';

export interface RechargePackage {
  id: string;
  name: string;
  points: number;
  amount_cents: number;
  price: number;
  popular: boolean;
  description: string;
}

export interface SubscriptionPlan {
  id: 'monthly' | 'yearly';
  name: string;
  amount_cents: number;
  price: number;
  days: number;
  popular: boolean;
  description: string;
}

export interface RechargeOrder {
  id: number;
  order_no: string;
  order_type: 'points' | 'subscription';
  package_id: string;
  subscription_plan: string | null;
  points: number;
  amount_cents: number;
  channel: 'wechat';
  status: 'pending' | 'paid' | 'expired' | 'failed';
  code_url: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  expire_at: string;
  created_at: string;
  updated_at: string;
}

export const userApi = {
  getProfile: () =>
    apiClient.get('/api/user/profile'),

  updateProfile: (data: { username?: string; password?: string; old_password?: string }) =>
    apiClient.put('/api/user/profile', data),

  getPointsHistory: (page = 1, per_page = 20) =>
    apiClient.get('/api/user/points/history', { params: { page, per_page } }),

  getRechargePackages: () =>
    apiClient.get('/api/user/recharge/packages'),

  createRechargeOrder: (package_id: string) =>
    apiClient.post('/api/user/recharge/orders', { package_id }),

  getRechargeOrder: (order_no: string) =>
    apiClient.get(`/api/user/recharge/orders/${order_no}`),

  getSubscriptionPlans: () =>
    apiClient.get('/api/user/subscription/plans'),

  subscribe: (plan: 'monthly' | 'yearly', payment_method: 'wechat' | 'alipay') =>
    apiClient.post('/api/user/subscribe', { plan, payment_method }),
};
