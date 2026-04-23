import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { paymentApi } from './payment'
import { apiClient } from './client'

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('paymentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads subscription plans together with provider metadata', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: {
        data: {
          provider: 'stripe',
          default_provider: 'stripe',
          enabled_providers: [
            { name: 'stripe', label: 'Stripe', configured: true, supports_one_time: true, supports_subscription: true, supports_billing_portal: true, payment_methods: ['card'], currencies: ['USD'] },
            { name: 'paypal', label: 'PayPal', configured: true, supports_one_time: true, supports_subscription: true, supports_billing_portal: false, payment_methods: ['paypal'], currencies: ['USD'] },
          ],
          plans: [
            { id: 'pro_monthly', name: 'Pro', price_usd: 19, interval: 'month', monthly_credits: 3000, description: 'For solo founders', features: ['3000 credits'], supported_providers: ['stripe', 'paypal'] },
          ],
        },
      },
    })

    const catalog = await paymentApi.getPlans()

    expect(mockedClient.get).toHaveBeenCalledWith('/api/payment/plans')
    expect(catalog.enabled_providers).toHaveLength(2)
    expect(catalog.plans[0].supported_providers).toEqual(['stripe', 'paypal'])
  })

  it('creates a PayPal one-time order when provider is selected', async () => {
    mockedClient.post.mockResolvedValueOnce({
      data: {
        data: {
          success: true,
          payment_url: 'https://www.paypal.com/checkoutnow?token=TEST123',
          order_id: 'order_123',
          provider: 'paypal',
        },
      },
    })

    const result = await paymentApi.createOrder('starter', { provider: 'paypal' })

    expect(mockedClient.post).toHaveBeenCalledWith('/api/payment/create-order', expect.objectContaining({
      package_id: 'starter',
      provider: 'paypal',
      payment_type: 'paypal',
    }))
    expect(result.success).toBe(true)
    expect(result.provider).toBe('paypal')
  })

  it('creates a provider-aware subscription checkout session', async () => {
    mockedClient.post.mockResolvedValueOnce({
      data: {
        data: {
          success: true,
          payment_url: 'https://www.paypal.com/subscribe?ba_token=I-TEST123',
          order_id: 'order_456',
          plan_id: 'pro_monthly',
          provider: 'paypal',
        },
      },
    })

    const result = await paymentApi.createSubscription('pro_monthly', 'paypal')

    expect(mockedClient.post).toHaveBeenCalledWith('/api/payment/create-subscription', expect.objectContaining({
      plan_id: 'pro_monthly',
      provider: 'paypal',
    }))
    expect(result.success).toBe(true)
    expect(result.plan_id).toBe('pro_monthly')
  })
})
