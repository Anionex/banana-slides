/**
 * Forgot Password Page Component
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<'email' | 'verify' | 'reset' | 'success'>('email');
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Verification code sending state
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = async () => {
        setError('');
        setSuccessMessage('');

        if (!email || !email.includes('@')) {
            setError('请输入有效的邮箱地址');
            return;
        }

        setIsSendingCode(true);
        try {
            const response = await authApi.sendVerificationCode({
                email,
                code_type: 'reset_password',
            });
            setStep('verify');
            setCountdown(60);
            setSuccessMessage(response.message);
        } catch (err: any) {
            const message = err.response?.data?.error || '发送验证码失败';
            setError(message);
            if (err.response?.data?.wait_seconds) {
                setCountdown(err.response.data.wait_seconds);
            }
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleVerifyCode = async () => {
        setError('');
        setSuccessMessage('');

        if (verificationCode.length !== 6) {
            setError('请输入6位验证码');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authApi.verifyCode(email, verificationCode, 'reset_password');
            if (response.valid) {
                setStep('reset');
            } else {
                setError(response.error || '验证码无效');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || '验证失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setError('');
        setSuccessMessage('');

        if (newPassword.length < 6) {
            setError('密码长度不能少于6位');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setIsLoading(true);
        try {
            await authApi.resetPassword({
                email,
                verification_code: verificationCode,
                new_password: newPassword,
            });
            setStep('success');
        } catch (err: any) {
            setError(err.response?.data?.error || '重置密码失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-amber-50 py-12">
            <div className="w-full max-w-md px-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl mb-4 shadow-lg">
                        <span className="text-3xl">🍌</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {step === 'success' ? '密码已重置' : '重置密码'}
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {step === 'email' && '输入您的注册邮箱'}
                        {step === 'verify' && '输入邮箱收到的验证码'}
                        {step === 'reset' && '设置您的新密码'}
                        {step === 'success' && '您可以使用新密码登录了'}
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {/* Progress Steps */}
                    {step !== 'success' && (
                        <div className="flex items-center justify-center mb-6">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'email' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700'
                                }`}>1</div>
                            <div className={`w-12 h-1 ${step !== 'email' ? 'bg-yellow-500' : 'bg-gray-200'}`} />
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'verify' ? 'bg-yellow-500 text-white' :
                                    step === 'reset' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-400'
                                }`}>2</div>
                            <div className={`w-12 h-1 ${step === 'reset' ? 'bg-yellow-500' : 'bg-gray-200'}`} />
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'reset' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-400'
                                }`}>3</div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && step !== 'success' && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm mb-4">
                            {successMessage}
                        </div>
                    )}

                    {/* Step: Email */}
                    {step === 'email' && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    注册邮箱
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                />
                            </div>
                            <button
                                onClick={handleSendCode}
                                disabled={isSendingCode || countdown > 0 || !email}
                                className="w-full py-3 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 focus:ring-4 focus:ring-yellow-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-200"
                            >
                                {isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}s 后重试` : '发送验证码'}
                            </button>
                        </div>
                    )}

                    {/* Step: Verify */}
                    {step === 'verify' && (
                        <div className="space-y-5">
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
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSendCode}
                                    disabled={isSendingCode || countdown > 0}
                                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-all"
                                >
                                    {countdown > 0 ? `${countdown}s` : '重新发送'}
                                </button>
                                <button
                                    onClick={handleVerifyCode}
                                    disabled={isLoading || verificationCode.length !== 6}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 disabled:opacity-50 transition-all"
                                >
                                    {isLoading ? '验证中...' : '下一步'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Reset */}
                    {step === 'reset' && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    新密码
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                    placeholder="至少6个字符"
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    确认新密码
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                    placeholder="再次输入新密码"
                                    autoComplete="new-password"
                                />
                            </div>
                            <button
                                onClick={handleResetPassword}
                                disabled={isLoading || !newPassword || !confirmPassword}
                                className="w-full py-3 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 focus:ring-4 focus:ring-yellow-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-200"
                            >
                                {isLoading ? '重置中...' : '重置密码'}
                            </button>
                        </div>
                    )}

                    {/* Step: Success */}
                    {step === 'success' && (
                        <div className="text-center space-y-5">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-gray-600">
                                您的密码已成功重置，请使用新密码登录。
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all shadow-lg shadow-yellow-200"
                            >
                                去登录
                            </button>
                        </div>
                    )}

                    {/* Back to Login */}
                    {step !== 'success' && (
                        <p className="mt-6 text-center text-sm text-gray-500">
                            <Link to="/login" className="text-yellow-600 hover:text-yellow-700 font-medium">
                                ← 返回登录
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
