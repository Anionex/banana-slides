import { useState, useEffect, type ReactNode } from 'react';
import { checkAccessCode, verifyAccessCode } from '@/api/endpoints';
import { useT } from '@/hooks/useT';
import { Button } from './Button';
import { Input } from './Input';

const STORAGE_KEY = 'banana-access-code';

const translations = {
  zh: {
    title: '请输入访问口令',
    placeholder: '输入口令',
    submit: '确认',
    error: '口令错误，请重试',
    networkError: '网络错误，请稍后重试',
  },
  en: {
    title: 'Enter Access Code',
    placeholder: 'Enter code',
    submit: 'Submit',
    error: 'Invalid code, please try again',
    networkError: 'Network error, please try later',
  },
};

export function AccessCodeGuard({ children }: { children: ReactNode }) {
  const t = useT(translations);
  const [status, setStatus] = useState<'loading' | 'prompt' | 'pass'>('loading');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await checkAccessCode();
        if (!res.data.enabled) { setStatus('pass'); return; }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const v = await verifyAccessCode(saved);
          if (v.data.valid) { setStatus('pass'); return; }
          localStorage.removeItem(STORAGE_KEY);
        }
        setStatus('prompt');
      } catch {
        // Fail-closed: if we can't reach the server, show prompt
        localStorage.removeItem(STORAGE_KEY);
        setStatus('prompt');
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    setError('');
    try {
      const res = await verifyAccessCode(code.trim());
      if (res.data.valid) {
        localStorage.setItem(STORAGE_KEY, code.trim());
        setStatus('pass');
      } else {
        setError(t('error'));
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? t('error') : t('networkError'));
    } finally {
      setVerifying(false);
    }
  };

  if (status === 'loading') return null;
  if (status === 'pass') return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary">
      <div className="w-80 p-6 rounded-2xl bg-white dark:bg-background-secondary shadow-lg border border-gray-200 dark:border-border-primary">
        <h2 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-foreground-primary">
          {t('title')}
        </h2>
        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          <Input
            type="password"
            placeholder={t('placeholder')}
            value={code}
            onChange={e => setCode(e.target.value)}
            error={error}
            autoFocus
          />
          <Button type="submit" className="w-full" loading={verifying}>
            {t('submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
