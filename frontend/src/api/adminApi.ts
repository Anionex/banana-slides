/**
 * Admin API - endpoints for the admin dashboard
 */
import { apiClient } from './client';

// --- Stats ---

export const getStatsOverview = () =>
  apiClient.get('/api/admin/stats/overview');

export const getUserGrowthTrend = (days = 30) =>
  apiClient.get('/api/admin/stats/user-growth', { params: { days } });

// --- Users ---

export interface AdminUsersParams {
  limit?: number;
  offset?: number;
  search?: string;
  filter_plan?: string;
  filter_status?: string;
}

export const getAdminUsers = (params: AdminUsersParams = {}) =>
  apiClient.get('/api/admin/users', { params });

export const adjustUserCredits = (userId: string, amount: number, reason: string) =>
  apiClient.post(`/api/admin/users/${userId}/credits`, { amount, reason });

export const toggleUserActive = (userId: string, isActive: boolean) =>
  apiClient.post(`/api/admin/users/${userId}/toggle-active`, { is_active: isActive });

export const changeUserSubscription = (
  userId: string,
  subscriptionPlan: string,
  subscriptionExpiresAt?: string,
) =>
  apiClient.post(`/api/admin/users/${userId}/subscription`, {
    subscription_plan: subscriptionPlan,
    subscription_expires_at: subscriptionExpiresAt,
  });

// --- Transactions (Audit) ---

export interface AdminTransactionsParams {
  limit?: number;
  offset?: number;
  user_search?: string;
  operation?: string;
  start_date?: string;
  end_date?: string;
}

export const getAdminTransactions = (params: AdminTransactionsParams = {}) =>
  apiClient.get('/api/admin/transactions', { params });

// --- Orders (Audit) ---

export interface AdminOrdersParams {
  limit?: number;
  offset?: number;
  user_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export const getAdminOrders = (params: AdminOrdersParams = {}) =>
  apiClient.get('/api/admin/orders', { params });
