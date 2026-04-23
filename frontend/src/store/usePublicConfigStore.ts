import { create } from 'zustand';
import { apiClient } from '../api/client';

interface PublicConfig {
  enable_credits_purchase: boolean;
  enable_alipay: boolean;
}

interface PublicConfigState {
  config: PublicConfig;
  fetchPublicConfig: () => Promise<void>;
}

export const usePublicConfigStore = create<PublicConfigState>((set) => ({
  config: {
    enable_credits_purchase: true,
    enable_alipay: false,
  },
  fetchPublicConfig: async () => {
    try {
      const response = await apiClient.get<{ data: PublicConfig }>('/api/admin/config/public');
      set({ config: response.data.data });
    } catch {
      // keep defaults on failure
    }
  },
}));
