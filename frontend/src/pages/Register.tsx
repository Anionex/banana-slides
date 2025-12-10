/**
 * Register Page Component with Email Verification
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth';

export const Register: React.FC = () => {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Verification code sending state
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = async () => {
        setLocalError('');
        setSuccessMessage('');

        // Validate email
        if (!email || !email.includes('@')) {
            setLocalError('请输入有效的邮箱地址');
            return;
        }

        setIsSendingCode(true);
        try {
            const response = await authApi.sendVerificationCode({
                email,
                code_type: 'register',
            });
            setCodeSent(true);
            setCountdown(60); // 60 seconds cooldown
            setSuccessMessage(response.message);
        } catch (err: any) {
            const message = err.response?.data?.error || '发送验证码失败';
            setLocalError(message);
            // Handle rate limit
            if (err.response?.data?.wait_seconds) {
                setCountdown(err.response.data.wait_seconds);
            }
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        setSuccessMessage('');
        clearError();

        // Validation
        if (!username || !email || !password || !verificationCode) {
            setLocalError('请填写所有必填项');
            return;
        }

        if (username.length < 3) {
            setLocalError('用户名至少需要3个字符');
            return;
        }

        if (verificationCode.length !== 6) {
            setLocalError('请输入6位验证码');
            return;
        }

        if (password.length < 6) {
            setLocalError('密码至少需要6个字符');
            return;
        }

        if (password !== confirmPassword) {
            setLocalError('两次输入的密码不一致');
            return;
        }

        try {
            await register(username, email, password, verificationCode);
            navigate('/');
        } catch (err: any) {
            setLocalError(err.message || '注册失败');
        }
    };

    const handleOAuthLogin = (provider: 'google' | 'github') => {
        const url = provider === 'google'
            ? authApi.getGoogleAuthUrl()
            : authApi.getGitHubAuthUrl();
        window.location.href = url;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-amber-50 py-12">
            <div className="w-full max-w-md px-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl mb-4 shadow-lg">
                        <span className="text-3xl">🍌</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
                    <p className="text-gray-500 mt-2">开始你的 AI PPT 之旅</p>
                </div>

                {/* Register Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Message */}
                        {(localError || error) && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {localError || error}
                            </div>
                        )}

                        {/* Success Message */}
                        {successMessage && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                                {successMessage}
                            </div>
                        )}

                        {/* Email with Send Code Button */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                邮箱
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={isSendingCode || countdown > 0 || !email}
                                    className="px-4 py-3 bg-yellow-100 text-yellow-700 font-medium rounded-xl hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                >
                                    {isSendingCode ? (
                                        <span className="flex items-center gap-1">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            发送中
                                        </span>
                                    ) : countdown > 0 ? (
                                        `${countdown}s`
                                    ) : codeSent ? (
                                        '重新发送'
                                    ) : (
                                        '获取验证码'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Verification Code */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                验证码
                            </label>
                            <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all text-center text-lg tracking-widest font-mono"
                                placeholder="请输入6位验证码"
                                maxLength={6}
                            />
                        </div>

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                用户名
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                placeholder="选择一个用户名"
                                autoComplete="username"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                密码
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                placeholder="至少6个字符"
                                autoComplete="new-password"
                            />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                确认密码
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                placeholder="再次输入密码"
                                autoComplete="new-password"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !verificationCode}
                            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 focus:ring-4 focus:ring-yellow-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-200"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    注册中...
                                </span>
                            ) : '创建账号'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">或使用以下方式注册</span>
                        </div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => handleOAuthLogin('google')}
                            className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Google</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOAuthLogin('github')}
                            className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">GitHub</span>
                        </button>
                    </div>

                    {/* Login Link */}
                    <p className="mt-6 text-center text-sm text-gray-500">
                        已有账号？{' '}
                        <Link to="/login" className="text-yellow-600 hover:text-yellow-700 font-medium">
                            立即登录
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
