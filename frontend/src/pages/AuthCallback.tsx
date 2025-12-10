/**
 * OAuth Callback Page
 * Handles the redirect from OAuth providers and stores the tokens
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setTokensFromOAuth } = useAuthStore();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const accessToken = searchParams.get('access_token');
            const refreshToken = searchParams.get('refresh_token');
            const errorParam = searchParams.get('error');

            if (errorParam) {
                setError(decodeURIComponent(errorParam));
                return;
            }

            if (accessToken && refreshToken) {
                try {
                    await setTokensFromOAuth(accessToken, refreshToken);
                    navigate('/');
                } catch (err) {
                    setError('登录失败，请重试');
                }
            } else {
                setError('无效的回调参数');
            }
        };

        handleCallback();
    }, [searchParams, setTokensFromOAuth, navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">登录失败</h1>
                    <p className="text-gray-500 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                        返回登录
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-2xl">🍌</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">正在登录...</h1>
                <p className="text-gray-500">请稍候</p>
            </div>
        </div>
    );
};

export default AuthCallback;
