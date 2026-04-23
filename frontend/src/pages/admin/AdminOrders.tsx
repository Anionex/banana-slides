/**
 * Admin Orders page
 * Payment order audit with search, filters, and pagination
 */
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../hooks/useT';
import { getAdminOrders } from '../../api/adminApi';
import { Search, Filter, Calendar, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

const PAGE_SIZE = 50;

const i18n = {
  zh: {
    title: '订单审计',
    searchPlaceholder: '按用户ID筛选...',
    allStatus: '全部状态',
    startDate: '开始日期',
    endDate: '结束日期',
    prev: '上一页',
    next: '下一页',
    total: '共 {{count}} 条记录',
    loading: '加载中...',
    error: '加载失败',
    noData: '暂无数据',
    user: '用户',
    package: '套餐',
    amount: '金额',
    credits: '积分',
    status: '状态',
    provider: '支付方式',
    time: '时间',
    paidTime: '支付时间',
    orderId: '订单号',
    // Status
    status_pending: '待支付',
    status_paid: '已支付',
    status_failed: '支付失败',
    status_refunded: '已退款',
    status_cancelled: '已取消',
  },
  en: {
    title: 'Order Audit',
    searchPlaceholder: 'Filter by user ID...',
    allStatus: 'All Status',
    startDate: 'Start Date',
    endDate: 'End Date',
    prev: 'Previous',
    next: 'Next',
    total: '{{count}} records total',
    loading: 'Loading...',
    error: 'Failed to load',
    noData: 'No data',
    user: 'User',
    package: 'Package',
    amount: 'Amount',
    credits: 'Credits',
    status: 'Status',
    provider: 'Provider',
    time: 'Time',
    paidTime: 'Paid At',
    orderId: 'Order ID',
    // Status
    status_pending: 'Pending',
    status_paid: 'Paid',
    status_failed: 'Failed',
    status_refunded: 'Refunded',
    status_cancelled: 'Cancelled',
  },
};

const ORDER_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];

interface Order {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  amount: number;
  currency: string;
  payment_provider: string;
  payment_type?: string;
  external_order_id?: string;
  status: string;
  created_at: string;
  paid_at?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'paid':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'refunded':
      return <AlertCircle className="w-4 h-4 text-blue-500" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-gray-500" />;
    default:
      return null;
  }
};

const StatusBadge = ({ status, label }: { status: string; label: string }) => {
  const colorClass = {
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    refunded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
  }[status] || 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      <StatusIcon status={status} />
      {label}
    </span>
  );
};

export default function AdminOrders() {
  const t = useT(i18n);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await getAdminOrders({
        limit: PAGE_SIZE,
        offset,
        user_id: userId || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      const data = res.data.data;
      setOrders(data.orders);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [offset, userId, status, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setOffset(0);
  }, [userId, status, startDate, endDate]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getStatusLabel = (status: string) => {
    const key = `status_${status}` as keyof typeof i18n.zh;
    return t(key) || status;
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CNY') {
      return `¥${amount.toFixed(2)}`;
    } else if (currency === 'USD') {
      return `$${amount.toFixed(2)}`;
    }
    return `${amount.toFixed(2)} ${currency}`;
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
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm focus:ring-2 focus:ring-banana-500 outline-none w-56"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
            >
              <option value="">{t('allStatus')}</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {getStatusLabel(s)}
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
          ) : orders.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-foreground-secondary">{t('noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-background-tertiary text-gray-600 dark:text-foreground-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t('time')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('user')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('package')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('amount')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('credits')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('status')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('provider')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('orderId')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-background-hover">
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
                        <div>{formatTime(order.created_at)}</div>
                        {order.paid_at && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            {t('paidTime')}: {formatTime(order.paid_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 dark:text-foreground-primary">
                          {order.user?.email || order.user_id}
                        </div>
                        {order.user?.username && (
                          <div className="text-xs text-gray-500 dark:text-foreground-tertiary">
                            {order.user.username}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 dark:text-foreground-primary font-medium">
                          {order.package_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-foreground-tertiary">
                          {order.package_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-foreground-primary font-medium">
                        {formatCurrency(order.amount, order.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900 dark:text-foreground-primary font-medium">
                          {order.total_credits}
                        </div>
                        {order.bonus_credits > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            +{order.bonus_credits} bonus
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} label={getStatusLabel(order.status)} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary">
                        <div>{order.payment_provider}</div>
                        {order.payment_type && (
                          <div className="text-xs">{order.payment_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-foreground-tertiary">
                        <div className="text-xs font-mono truncate max-w-[120px]" title={order.id}>
                          {order.id.substring(0, 8)}...
                        </div>
                        {order.external_order_id && (
                          <div className="text-xs font-mono truncate max-w-[120px]" title={order.external_order_id}>
                            ext: {order.external_order_id.substring(0, 8)}...
                          </div>
                        )}
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
