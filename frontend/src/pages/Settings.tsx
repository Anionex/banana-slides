/**
 * Settings Page Component
 * Allows users to configure their API keys and preferences
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const {
        user,
        isAuthenticated,
        settings,
        effectiveConfig,
        fetchSettings,
        updateSettings,
        resetSetting,
        logout
    } = useAuthStore();

    // Form state
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [googleApiBase, setGoogleApiBase] = useState('');
    const [mineruToken, setMineruToken] = useState('');
    const [mineruApiBase, setMineruApiBase] = useState('');
    const [imageCaptionModel, setImageCaptionModel] = useState('');
    const [maxDescriptionWorkers, setMaxDescriptionWorkers] = useState<number | ''>('');
    const [maxImageWorkers, setMaxImageWorkers] = useState<number | ''>('');

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Load settings
    useEffect(() => {
        if (isAuthenticated) {
            fetchSettings();
        }
    }, [isAuthenticated, fetchSettings]);

    // Populate form with current settings
    useEffect(() => {
        if (settings) {
            setGoogleApiBase(settings.google_api_base || '');
            setMineruApiBase(settings.mineru_api_base || '');
            setImageCaptionModel(settings.image_caption_model || '');
            setMaxDescriptionWorkers(settings.max_description_workers || '');
            setMaxImageWorkers(settings.max_image_workers || '');
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            await updateSettings({
                google_api_key: googleApiKey || undefined,
                google_api_base: googleApiBase || undefined,
                mineru_token: mineruToken || undefined,
                mineru_api_base: mineruApiBase || undefined,
                image_caption_model: imageCaptionModel || undefined,
                max_description_workers: maxDescriptionWorkers ? Number(maxDescriptionWorkers) : undefined,
                max_image_workers: maxImageWorkers ? Number(maxImageWorkers) : undefined,
            });
            setMessage({ type: 'success', text: '设置已保存' });
            // Clear sensitive fields after saving
            setGoogleApiKey('');
            setMineruToken('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || '保存失败' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetSetting = async (key: string) => {
        try {
            await resetSetting(key);
            setMessage({ type: 'success', text: `${key} 已重置为系统默认值` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || '重置失败' });
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-900">设置</h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                        退出登录
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Profile Section */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">个人资料</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-2xl">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span>🍌</span>
                            )}
                        </div>
                        <div>
                            <p className="text-lg font-medium text-gray-900">{user.username}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.oauth_provider && (
                                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                    通过 {user.oauth_provider} 登录
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* API Configuration Section */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">API 配置</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        配置你自己的 API Key，优先级高于系统默认配置。留空则使用系统默认值。
                    </p>

                    <div className="space-y-6">
                        {/* Google API Key */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">
                                    Google API Key
                                </label>
                                {settings?.has_google_api_key && (
                                    <button
                                        onClick={() => handleResetSetting('google_api_key')}
                                        className="text-xs text-red-600 hover:text-red-700"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                            <input
                                type="password"
                                value={googleApiKey}
                                onChange={(e) => setGoogleApiKey(e.target.value)}
                                placeholder={settings?.has_google_api_key ? '••••••••（已配置）' : '输入你的 Google API Key'}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                当前来源: {effectiveConfig?.google_api_key.source === 'user' ? '用户配置' : '系统默认'}
                            </p>
                        </div>

                        {/* Google API Base */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">
                                    Google API Base URL
                                </label>
                                {settings?.google_api_base && (
                                    <button
                                        onClick={() => handleResetSetting('google_api_base')}
                                        className="text-xs text-red-600 hover:text-red-700"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                value={googleApiBase}
                                onChange={(e) => setGoogleApiBase(e.target.value)}
                                placeholder={effectiveConfig?.google_api_base.value || 'https://generativelanguage.googleapis.com'}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                        </div>

                        {/* MinerU Token */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">
                                    MinerU Token
                                </label>
                                {settings?.has_mineru_token && (
                                    <button
                                        onClick={() => handleResetSetting('mineru_token')}
                                        className="text-xs text-red-600 hover:text-red-700"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                            <input
                                type="password"
                                value={mineruToken}
                                onChange={(e) => setMineruToken(e.target.value)}
                                placeholder={settings?.has_mineru_token ? '••••••••（已配置）' : '输入你的 MinerU Token'}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                        </div>

                        {/* Image Caption Model */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                图片描述模型
                            </label>
                            <input
                                type="text"
                                value={imageCaptionModel}
                                onChange={(e) => setImageCaptionModel(e.target.value)}
                                placeholder={effectiveConfig?.image_caption_model.value || 'gemini-2.5-flash'}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                        </div>
                    </div>
                </section>

                {/* Performance Configuration */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">性能配置</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        调整并发处理参数。较高的值可能加快速度，但也会增加 API 消耗。
                    </p>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                描述生成并发数
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={maxDescriptionWorkers}
                                onChange={(e) => setMaxDescriptionWorkers(e.target.value ? parseInt(e.target.value) : '')}
                                placeholder={String(effectiveConfig?.max_description_workers.value || 5)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                图片生成并发数
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={maxImageWorkers}
                                onChange={(e) => setMaxImageWorkers(e.target.value ? parseInt(e.target.value) : '')}
                                placeholder={String(effectiveConfig?.max_image_workers.value || 8)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            />
                        </div>
                    </div>
                </section>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-semibold rounded-lg hover:from-yellow-500 hover:to-amber-600 focus:ring-4 focus:ring-yellow-200 transition-all disabled:opacity-50 shadow-lg shadow-yellow-200"
                    >
                        {isSaving ? '保存中...' : '保存设置'}
                    </button>
                </div>
            </main>
        </div>
    );
};

export default Settings;
