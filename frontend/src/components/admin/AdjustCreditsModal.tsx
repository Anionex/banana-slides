/**
 * AdjustCreditsModal - modal to adjust a user's credit balance
 */
import { useState } from 'react';
import { useT } from '../../hooks/useT';

const i18n = {
  zh: {
    title: '调整积分',
    amount: '数量（正数增加，负数减少）',
    reason: '原因',
    cancel: '取消',
    confirm: '确认',
    currentBalance: '当前余额',
  },
  en: {
    title: 'Adjust Credits',
    amount: 'Amount (positive to add, negative to subtract)',
    reason: 'Reason',
    cancel: 'Cancel',
    confirm: 'Confirm',
    currentBalance: 'Current balance',
  },
};

interface AdjustCreditsModalProps {
  userEmail: string;
  currentBalance: number;
  onConfirm: (amount: number, reason: string) => void;
  onClose: () => void;
}

export default function AdjustCreditsModal({
  userEmail,
  currentBalance,
  onConfirm,
  onClose,
}: AdjustCreditsModalProps) {
  const t = useT(i18n);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    const parsed = parseInt(amount, 10);
    if (isNaN(parsed) || parsed === 0) return;
    onConfirm(parsed, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-background-secondary rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary mb-1">
          {t('title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-foreground-secondary mb-4">
          {userEmail} &mdash; {t('currentBalance')}: {currentBalance}
        </p>

        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
          {t('amount')}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-primary text-gray-900 dark:text-foreground-primary focus:ring-2 focus:ring-banana-500 outline-none"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
          {t('reason')}
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-primary text-gray-900 dark:text-foreground-primary focus:ring-2 focus:ring-banana-500 outline-none"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount || parseInt(amount, 10) === 0}
            className="px-4 py-2 text-sm rounded-lg bg-banana-500 text-white hover:bg-banana-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
