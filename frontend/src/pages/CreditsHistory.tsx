import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Loading, Card } from '@/components/shared';
import { useAuthStore } from '@/store/useAuthStore';
import { useT } from '@/hooks/useT';
import { paymentApi } from '@/api/payment';
import type { CreditTransaction } from '@/api/payment';

const PAGE_SIZE = 20;

const creditsHistoryI18n = {
  zh: {
    nav: { home: '主页' },
    credits: {
      title: '积分明细',
      subtitle: '查看你的积分消耗和充值记录',
      currentBalance: '当前余额',
      noRecords: '暂无积分记录',
      noRecordsHint: '使用 AI 功能后，积分变动记录将显示在这里',
      time: '时间',
      operation: '操作类型',
      amount: '积分变动',
      balance: '余额',
      description: '描述',
      loadFailed: '加载积分明细失败',
      prev: '上一页',
      next: '下一页',
      pageInfo: '第 {{current}} 页，共 {{total}} 页',
    },
    operations: {
      generate_outline: '生成大纲',
      generate_description: '生成描述',
      generate_image: '生成图片',
      edit_image: '编辑图片',
      generate_material: '生成素材',
      refine_outline: '修改大纲',
      refine_description: '修改描述',
      parse_file: '解析文件',
      export_editable: '导出可编辑PPTX',
      purchase: '购买积分',
      bonus: '赠送积分',
      refund: '退款',
    },
  },
  en: {
    nav: { home: 'Home' },
    credits: {
      title: 'Credits History',
      subtitle: 'View your credits consumption and top-up records',
      currentBalance: 'Current Balance',
      noRecords: 'No credit records yet',
      noRecordsHint: 'Credit transactions will appear here after using AI features',
      time: 'Time',
      operation: 'Operation',
      amount: 'Credits',
      balance: 'Balance',
      description: 'Description',
      loadFailed: 'Failed to load credits history',
      prev: 'Previous',
      next: 'Next',
      pageInfo: 'Page {{current}} of {{total}}',
    },
    operations: {
      generate_outline: 'Generate Outline',
      generate_description: 'Generate Description',
      generate_image: 'Generate Image',
      edit_image: 'Edit Image',
      generate_material: 'Generate Material',
      refine_outline: 'Refine Outline',
      refine_description: 'Refine Description',
      parse_file: 'Parse File',
      export_editable: 'Export Editable PPTX',
      purchase: 'Purchase Credits',
      bonus: 'Bonus Credits',
      refund: 'Refund',
    },
  },
};

export const CreditsHistory: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(creditsHistoryI18n);
  const { user } = useAuthStore();

  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const loadTransactions = useCallback(async (newOffset: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await paymentApi.getTransactions(PAGE_SIZE, newOffset);
      setTransactions(data.transactions);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err: any) {
      console.error('加载积分明细失败:', err);
      setError(err.message || t('credits.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTransactions(0);
  }, []);

  const handlePrev = () => {
    if (offset >= PAGE_SIZE) {
      loadTransactions(offset - PAGE_SIZE);
    }
  };

  const handleNext = () => {
    if (offset + PAGE_SIZE < total) {
      loadTransactions(offset + PAGE_SIZE);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const lang = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
    return d.toLocaleString(lang, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOperationLabel = (op: string) => {
    return t(`operations.${op}` as any, op);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary">
      {/* Nav */}
      <nav className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-100 dark:border-border-primary">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-banana-500 to-banana-600 rounded-lg flex items-center justify-center text-xl md:text-2xl">
              🍌
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('credits.title')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Home size={16} />}
            onClick={() => navigate('/')}
          >
            {t('nav.home')}
          </Button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-8">
        {/* Header + Balance */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-foreground-primary mb-1">{t('credits.title')}</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-foreground-tertiary">{t('credits.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
            <span className="text-sm text-amber-700 dark:text-amber-300">{t('credits.currentBalance')}</span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{user?.credits_balance ?? 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 dark:text-foreground-tertiary mb-4">{error}</p>
            <Button variant="primary" onClick={() => loadTransactions(0)}>
              {t('common.retry', 'Retry')}
            </Button>
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
              {t('credits.noRecords')}
            </h3>
            <p className="text-gray-500 dark:text-foreground-tertiary">
              {t('credits.noRecordsHint')}
            </p>
          </Card>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-border-primary">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-background-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-foreground-tertiary">{t('credits.time')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-foreground-tertiary">{t('credits.operation')}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-foreground-tertiary">{t('credits.amount')}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-foreground-tertiary">{t('credits.balance')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-foreground-tertiary hidden md:table-cell">{t('credits.description')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-border-primary bg-white dark:bg-background-secondary">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-background-hover transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-foreground-secondary whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-foreground-primary">
                        {getOperationLabel(tx.operation)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        tx.amount > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-foreground-secondary">
                        {tx.balance_after}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary hidden md:table-cell truncate max-w-[200px]">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft size={16} />}
                  onClick={handlePrev}
                  disabled={currentPage <= 1}
                >
                  {t('credits.prev')}
                </Button>
                <span className="text-sm text-gray-600 dark:text-foreground-tertiary">
                  {t('credits.pageInfo', { current: currentPage, total: totalPages })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentPage >= totalPages}
                >
                  {t('credits.next')}
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
