import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Crown,
  Edit2,
  Loader2,
  LogOut,
  QrCode,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { userApi } from '../api/user';
import type { RechargeOrder, RechargePackage, SubscriptionPlan } from '../api/user';

const PLAN_LABELS: Record<string, string> = {
  monthly: '月度订阅',
  yearly: '年度订阅',
};

type WechatPayResult = {
  code_url: string;
  qr_code_url?: string | null;
};

const formatPrice = (amountCents: number) => {
  const value = amountCents / 100;
  return `￥${value.toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
};

const formatRemaining = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const apiError = (error: any, fallback: string) => error?.response?.data?.error || fallback;

export function UserProfile() {
  const navigate = useNavigate();
  const { user, setUser, logout, openLoginModal, canAccessSettingsPage } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [editUsername, setEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saveError, setSaveError] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargePackages, setRechargePackages] = useState<RechargePackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [wechatConfigured, setWechatConfigured] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [rechargeOrder, setRechargeOrder] = useState<RechargeOrder | null>(null);
  const [rechargeResult, setRechargeResult] = useState<WechatPayResult | null>(null);
  const [clientQrCodeUrl, setClientQrCodeUrl] = useState('');
  const [rechargeError, setRechargeError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionWechatConfigured, setSubscriptionWechatConfigured] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [subscriptionOrder, setSubscriptionOrder] = useState<RechargeOrder | null>(null);
  const [subscriptionResult, setSubscriptionResult] = useState<WechatPayResult | null>(null);
  const [subscriptionQrCodeUrl, setSubscriptionQrCodeUrl] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionRemainingSeconds, setSubscriptionRemainingSeconds] = useState(0);
  const [subscriptionCopied, setSubscriptionCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      openLoginModal();
      navigate('/');
      return;
    }
    userApi
      .getProfile()
      .then((res) => {
        setUser(res.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!rechargeOpen || !rechargeOrder || rechargeOrder.status !== 'pending') return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await userApi.getRechargeOrder(rechargeOrder.order_no);
        if (cancelled) return;
        const data = res.data.data;
        setRechargeOrder(data.order);
        setRemainingSeconds(data.remaining_seconds || 0);
        if (data.paid && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        if (!cancelled) {
          setRechargeError(apiError(error, '查询订单状态失败'));
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rechargeOpen, rechargeOrder?.order_no, rechargeOrder?.status, setUser]);

  useEffect(() => {
    if (!subscriptionOpen || !subscriptionOrder || subscriptionOrder.status !== 'pending') return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await userApi.getRechargeOrder(subscriptionOrder.order_no);
        if (cancelled) return;
        const data = res.data.data;
        setSubscriptionOrder(data.order);
        setSubscriptionRemainingSeconds(data.remaining_seconds || 0);
        if (data.paid && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        if (!cancelled) {
          setSubscriptionError(apiError(error, '查询订阅订单状态失败'));
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setUser, subscriptionOpen, subscriptionOrder?.order_no, subscriptionOrder?.status]);

  const selectedPackage = useMemo(
    () => rechargePackages.find((item) => item.id === selectedPackageId) || null,
    [rechargePackages, selectedPackageId],
  );
  const monthlyPlan = subscriptionPlans.find((item) => item.id === 'monthly') || null;
  const yearlyPlan = subscriptionPlans.find((item) => item.id === 'yearly') || null;
  const selectedSubscriptionPlan = subscriptionPlans.find((item) => item.id === subscriptionOrder?.subscription_plan) || null;

  const isAdmin = user?.role === 'admin';
  const isInternal = user?.role === 'internal';
  const usesPlatformBilling = user?.role === 'user';
  const showRechargePricing = Boolean(user && usesPlatformBilling);

  const loadRechargePackages = useCallback(async (showSpinner = true) => {
    setRechargeError('');
    if (showSpinner) setPackagesLoading(true);

    try {
      const res = await userApi.getRechargePackages();
      const items: RechargePackage[] = res.data.data.items || [];
      setRechargePackages(items);
      setWechatConfigured(Boolean(res.data.data.wechat?.configured));
      setSelectedPackageId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        const preferred = items.find((item) => item.popular) || items[0];
        return preferred?.id || '';
      });
      if (!items.length) {
        setRechargeError('暂无可用充值套餐');
      }
    } catch (error) {
      setRechargeError(apiError(error, '读取充值套餐失败'));
    } finally {
      if (showSpinner) setPackagesLoading(false);
    }
  }, []);

  const loadSubscriptionPlans = useCallback(async (showSpinner = true) => {
    setSubscriptionError('');
    if (showSpinner) setSubscriptionLoading(true);

    try {
      const res = await userApi.getSubscriptionPlans();
      const items: SubscriptionPlan[] = res.data.data.items || [];
      setSubscriptionPlans(items);
      setSubscriptionWechatConfigured(Boolean(res.data.data.wechat?.configured));
      if (!items.length) {
        setSubscriptionError('暂无可用订阅套餐');
      }
    } catch (error) {
      setSubscriptionError(apiError(error, '读取订阅套餐失败'));
    } finally {
      if (showSpinner) setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showRechargePricing) return;
    loadRechargePackages(true);
    loadSubscriptionPlans(true);
  }, [loadRechargePackages, loadSubscriptionPlans, showRechargePricing]);

  useEffect(() => {
    let cancelled = false;
    const codeUrl = rechargeResult?.code_url;

    if (!codeUrl || rechargeResult?.qr_code_url) {
      setClientQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(codeUrl, { width: 240, margin: 2 })
      .then((url) => {
        if (!cancelled) setClientQrCodeUrl(url);
      })
      .catch(() => {
        if (!cancelled) setClientQrCodeUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [rechargeResult?.code_url, rechargeResult?.qr_code_url]);

  useEffect(() => {
    let cancelled = false;
    const codeUrl = subscriptionResult?.code_url;

    if (!codeUrl || subscriptionResult?.qr_code_url) {
      setSubscriptionQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(codeUrl, { width: 240, margin: 2 })
      .then((url) => {
        if (!cancelled) setSubscriptionQrCodeUrl(url);
      })
      .catch(() => {
        if (!cancelled) setSubscriptionQrCodeUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [subscriptionResult?.code_url, subscriptionResult?.qr_code_url]);

  const createSubscriptionOrder = async (plan: 'monthly' | 'yearly') => {
    setSubscriptionOpen(true);
    setSubscriptionError('');
    setSubscriptionOrder(null);
    setSubscriptionResult(null);
    setSubscriptionQrCodeUrl('');
    setSubscriptionCopied(false);
    setSubscriptionRemainingSeconds(0);
    setCreatingSubscription(true);

    try {
      if (!subscriptionPlans.length) {
        await loadSubscriptionPlans(true);
      }
      const res = await userApi.subscribe(plan, 'wechat');
      const order: RechargeOrder = res.data.data.order;
      setSubscriptionOrder(order);
      setSubscriptionResult(res.data.data.result);
      setSubscriptionRemainingSeconds(Math.max(0, Math.floor((new Date(order.expire_at).getTime() - Date.now()) / 1000)));
    } catch (error) {
      setSubscriptionError(apiError(error, '发起微信订阅支付失败'));
    } finally {
      setCreatingSubscription(false);
    }
  };

  const openRecharge = async () => {
    setRechargeOpen(true);
    setRechargeError('');
    setRechargeOrder(null);
    setRechargeResult(null);
    setClientQrCodeUrl('');
    setRemainingSeconds(0);
    setCopied(false);

    if (!rechargePackages.length) {
      await loadRechargePackages(true);
    }
  };

  const createRechargeOrder = async (packageId?: string) => {
    const targetPackageId =
      typeof packageId === 'string' && packageId.trim()
        ? packageId.trim()
        : selectedPackageId;
    if (!targetPackageId) return;
    setSelectedPackageId(targetPackageId);
    setRechargeOpen(true);
    setRechargeError('');
    setClientQrCodeUrl('');
    setCopied(false);
    setCreatingOrder(true);

    try {
      const res = await userApi.createRechargeOrder(targetPackageId);
      const order: RechargeOrder = res.data.data.order;
      setRechargeOrder(order);
      setRechargeResult(res.data.data.result);
      setRemainingSeconds(Math.max(0, Math.floor((new Date(order.expire_at).getTime() - Date.now()) / 1000)));
    } catch (error) {
      setRechargeError(apiError(error, '发起微信支付失败'));
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleCopyCodeUrl = async () => {
    if (!rechargeResult?.code_url) return;
    await navigator.clipboard.writeText(rechargeResult.code_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleCopySubscriptionCodeUrl = async () => {
    if (!subscriptionResult?.code_url) return;
    await navigator.clipboard.writeText(subscriptionResult.code_url);
    setSubscriptionCopied(true);
    window.setTimeout(() => setSubscriptionCopied(false), 1500);
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    try {
      setSaveError('');
      const res = await userApi.updateProfile({ username: newUsername.trim() });
      setUser(res.data.data);
      setEditUsername(false);
    } catch (e: any) {
      setSaveError(e.response?.data?.error || '保存失败');
    }
  };

  const handlePasswordInputChange = (field: 'oldPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleSavePassword = async () => {
    const oldPassword = passwordForm.oldPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!newPassword) {
      setPasswordError('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码至少需要 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError('');
      setPasswordSuccess('');
      const payload: { password: string; old_password?: string } = { password: newPassword };
      if (oldPassword) payload.old_password = oldPassword;
      const res = await userApi.updateProfile(payload);
      setUser(res.data.data);
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordSuccess('密码修改成功');
    } catch (e: any) {
      setPasswordError(e.response?.data?.error || '修改密码失败');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen feiye-page-shell flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--banana-yellow)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const sub = user.subscription;
  const isSubscribed = sub?.status === 'active';
  const rechargePaid = rechargeOrder?.status === 'paid';
  const rechargeExpired = rechargeOrder?.status === 'expired';
  const rechargeFailed = rechargeOrder?.status === 'failed';
  const subscriptionPaid = subscriptionOrder?.status === 'paid';
  const subscriptionExpired = subscriptionOrder?.status === 'expired';
  const subscriptionFailed = subscriptionOrder?.status === 'failed';

  return (
    <div className="min-h-screen feiye-page-shell">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← 返回
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-red-500 transition-colors"
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 mb-4 shadow-sm border border-[var(--border-secondary)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--banana-yellow-pale)] flex items-center justify-center">
              <User size={24} className="text-[var(--banana-yellow-dark)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {editUsername ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="text-base font-semibold bg-transparent border-b border-[var(--banana-yellow)] outline-none text-[var(--text-primary)] w-32"
                      autoFocus
                    />
                    <button onClick={handleSaveUsername} className="text-[var(--banana-yellow-dark)]">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditUsername(false)} className="text-[var(--text-tertiary)]">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-base font-semibold text-[var(--text-primary)] truncate">
                      {user.username || user.phone || '用户'}
                    </span>
                    <button
                      onClick={() => {
                        setNewUsername(user.username || '');
                        setEditUsername(true);
                        setSaveError('');
                      }}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <Edit2 size={13} />
                    </button>
                  </>
                )}
                {isAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    管理员
                  </span>
                )}
                {isInternal && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
                    内部用户
                  </span>
                )}
              </div>
              {saveError && <p className="text-xs text-red-500 mt-0.5">{saveError}</p>}
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {user.phone || '未绑定手机号'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 shadow-sm border border-[var(--border-secondary)]">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={18} className="text-[var(--banana-yellow-dark)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">积分余额</span>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">
              {usesPlatformBilling ? user.points : '--'}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              {usesPlatformBilling ? '每生成 1 页 PPT 消耗 3 积分' : '管理员和内部用户不参与积分结算'}
            </p>
            <button
              onClick={usesPlatformBilling ? openRecharge : undefined}
              disabled={!usesPlatformBilling}
              className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors disabled:cursor-not-allowed"
            >
              {usesPlatformBilling ? '微信充值' : '不适用'}
            </button>
          </div>

          <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 shadow-sm border border-[var(--border-secondary)]">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={18} className="text-amber-500" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">订阅状态</span>
            </div>
            {!usesPlatformBilling ? (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">不适用</div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">管理员和内部用户不显示付费与订阅能力</p>
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] disabled:cursor-not-allowed"
                >
                  不适用
                </button>
              </>
            ) : isSubscribed ? (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">
                  {PLAN_LABELS[sub.plan] || sub.plan}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">
                  到期：{new Date(sub.end_date).toLocaleDateString('zh-CN')}
                </p>
                <button
                  onClick={() => createSubscriptionOrder('yearly')}
                  disabled={!subscriptionWechatConfigured || creatingSubscription}
                  className="w-full py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  续费
                </button>
              </>
            ) : (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">免费版</div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">升级订阅享受更多权益</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => createSubscriptionOrder('monthly')}
                    disabled={!subscriptionWechatConfigured || creatingSubscription || subscriptionLoading}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)] hover:bg-[var(--bg-hover)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    月度 {monthlyPlan ? formatPrice(monthlyPlan.amount_cents) : '￥29'}
                  </button>
                  <button
                    onClick={() => createSubscriptionOrder('yearly')}
                    disabled={!subscriptionWechatConfigured || creatingSubscription || subscriptionLoading}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    年度 {yearlyPlan ? formatPrice(yearlyPlan.amount_cents) : '￥199'}
                  </button>
                </div>
                {!subscriptionWechatConfigured && (
                  <p className="mt-3 text-xs text-amber-600">微信支付尚未配置完整，暂不能购买订阅。</p>
                )}
                {subscriptionError && !subscriptionOpen && (
                  <p className="mt-3 text-xs text-red-500">{subscriptionError}</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 mb-4 shadow-sm border border-[var(--border-secondary)]">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-[var(--banana-yellow-dark)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">修改密码</h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {user.password_hash ? '请输入当前密码后设置新密码' : '当前账号尚未设置密码，可直接设置新密码'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <input
              type="password"
              value={passwordForm.oldPassword}
              onChange={(e) => handlePasswordInputChange('oldPassword', e.target.value)}
              placeholder="当前密码"
              className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
              placeholder="新密码"
              className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
              placeholder="确认新密码"
              className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
          </div>

          {passwordError && <p className="mt-3 text-xs text-red-500">{passwordError}</p>}
          {passwordSuccess && <p className="mt-3 text-xs text-green-600">{passwordSuccess}</p>}

          <button
            onClick={handleSavePassword}
            disabled={savingPassword}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)] hover:bg-[var(--bg-hover)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword ? '保存中...' : '保存新密码'}
          </button>
        </div>

        {showRechargePricing && (
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 mb-4 shadow-sm border border-[var(--border-secondary)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <WalletCards size={18} className="text-[var(--banana-yellow-dark)]" />
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">微信充值套餐</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">积分和价格由后台定价配置</p>
                </div>
              </div>
              <button
                onClick={openRecharge}
                className="shrink-0 rounded-lg bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                扫码支付
              </button>
            </div>

            {packagesLoading && !rechargePackages.length ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[var(--banana-yellow-dark)]" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {rechargePackages.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => createRechargeOrder(item.id)}
                      disabled={!wechatConfigured || creatingOrder}
                      className="relative rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 text-left transition-colors hover:border-[var(--banana-yellow)] hover:bg-[var(--banana-yellow-pale)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {item.popular && (
                        <span className="absolute right-2 top-2 rounded-full bg-[var(--banana-yellow)] px-1.5 py-0.5 text-[10px] text-white">
                          推荐
                        </span>
                      )}
                      <div className="text-lg font-semibold text-[var(--text-primary)]">{item.points}</div>
                      <div className="mb-2 text-xs text-[var(--text-secondary)]">积分</div>
                      <div className="text-sm font-semibold text-[var(--banana-yellow-dark)]">
                        {formatPrice(item.amount_cents)}
                      </div>
                    </button>
                  ))}
                </div>

                {!rechargePackages.length && (
                  <div className="rounded-xl bg-[var(--bg-secondary)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                    暂无可用充值套餐
                  </div>
                )}

                {!wechatConfigured && rechargePackages.length > 0 && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>微信支付尚未配置完整，套餐可见但暂不能下单。</span>
                  </div>
                )}

                {rechargeError && !rechargeOpen && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{rechargeError}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-3 rounded-2xl text-sm font-medium bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            进入管理后台 →
          </button>
        )}

        {canAccessSettingsPage() && (
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3 rounded-2xl text-sm font-medium bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            进入我的独立设置 →
          </button>
        )}
      </div>

      {showRechargePricing && rechargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRechargeOpen(false)} />
          <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <button onClick={() => setRechargeOpen(false)} className="absolute top-4 right-4 text-[var(--text-tertiary)]">
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-5">
              <WalletCards size={20} className="text-[var(--banana-yellow-dark)]" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">微信充值积分</h2>
                <p className="text-xs text-[var(--text-tertiary)]">支付成功后积分自动到账</p>
              </div>
            </div>

            {packagesLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 size={28} className="animate-spin text-[var(--banana-yellow-dark)]" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {rechargePackages.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (!rechargeOrder) setSelectedPackageId(item.id);
                      }}
                      disabled={Boolean(rechargeOrder)}
                      className={`relative text-left rounded-xl border p-4 transition-colors ${
                        selectedPackageId === item.id
                          ? 'border-[var(--banana-yellow)] bg-[var(--banana-yellow-pale)]'
                          : 'border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
                      } ${rechargeOrder ? 'cursor-default' : ''}`}
                    >
                      {item.popular && (
                        <span className="absolute right-2 top-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--banana-yellow)] text-white">
                          推荐
                        </span>
                      )}
                      <div className="text-lg font-semibold text-[var(--text-primary)]">{item.points}</div>
                      <div className="text-xs text-[var(--text-secondary)] mb-2">积分</div>
                      <div className="text-sm font-medium text-[var(--banana-yellow-dark)]">
                        {formatPrice(item.amount_cents)}
                      </div>
                    </button>
                  ))}
                </div>

                {!wechatConfigured && (
                  <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>微信支付还没有配置完整，请先补齐 .env.example 中列出的微信商户参数。</span>
                  </div>
                )}

                {rechargeError && (
                  <div className="flex gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{rechargeError}</span>
                  </div>
                )}

                {!rechargeOrder ? (
                  <button
                    onClick={() => createRechargeOrder()}
                    disabled={!selectedPackage || !wechatConfigured || creatingOrder}
                    className="w-full py-3 rounded-xl text-sm font-medium bg-[var(--banana-yellow)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creatingOrder && <Loader2 size={16} className="animate-spin" />}
                    {selectedPackage ? `微信支付 ${formatPrice(selectedPackage.amount_cents)}` : '选择充值套餐'}
                  </button>
                ) : (
                  <div className="border border-[var(--border-secondary)] rounded-xl p-4">
                    {rechargePaid ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <CheckCircle2 size={44} className="text-green-500 mb-3" />
                        <div className="font-semibold text-[var(--text-primary)]">充值成功</div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          已到账 {rechargeOrder.points} 积分，当前余额已刷新
                        </p>
                      </div>
                    ) : rechargeExpired || rechargeFailed ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <AlertCircle size={44} className="text-red-500 mb-3" />
                        <div className="font-semibold text-[var(--text-primary)]">
                          {rechargeExpired ? '订单已过期' : '订单失败'}
                        </div>
                        <button
                          onClick={() => {
                            setRechargeOrder(null);
                            setRechargeResult(null);
                            setRechargeError('');
                          }}
                          className="mt-4 px-4 py-2 rounded-xl text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          重新下单
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {selectedPackage?.name || `${rechargeOrder.points} 积分`}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">订单号：{rechargeOrder.order_no}</div>
                          </div>
                          <div className="text-sm text-[var(--banana-yellow-dark)]">
                            {formatRemaining(remainingSeconds)}
                          </div>
                        </div>
                        <div className="w-44 h-44 mx-auto bg-white rounded-xl flex items-center justify-center mb-3 border border-[var(--border-secondary)]">
                          {rechargeResult?.qr_code_url ? (
                            <img
                              src={rechargeResult.qr_code_url}
                              alt="微信支付二维码"
                              className="w-40 h-40 object-contain"
                            />
                          ) : clientQrCodeUrl ? (
                            <img
                              src={clientQrCodeUrl}
                              alt="微信支付二维码"
                              className="w-40 h-40 object-contain"
                            />
                          ) : (
                            <QrCode size={56} className="text-[var(--text-tertiary)]" />
                          )}
                        </div>
                        <p className="text-xs text-center text-[var(--text-secondary)] mb-3">
                          使用微信扫码支付，支付后页面会自动刷新
                        </p>
                        {rechargeResult?.code_url && !rechargeResult.qr_code_url && !clientQrCodeUrl && (
                          <button
                            onClick={handleCopyCodeUrl}
                            className="w-full py-2 rounded-xl text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5"
                          >
                            <Copy size={13} />
                            {copied ? '已复制支付链接' : '复制微信支付链接'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showRechargePricing && subscriptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSubscriptionOpen(false)} />
          <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <button
              onClick={() => setSubscriptionOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-tertiary)]"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-5">
              <Crown size={20} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">微信订阅</h2>
                <p className="text-xs text-[var(--text-tertiary)]">支付成功后订阅自动开通或续期</p>
              </div>
            </div>

            {subscriptionLoading && !subscriptionOrder ? (
              <div className="py-12 flex justify-center">
                <Loader2 size={28} className="animate-spin text-[var(--banana-yellow-dark)]" />
              </div>
            ) : (
              <>
                {!subscriptionWechatConfigured && (
                  <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>微信支付还没有配置完整，暂不能购买订阅。</span>
                  </div>
                )}

                {subscriptionError && (
                  <div className="flex gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{subscriptionError}</span>
                  </div>
                )}

                {!subscriptionOrder ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subscriptionPlans.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => createSubscriptionOrder(item.id)}
                        disabled={!subscriptionWechatConfigured || creatingSubscription}
                        className="relative rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 text-left transition-colors hover:border-[var(--banana-yellow)] hover:bg-[var(--banana-yellow-pale)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {item.popular && (
                          <span className="absolute right-2 top-2 rounded-full bg-[var(--banana-yellow)] px-1.5 py-0.5 text-[10px] text-white">
                            推荐
                          </span>
                        )}
                        <div className="text-base font-semibold text-[var(--text-primary)]">{item.name}</div>
                        <div className="mb-2 text-xs text-[var(--text-secondary)]">{item.days} 天</div>
                        <div className="text-sm font-semibold text-[var(--banana-yellow-dark)]">
                          {formatPrice(item.amount_cents)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border border-[var(--border-secondary)] rounded-xl p-4">
                    {subscriptionPaid ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <CheckCircle2 size={44} className="text-green-500 mb-3" />
                        <div className="font-semibold text-[var(--text-primary)]">订阅已开通</div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">当前订阅状态已刷新</p>
                      </div>
                    ) : subscriptionExpired || subscriptionFailed ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <AlertCircle size={44} className="text-red-500 mb-3" />
                        <div className="font-semibold text-[var(--text-primary)]">
                          {subscriptionExpired ? '订单已过期' : '订单失败'}
                        </div>
                        <button
                          onClick={() => {
                            setSubscriptionOrder(null);
                            setSubscriptionResult(null);
                            setSubscriptionError('');
                            setSubscriptionQrCodeUrl('');
                          }}
                          className="mt-4 px-4 py-2 rounded-xl text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          重新下单
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {selectedSubscriptionPlan?.name || PLAN_LABELS[subscriptionOrder.subscription_plan || ''] || '订阅'}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">订单号：{subscriptionOrder.order_no}</div>
                          </div>
                          <div className="text-sm text-[var(--banana-yellow-dark)]">
                            {formatRemaining(subscriptionRemainingSeconds)}
                          </div>
                        </div>
                        <div className="w-44 h-44 mx-auto bg-white rounded-xl flex items-center justify-center mb-3 border border-[var(--border-secondary)]">
                          {subscriptionResult?.qr_code_url ? (
                            <img
                              src={subscriptionResult.qr_code_url}
                              alt="微信订阅支付二维码"
                              className="w-40 h-40 object-contain"
                            />
                          ) : subscriptionQrCodeUrl ? (
                            <img
                              src={subscriptionQrCodeUrl}
                              alt="微信订阅支付二维码"
                              className="w-40 h-40 object-contain"
                            />
                          ) : (
                            <QrCode size={56} className="text-[var(--text-tertiary)]" />
                          )}
                        </div>
                        <p className="text-xs text-center text-[var(--text-secondary)] mb-3">
                          使用微信扫码支付，支付后页面会自动刷新订阅状态
                        </p>
                        {subscriptionResult?.code_url && !subscriptionResult.qr_code_url && !subscriptionQrCodeUrl && (
                          <button
                            onClick={handleCopySubscriptionCodeUrl}
                            className="w-full py-2 rounded-xl text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5"
                          >
                            <Copy size={13} />
                            {subscriptionCopied ? '已复制支付链接' : '复制微信支付链接'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
