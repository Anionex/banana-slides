import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Coins, Crown, QrCode, LogOut, Edit2, Check, X } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { userApi } from '../api/user';

const PLAN_LABELS: Record<string, string> = {
  monthly: '月度订阅',
  yearly: '年度订阅',
};

export function UserProfile() {
  const navigate = useNavigate();
  const { user, setUser, logout, openLoginModal } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{
    plan: string;
    method: 'wechat' | 'alipay';
    qr: string;
  } | null>(null);
  const [editUsername, setEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saveError, setSaveError] = useState('');

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

  const handleSubscribe = async (plan: 'monthly' | 'yearly', method: 'wechat' | 'alipay') => {
    try {
      const res = await userApi.subscribe(plan, method);
      setPaymentModal({ plan, method, qr: res.data.data.qr_code_url });
    } catch {
      // ignore
    }
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

  const sub = (user as any).subscription;
  const isSubscribed = sub?.status === 'active';
  const isAdmin = user.role === 'admin';
  const isInternal = user.role === 'internal';
  const usesPlatformBilling = user.role === 'user';

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
              <div className="flex items-center gap-2">
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
                    <span className="text-base font-semibold text-[var(--text-primary)]">
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

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 shadow-sm border border-[var(--border-secondary)]">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={18} className="text-[var(--banana-yellow-dark)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">积分余额</span>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">{user.points}</div>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              {usesPlatformBilling ? '每生成 1 页 PPT 消耗 3 积分' : '该账号不走平台积分计费'}
            </p>
            {usesPlatformBilling ? (
              <button
                onClick={() =>
                  setPaymentModal({ plan: 'points', method: 'wechat', qr: '/static/payment/wechat_qr.png' })
                }
                className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                充值积分
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed"
              >
                由系统统一管理
              </button>
            )}
          </div>

          <div className="bg-[var(--bg-elevated)] rounded-2xl p-5 shadow-sm border border-[var(--border-secondary)]">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={18} className="text-amber-500" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">订阅状态</span>
            </div>
            {usesPlatformBilling && isSubscribed ? (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">
                  {PLAN_LABELS[sub.plan] || sub.plan}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">
                  到期：{new Date(sub.end_date).toLocaleDateString('zh-CN')}
                </p>
                <button
                  onClick={() => handleSubscribe('yearly', 'wechat')}
                  className="w-full py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  续费
                </button>
              </>
            ) : usesPlatformBilling ? (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">免费版</div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">升级订阅享受更多权益</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSubscribe('monthly', 'wechat')}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    月度 ￥29
                  </button>
                  <button
                    onClick={() => handleSubscribe('yearly', 'wechat')}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    年度 ￥199
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-bold text-[var(--text-primary)] mb-1">平台订阅不适用</div>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">
                  该账号使用独立配置或后台管理权限，不通过主页订阅购买额度
                </p>
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed"
                >
                  由系统统一管理
                </button>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-3 rounded-2xl text-sm font-medium bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            进入管理后台 →
          </button>
        )}

        {isInternal && (
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3 rounded-2xl text-sm font-medium bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            进入我的独立设置 →
          </button>
        )}
      </div>

      {paymentModal && usesPlatformBilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPaymentModal(null)} />
          <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl p-6 w-72 text-center">
            <button onClick={() => setPaymentModal(null)} className="absolute top-3 right-3 text-[var(--text-tertiary)]">
              <X size={16} />
            </button>
            <div className="flex gap-2 justify-center mb-4">
              {(['wechat', 'alipay'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() =>
                    setPaymentModal({ ...paymentModal, method: m, qr: `/static/payment/${m}_qr.png` })
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    paymentModal.method === m
                      ? 'bg-[var(--banana-yellow)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  {m === 'wechat' ? '微信支付' : '支付宝'}
                </button>
              ))}
            </div>
            <div className="w-40 h-40 mx-auto bg-[var(--bg-secondary)] rounded-xl flex items-center justify-center mb-3">
              <img
                src={paymentModal.qr}
                alt="QR Code"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <QrCode size={48} className="text-[var(--text-tertiary)] absolute" />
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">扫码付款后请联系管理员激活</p>
          </div>
        </div>
      )}
    </div>
  );
}
