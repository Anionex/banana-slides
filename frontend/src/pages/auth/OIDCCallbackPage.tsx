/**
 * OIDC Callback Page
 * 处理 Supabase / 旧 OIDC 登录回调
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { checkAuth } from '../../api/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

export default function OIDCCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const handleError = (message: string) => {
      if (!active) {
        return;
      }
      setError(message);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    };

    const handleSupabaseCallback = async () => {
      const code = searchParams.get('code');

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        }

        const ok = await checkAuth();
        if (!ok) {
          throw new Error('未能完成登录，请重试');
        }

        navigate('/app', { replace: true });
      } catch (err: any) {
        handleError(err?.message || '登录失败，请重试');
      }
    };

    const handleLegacyCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        handleError('授权失败');
        return;
      }

      const savedState = sessionStorage.getItem('oidc_state');
      const provider = sessionStorage.getItem('oidc_provider') || 'google';

      if (!state || state !== savedState) {
        handleError('安全验证失败');
        return;
      }

      sessionStorage.removeItem('oidc_state');
      sessionStorage.removeItem('oidc_provider');

      try {
        const response = await fetch(`/api/auth/oidc/callback?code=${encodeURIComponent(code)}&provider=${provider}&state=${encodeURIComponent(state)}`);
        const data = await response.json();

        if (data.success && data.data) {
          const { user, access_token, refresh_token, token_type, expires_in } = data.data;
          login(user, { access_token, refresh_token, token_type, expires_in }, true);
          navigate('/app', { replace: true });
          return;
        }

        handleError(data.error?.message || '登录失败');
      } catch (err: any) {
        handleError(err?.message || '登录失败，请重试');
      }
    };

    if (isSupabaseConfigured()) {
      handleSupabaseCallback();
    } else {
      handleLegacyCallback();
    }

    return () => {
      active = false;
    };
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
            <div className="text-gray-600 dark:text-foreground-secondary">正在返回登录页...</div>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-banana-500 mx-auto mb-4"></div>
            <div className="text-gray-600 dark:text-foreground-secondary">正在登录...</div>
          </>
        )}
      </div>
    </div>
  );
}
