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

export interface PaymentProviderDescriptor {
  name: string;
  label: string;
  configured: boolean;
  supports_one_time: boolean;
  supports_subscription: boolean;
  supports_billing_portal: boolean;
  payment_methods: string[];
  currencies: string[];
  mode?: string;
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
  supported_providers?: string[];
}

export interface PackageCatalog {
  provider: string;
  default_provider: string;
  enabled_providers: PaymentProviderDescriptor[];
  packages: CreditPackage[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_usd: number;
  interval: string;
  monthly_credits: number;
  description: string;
  features: string[];
  supported_providers?: string[];
}

export interface PlanCatalog {
  provider: string;
  default_provider: string;
  enabled_providers: PaymentProviderDescriptor[];
  plans: SubscriptionPlan[];
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

export interface CreditCosts {
  generate_outline: number;
  generate_description: number;
  generate_image: number;
  edit_image: number;
  generate_material: number;
  refine_outline: number;
  refine_description: number;
  parse_file: number;
  export_editable: number;
}

export interface PaymentOrder {
  success: boolean;
  order_id?: string;
  external_order_id?: string;
  payment_url?: string;
  qr_code_url?: string;
  provider?: string;
  plan_id?: string;
  error_message?: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  operation: string;
  amount: number;
  balance_after: number;
  description: string | null;
  project_id: string | null;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: CreditTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateOrderOptions {
  provider?: string;
  paymentType?: 'card' | 'wechat' | 'alipay' | 'paypal';
  returnUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export const paymentApi = {
  /**
   * Get credit cost configuration (public)
   */
  getCreditCosts: async (): Promise<CreditCosts> => {
    const response = await apiClient.get<ApiResponse<CreditCosts>>('/api/payment/credit-costs');
    return response.data.data;
  },

  /**
   * Get available credit packages and payment provider metadata
   */
  getPackages: async (): Promise<PackageCatalog> => {
    const response = await apiClient.get<ApiResponse<PackageCatalog>>('/api/payment/packages');
    return response.data.data;
  },

  /**
   * Get available recurring subscription plans and provider metadata
   */
  getPlans: async (): Promise<PlanCatalog> => {
    const response = await apiClient.get<ApiResponse<PlanCatalog>>('/api/payment/plans');
    return response.data.data;
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
   * Create a checkout session / order for a one-time credit purchase.
   */
  createOrder: async (
    packageId: string,
    options: CreateOrderOptions = {}
  ): Promise<PaymentOrder> => {
    try {
      const origin = window.location.origin;
      const provider = options.provider;
      const successUrl = options.successUrl || (provider === 'stripe'
        ? `${origin}/pricing?success=true&checkout={CHECKOUT_SESSION_ID}&provider=stripe`
        : `${origin}/pricing?success=true&provider=${provider || 'default'}`);
      const cancelUrl = options.cancelUrl || `${origin}/pricing?canceled=true&provider=${provider || 'default'}`;
      const body: Record<string, any> = {
        package_id: packageId,
        payment_type: options.paymentType || (provider === 'paypal' ? 'paypal' : 'card'),
        success_url: successUrl,
        cancel_url: cancelUrl,
      };
      if (provider) body.provider = provider;
      if (options.returnUrl) body.return_url = options.returnUrl;
      const response = await apiClient.post<ApiResponse<PaymentOrder>>('/api/payment/create-order', body);
      return response.data.data;
    } catch (error: any) {
      return {
        success: false,
        error_message: error.response?.data?.error?.message
          || error.response?.data?.message
          || error.message
          || '创建订单失败',
      };
    }
  },

  /**
   * Create a recurring subscription checkout session.
   */
  createSubscription: async (planId: string, provider = 'stripe'): Promise<PaymentOrder> => {
    try {
      const origin = window.location.origin;
      const response = await apiClient.post<ApiResponse<PaymentOrder>>('/api/payment/create-subscription', {
        plan_id: planId,
        provider,
        success_url: provider === 'stripe'
          ? `${origin}/pricing?subscription=success&checkout={CHECKOUT_SESSION_ID}&provider=stripe`
          : `${origin}/pricing?subscription=success&provider=${provider}`,
        cancel_url: `${origin}/pricing?subscription=canceled&provider=${provider}`,
      });
      return response.data.data;
    } catch (error: any) {
      return {
        success: false,
        error_message: error.response?.data?.error?.message
          || error.response?.data?.message
          || error.message
          || '创建订阅失败',
      };
    }
  },

  /**
   * Create a billing portal session when supported.
   */
  createBillingPortal: async (returnUrl?: string, provider = 'stripe'): Promise<{ url: string }> => {
    const response = await apiClient.post<ApiResponse<{ url: string }>>('/api/payment/billing-portal', {
      provider,
      return_url: returnUrl || `${window.location.origin}/settings`,
    });
    return response.data.data;
  },

  /**
   * Query order status
   */
  queryOrder: async (orderId: string, provider?: string): Promise<any> => {
    const suffix = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    const response = await apiClient.get<ApiResponse<any>>(`/api/payment/order/${orderId}${suffix}`);
    return response.data.data;
  },

  /**
   * Get credit transaction history (paginated)
   */
  getTransactions: async (limit = 20, offset = 0): Promise<TransactionsResponse> => {
    const response = await apiClient.get<ApiResponse<TransactionsResponse>>(
      `/api/payment/transactions?limit=${limit}&offset=${offset}`
    );
    return response.data.data;
  },
};

export default paymentApi;
