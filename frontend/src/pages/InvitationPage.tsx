import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Copy, Share2, Trash2, Plus, Gift, Users } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Button, Card, Loading, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';

const invitationI18n = {
  zh: {
    title: '邀请好友',
    subtitle: '分享邀请码，双方各得积分奖励',
    backToApp: '返回应用',
    createCode: '创建邀请码',
    yourCodes: '我的邀请码',
    noCodesYet: '还没有邀请码，点击上方按钮创建',
    code: '邀请码',
    status: '状态',
    createdAt: '创建时间',
    usedAt: '使用时间',
    actions: '操作',
    active: '可用',
    used: '已使用',
    expired: '已过期',
    copyCode: '复制邀请码',
    copyLink: '复制邀请链接',
    deleteCode: '删除',
    copied: '已复制到剪贴板',
    deleteConfirm: '确定要删除这个邀请码吗？',
    deleteTitle: '删除邀请码',
    deleteSuccess: '邀请码已删除',
    createSuccess: '邀请码创建成功',
    inviteDisabled: '邀请功能暂时关闭',
    maxCodesReached: '已达到最大邀请码数量',
    stats: {
      title: '邀请统计',
      invited: '已邀请',
      earned: '获得积分',
      bonus: '每次邀请奖励',
    },
    tips: {
      title: '邀请说明',
      tip1: '每个邀请码只能使用一次',
      tip2: '被邀请人通过您的邀请码注册后，双方各获得 {{bonus}} 积分',
      tip3: '您最多可以创建 {{max}} 个邀请码',
    },
  },
  en: {
    title: 'Invite Friends',
    subtitle: 'Share invitation code, both parties earn bonus credits',
    backToApp: 'Back to App',
    createCode: 'Create Invitation Code',
    yourCodes: 'My Invitation Codes',
    noCodesYet: 'No invitation codes yet, click the button above to create',
    code: 'Code',
    status: 'Status',
    createdAt: 'Created',
    usedAt: 'Used',
    actions: 'Actions',
    active: 'Active',
    used: 'Used',
    expired: 'Expired',
    copyCode: 'Copy Code',
    copyLink: 'Copy Link',
    deleteCode: 'Delete',
    copied: 'Copied to clipboard',
    deleteConfirm: 'Are you sure you want to delete this invitation code?',
    deleteTitle: 'Delete Invitation Code',
    deleteSuccess: 'Invitation code deleted',
    createSuccess: 'Invitation code created',
    inviteDisabled: 'Invitation feature is currently disabled',
    maxCodesReached: 'Maximum number of invitation codes reached',
    stats: {
      title: 'Invitation Statistics',
      invited: 'Invited',
      earned: 'Credits Earned',
      bonus: 'Bonus per Invite',
    },
    tips: {
      title: 'How it works',
      tip1: 'Each invitation code can only be used once',
      tip2: 'When someone registers with your code, both of you get {{bonus}} credits',
      tip3: 'You can create up to {{max}} invitation codes',
    },
  },
};

interface InvitationCode {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired';
  invitee_id?: string;
  created_at: string;
  used_at?: string;
}

interface InvitationStats {
  invited_count: number;
  total_bonus_earned: number;
  bonus_per_invite: number;
}

export const InvitationPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT(invitationI18n);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [maxCodes, setMaxCodes] = useState(3);
  const [invitationBonus, setInvitationBonus] = useState(50);
  const [enableInvitation, setEnableInvitation] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [codesRes, statsRes] = await Promise.all([
        api.getInvitationCodes(),
        api.getInvitationStats(),
      ]);

      if (codesRes.data) {
        setCodes(codesRes.data.codes || []);
        setMaxCodes(codesRes.data.max_codes || 3);
        setInvitationBonus(codesRes.data.invitation_bonus || 50);
        setEnableInvitation(codesRes.data.enable_invitation !== false);
      }

      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error: any) {
      show({ message: error?.message || 'Failed to load data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCode = async () => {
    if (!enableInvitation) {
      show({ message: t('inviteDisabled'), type: 'error' });
      return;
    }

    const activeCodes = codes.filter(c => c.status === 'active').length;
    if (activeCodes >= maxCodes) {
      show({ message: t('maxCodesReached'), type: 'error' });
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.createInvitationCode();
      if (res.data) {
        setCodes(prev => [res.data, ...prev]);
        show({ message: t('createSuccess'), type: 'success' });
      }
    } catch (error: any) {
      show({ message: error?.response?.data?.error?.message || error?.message, type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = (codeId: string) => {
    confirm(t('deleteConfirm'), async () => {
      try {
        await api.deleteInvitationCode(codeId);
        setCodes(prev => prev.filter(c => c.id !== codeId));
        show({ message: t('deleteSuccess'), type: 'success' });
      } catch (error: any) {
        show({ message: error?.response?.data?.error?.message || error?.message, type: 'error' });
      }
    }, {
      title: t('deleteTitle'),
      confirmText: t('deleteCode'),
      variant: 'danger',
    });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    show({ message: t('copied'), type: 'success' });
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/register?invite=${code}`;
    navigator.clipboard.writeText(link);
    show({ message: t('copied'), type: 'success' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      used: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    const labels = {
      active: t('active'),
      used: t('used'),
      expired: t('expired'),
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.active}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary">
      <ToastContainer />
      {ConfirmDialog}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-border-primary">
            <div className="flex items-center">
              <Button
                variant="secondary"
                icon={<Home size={18} />}
                onClick={() => navigate('/app')}
                className="mr-4"
              >
                {t('backToApp')}
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary flex items-center">
                  <Gift className="mr-2" size={24} />
                  {t('title')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 my-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.invited_count}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('stats.invited')}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_bonus_earned}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('stats.earned')}</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.bonus_per_invite}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('stats.bonus')}</div>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-gray-50 dark:bg-background-secondary p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 dark:text-foreground-primary mb-2">{t('tips.title')}</h3>
            <ul className="text-sm text-gray-600 dark:text-foreground-tertiary space-y-1">
              <li>• {t('tips.tip1')}</li>
              <li>• {t('tips.tip2', { bonus: invitationBonus })}</li>
              <li>• {t('tips.tip3', { max: maxCodes })}</li>
            </ul>
          </div>

          {/* Create Button */}
          {enableInvitation && (
            <div className="mb-6">
              <Button
                variant="primary"
                icon={<Plus size={18} />}
                onClick={handleCreateCode}
                loading={isCreating}
                disabled={codes.filter(c => c.status === 'active').length >= maxCodes}
              >
                {t('createCode')}
              </Button>
            </div>
          )}

          {/* Codes List */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
              <Users className="mr-2" size={20} />
              {t('yourCodes')}
            </h2>

            {codes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-foreground-tertiary">
                {t('noCodesYet')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-foreground-tertiary border-b dark:border-border-primary">
                      <th className="pb-2">{t('code')}</th>
                      <th className="pb-2">{t('status')}</th>
                      <th className="pb-2">{t('createdAt')}</th>
                      <th className="pb-2">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map(code => (
                      <tr key={code.id} className="border-b dark:border-border-primary">
                        <td className="py-3">
                          <code className="bg-gray-100 dark:bg-background-secondary px-2 py-1 rounded font-mono">
                            {code.code}
                          </code>
                        </td>
                        <td className="py-3">{getStatusBadge(code.status)}</td>
                        <td className="py-3 text-sm text-gray-600 dark:text-foreground-tertiary">
                          {formatDate(code.created_at)}
                          {code.used_at && (
                            <div className="text-xs text-gray-400">
                              {t('usedAt')}: {formatDate(code.used_at)}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Copy size={14} />}
                              onClick={() => handleCopyCode(code.code)}
                              title={t('copyCode')}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Share2 size={14} />}
                              onClick={() => handleCopyLink(code.code)}
                              title={t('copyLink')}
                            />
                            {code.status === 'active' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Trash2 size={14} />}
                                onClick={() => handleDeleteCode(code.id)}
                                title={t('deleteCode')}
                                className="text-red-500 hover:text-red-700"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
