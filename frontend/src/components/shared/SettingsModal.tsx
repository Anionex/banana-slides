/**
 * 设置弹窗组件
 * 用户配置 API Key 和偏好设置
 */

import React, { useState } from 'react';
import { X, Save, RotateCcw, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const settings = useSettingsStore();
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showMinerUToken, setShowMinerUToken] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'preferences'>('api');

  const [formData, setFormData] = useState({
    geminiApiKey: settings.geminiApiKey,
    geminiApiBase: settings.geminiApiBase,
    geminiTextModel: settings.geminiTextModel,
    geminiImageModel: settings.geminiImageModel,
    mineruToken: settings.mineruToken,
    mineruApiBase: settings.mineruApiBase,
    useBackendProxy: settings.useBackendProxy,
    backendApiUrl: settings.backendApiUrl,
    language: settings.language,
    theme: settings.theme
  });

  const handleSave = () => {
    settings.updateSettings(formData);
    onClose();
  };

  const handleReset = () => {
    if (confirm('确定要重置所有设置吗？')) {
      settings.resetSettings();
      setFormData({
        geminiApiKey: '',
        geminiApiBase: 'https://generativelanguage.googleapis.com',
        geminiTextModel: 'gemini-2.0-flash-exp',
        geminiImageModel: 'gemini-2.0-flash-exp',
        mineruToken: '',
        mineruApiBase: 'https://mineru.net/api/v4',
        useBackendProxy: false,
        backendApiUrl: 'http://localhost:5000',
        language: 'zh-CN',
        theme: 'system'
      });
    }
  };

  const applyPreset = (preset: 'official' | 'proxy' | 'local') => {
    switch (preset) {
      case 'official':
        setFormData({
          ...formData,
          geminiApiBase: 'https://generativelanguage.googleapis.com',
          mineruApiBase: 'https://mineru.net/api/v4',
          useBackendProxy: false
        });
        break;
      case 'proxy':
        setFormData({
          ...formData,
          geminiApiBase: 'https://apipro.maynor1024.live',
          mineruApiBase: 'https://mineru.net/api/v4',
          useBackendProxy: false
        });
        break;
      case 'local':
        setFormData({
          ...formData,
          useBackendProxy: true,
          backendApiUrl: 'http://localhost:5000'
        });
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('api')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'api'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            API 配置
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'preferences'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            偏好设置
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'api' && (
            <div className="space-y-6">
              {/* 预设配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  快速配置
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => applyPreset('proxy')}
                    className="p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <div className="font-semibold text-blue-600 dark:text-blue-400">
                      🚀 中转API（推荐）
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      稳定快速
                    </div>
                  </button>
                  <button
                    onClick={() => applyPreset('official')}
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                      🌐 官方API
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      需要科学上网
                    </div>
                  </button>
                  <button
                    onClick={() => applyPreset('local')}
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                      💻 本地后端
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      使用后端代理
                    </div>
                  </button>
                </div>
              </div>

              {/* Gemini API 配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center">
                  Gemini API 配置
                  {settings.isGeminiConfigured() && (
                    <CheckCircle size={20} className="ml-2 text-green-500" />
                  )}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key *
                    </label>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={formData.geminiApiKey}
                        onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showGeminiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      获取 API Key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={formData.geminiApiBase}
                      onChange={(e) => setFormData({ ...formData, geminiApiBase: e.target.value })}
                      placeholder="https://generativelanguage.googleapis.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        文本模型
                      </label>
                      <input
                        type="text"
                        value={formData.geminiTextModel}
                        onChange={(e) => setFormData({ ...formData, geminiTextModel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        图片模型
                      </label>
                      <input
                        type="text"
                        value={formData.geminiImageModel}
                        onChange={(e) => setFormData({ ...formData, geminiImageModel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* MinerU API 配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center">
                  MinerU API 配置（可选）
                  {settings.isMinerUConfigured() && (
                    <CheckCircle size={20} className="ml-2 text-green-500" />
                  )}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Token
                    </label>
                    <div className="relative">
                      <input
                        type={showMinerUToken ? 'text' : 'password'}
                        value={formData.mineruToken}
                        onChange={(e) => setFormData({ ...formData, mineruToken: e.target.value })}
                        placeholder="your-mineru-token"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMinerUToken(!showMinerUToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showMinerUToken ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      获取 Token: <a href="https://mineru.net" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">MinerU 官网</a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={formData.mineruApiBase}
                      onChange={(e) => setFormData({ ...formData, mineruApiBase: e.target.value })}
                      placeholder="https://mineru.net/api/v4"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 后端代理配置 */}
              {formData.useBackendProxy && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    后端代理配置
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      后端 API 地址
                    </label>
                    <input
                      type="text"
                      value={formData.backendApiUrl}
                      onChange={(e) => setFormData({ ...formData, backendApiUrl: e.target.value })}
                      placeholder="http://localhost:5000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* 配置状态提示 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">配置说明：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Gemini API Key 是必需的，用于 AI 生成功能</li>
                      <li>MinerU Token 是可选的，用于文件解析功能</li>
                      <li>推荐使用中转 API 以获得更好的稳定性</li>
                      <li>所有配置都保存在本地浏览器中</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  语言
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  主题
                </label>
                <select
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value as 'light' | 'dark' | 'system' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                  <option value="system">跟随系统</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <RotateCcw size={18} className="mr-2" />
            重置
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save size={18} className="mr-2" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
