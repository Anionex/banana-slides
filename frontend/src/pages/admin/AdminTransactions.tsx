/**
 * Admin Transactions page
 * Credit transaction audit with search, filters, and pagination
 */
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../hooks/useT';
import { getAdminTransactions } from '../../api/adminApi';
import { ArrowUpRight, ArrowDownRight, Search, Filter, Calendar } from 'lucide-react';

const PAGE_SIZE = 50;

const i18n = {
  zh: {
    title: '积分明细审计',
    searchPlaceholder: '按用户名/邮箱/ID筛选...',
    allOperations: '全部操作类型',
    startDate: '开始日期',
    endDate: '结束日期',
    prev: '上一页',
    next: '下一页',
    total: '共 {{count}} 条记录',
    loading: '加载中...',
    error: '加载失败',
    noData: '暂无数据',
    user: '用户',
    operation: '操作类型',
    amount: '金额',
    balance: '余额',
    description: '描述',
    time: '时间',
    project: '项目',
    // Operations
    op_GENERATE_OUTLINE: '生成大纲',
    op_GENERATE_DESCRIPTION: '生成描述',
    op_GENERATE_IMAGE: '生成图片',
    op_EDIT_IMAGE: '编辑图片',
    op_GENERATE_MATERIAL: '生成素材',
    op_REFINE_OUTLINE: '优化大纲',
    op_REFINE_DESCRIPTION: '优化描述',
    op_PARSE_FILE: '解析文件',
    op_EXPORT_EDITABLE: '导出可编辑',
    op_PURCHASE: '购买充值',
    op_BONUS: '赠送积分',
    op_REFUND: '退款',
    op_ADMIN_ADJUST: '管理员调整',
  },
  en: {
    title: 'Credit Transaction Audit',
    searchPlaceholder: 'Filter by name/email/ID...',
    allOperations: 'All Operations',
    startDate: 'Start Date',
    endDate: 'End Date',
    prev: 'Previous',
    next: 'Next',
    total: '{{count}} records total',
    loading: 'Loading...',
    error: 'Failed to load',
    noData: 'No data',
    user: 'User',
    operation: 'Operation',
    amount: 'Amount',
    balance: 'Balance',
    description: 'Description',
    time: 'Time',
    project: 'Project',
    // Operations
    op_GENERATE_OUTLINE: 'Generate Outline',
    op_GENERATE_DESCRIPTION: 'Generate Description',
    op_GENERATE_IMAGE: 'Generate Image',
    op_EDIT_IMAGE: 'Edit Image',
    op_GENERATE_MATERIAL: 'Generate Material',
    op_REFINE_OUTLINE: 'Refine Outline',
    op_REFINE_DESCRIPTION: 'Refine Description',
    op_PARSE_FILE: 'Parse File',
    op_EXPORT_EDITABLE: 'Export Editable',
    op_PURCHASE: 'Purchase',
    op_BONUS: 'Bonus',
    op_REFUND: 'Refund',
    op_ADMIN_ADJUST: 'Admin Adjust',
  },
};

const OPERATION_TYPES = [
  'GENERATE_OUTLINE',
  'GENERATE_DESCRIPTION',
  'GENERATE_IMAGE',
  'EDIT_IMAGE',
  'GENERATE_MATERIAL',
  'REFINE_OUTLINE',
  'REFINE_DESCRIPTION',
  'PARSE_FILE',
  'EXPORT_EDITABLE',
  'PURCHASE',
  'BONUS',
  'REFUND',
  'ADMIN_ADJUST',
];

interface Transaction {
  id: string;
  user_id: string;
  operation: string;
  amount: number;
  balance_after: number;
  description?: string;
  project_id?: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
}

export default function AdminTransactions() {
  const t = useT(i18n);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [operation, setOperation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await getAdminTransactions({
        limit: PAGE_SIZE,
        offset,
        user_search: userSearch || undefined,
        operation: operation || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      const data = res.data.data;
      setTransactions(data.transactions);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [offset, userSearch, operation, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setOffset(0);
  }, [userSearch, operation, startDate, endDate]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getOperationLabel = (op: string) => {
    const key = `op_${op}` as keyof typeof i18n.zh;
    return t(key) || op;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm focus:ring-2 focus:ring-banana-500 outline-none w-56"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
            >
              <option value="">{t('allOperations')}</option>
              {OPERATION_TYPES.map((op) => (
                <option key={op} value={op}>
                  {getOperationLabel(op)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
              placeholder={t('startDate')}
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
              placeholder={t('endDate')}
            />
          </div>
          <span className="ml-auto text-sm text-gray-500 dark:text-foreground-secondary">
            {t('total', { count: total })}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-center py-8 text-gray-500 dark:text-foreground-secondary">
              {t('loading')}
            </p>
          ) : error ? (
            <p className="text-center py-8 text-red-500">{t('error')}</p>
          ) : transactions.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-foreground-secondary">{t('noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-background-tertiary text-gray-600 dark:text-foreground-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t('time')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('user')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('operation')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('amount')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('balance')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('description')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-background-hover">
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
                        {formatTime(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 dark:text-foreground-primary">
                          {tx.user?.email || tx.user_id}
                        </div>
                        {tx.user?.username && (
                          <div className="text-xs text-gray-500 dark:text-foreground-tertiary">
                            {tx.user.username}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {getOperationLabel(tx.operation)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {tx.amount >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          {tx.amount >= 0 ? '+' : ''}
                          {tx.amount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-foreground-primary font-medium">
                        {tx.balance_after}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary max-w-xs truncate">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-gray-500 dark:text-foreground-secondary">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} / {total}
            </span>
            <button
              disabled={!hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('next')}
            </button>
          </div>
        )}
    </div>
  );
}
