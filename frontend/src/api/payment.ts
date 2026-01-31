/**
 * Payment API - payment and credits related API calls
 * 支付和积分相关 API
 */
import { apiClient } from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  price_cny: number;
  price_usd: number;
  description: string;
}

export interface CreditsInfo {
  balance: number;
  used_total: number;
  subscription_plan: string;
}

export interface CostEstimate {
  outline?: number;
  descriptions?: number;
  images?: number;
  total: number;
}

export interface PaymentOrder {
  success: boolean;
  order_id?: string;
  external_order_id?: string;
  payment_url?: string;
  qr_code_url?: string;
  error_message?: string;
}

// ==================== Payment API ====================

export const paymentApi = {
  /**
   * Get available credit packages
   */
  getPackages: async (): Promise<CreditPackage[]> => {
    const response = await apiClient.get<ApiResponse<{ packages: CreditPackage[] }>>('/api/payment/packages');
    return response.data.data.packages;
  },

  /**
   * Get current user's credits info
   */
  getCredits: async (): Promise<CreditsInfo> => {
    const response = await apiClient.get<ApiResponse<CreditsInfo>>('/api/payment/credits');
    return response.data.data;
  },

  /**
   * Estimate credits cost for a project
   */
  estimateCost: async (
    pagesCount: number,
    options?: {
      includeOutline?: boolean;
      includeDescriptions?: boolean;
      includeImages?: boolean;
    }
  ): Promise<CostEstimate> => {
    const response = await apiClient.post<ApiResponse<CostEstimate>>('/api/payment/estimate', {
      pages_count: pagesCount,
      include_outline: options?.includeOutline ?? true,
      include_descriptions: options?.includeDescriptions ?? true,
      include_images: options?.includeImages ?? true,
    });
    return response.data.data;
  },

  /**
   * Create a payment order
   */
  createOrder: async (
    packageId: string,
    paymentType: 'wechat' | 'alipay' = 'wechat',
    returnUrl?: string
  ): Promise<PaymentOrder> => {
    const response = await apiClient.post<ApiResponse<PaymentOrder>>('/api/payment/create-order', {
      package_id: packageId,
      payment_type: paymentType,
      return_url: returnUrl,
    });
    return response.data.data;
  },

  /**
   * Query order status
   */
  queryOrder: async (orderId: string): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/payment/order/${orderId}`);
    return response.data.data;
  },
};

export default paymentApi;
