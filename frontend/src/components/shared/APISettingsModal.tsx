import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { getApiConfig, updateApiConfig, getApiPresets } from '@/api/endpoints';
import type { APIConfig, APIPreset } from '@/types';
import { AlertCircle, Check, Settings } from 'lucide-react';

interface APISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APISettingsModal: React.FC<APISettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<APIConfig>({
    text_api_key: '',
    text_api_base: '',
    text_model: '',
    image_api_key: '',
    image_api_base: '',
    image_model: '',
    resolution: '2K',
  });
  const [presets, setPresets] = useState<APIPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState({
    text: false,
    image: false,
  });

  // Load current config and presets
  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadPresets();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getApiConfig();
      setConfig(data);
      setError('');
    } catch (err: any) {
      setError('加载配置失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await getApiPresets();
      setPresets(data);
    } catch (err: any) {
      console.error('Failed to load presets:', err);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setConfig((prev) => ({
        ...prev,
        text_api_base: preset.config.text_api_base,
        image_api_base: preset.config.image_api_base,
        text_model: preset.config.text_model || prev.text_model,
        image_model: preset.config.image_model || prev.image_model,
        // 如果预设包含密钥，自动填充
        text_api_key: preset.config.text_api_key || prev.text_api_key,
        image_api_key: preset.config.image_api_key || prev.image_api_key,
        // 保留当前分辨率设置
        resolution: prev.resolution,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess(false);

      // Validate
      if (!config.text_api_key.trim() || !config.text_api_base.trim()) {
        setError('文本API配置不能为空');
        return;
      }
      if (!config.image_api_key.trim() || !config.image_api_base.trim()) {
        setError('图片API配置不能为空');
        return;
      }

      await updateApiConfig(config);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 8) + '•'.repeat(Math.min(key.length - 8, 32));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="API 配置" size="lg">
      <div className="space-y-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">配置已保存成功！</p>
          </div>
        )}

        {/* Preset Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            快速配置预设
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            <option value="">-- 选择预设 --</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {selectedPresetId && presets.find((p) => p.id === selectedPresetId)?.description && (
            <p className="mt-2 text-sm text-gray-600">
              {presets.find((p) => p.id === selectedPresetId)?.description}
            </p>
          )}
          {selectedPresetId && presets.find((p) => p.id === selectedPresetId)?.config.warning && (
            <p className="mt-2 text-sm text-amber-600">
              ⚠️ {presets.find((p) => p.id === selectedPresetId)?.config.warning}
            </p>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Text API Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            文本生成 API（大纲、描述）
          </h3>

          <Input
            label="API Key"
            type={showKeys.text ? 'text' : 'password'}
            value={config.text_api_key}
            onChange={(e) => setConfig({ ...config, text_api_key: e.target.value })}
            placeholder="输入文本API密钥"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowKeys({ ...showKeys, text: !showKeys.text })}
            className="text-sm text-banana-600 hover:text-banana-700"
          >
            {showKeys.text ? '隐藏' : '显示'} API Key
          </button>

          <Input
            label="API Base URL"
            type="text"
            value={config.text_api_base}
            onChange={(e) => setConfig({ ...config, text_api_base: e.target.value })}
            placeholder="https://generativelanguage.googleapis.com"
            disabled={loading}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              文本生成模型
            </label>
            <select
              value={config.text_model}
              onChange={(e) => setConfig({ ...config, text_model: e.target.value })}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">默认模型</option>
              <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              选择文本生成模型，留空使用系统默认模型
            </p>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Image API Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            图片生成 API
          </h3>

          <Input
            label="API Key"
            type={showKeys.image ? 'text' : 'password'}
            value={config.image_api_key}
            onChange={(e) => setConfig({ ...config, image_api_key: e.target.value })}
            placeholder="输入图片API密钥"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowKeys({ ...showKeys, image: !showKeys.image })}
            className="text-sm text-banana-600 hover:text-banana-700"
          >
            {showKeys.image ? '隐藏' : '显示'} API Key
          </button>

          <Input
            label="API Base URL"
            type="text"
            value={config.image_api_base}
            onChange={(e) => setConfig({ ...config, image_api_base: e.target.value })}
            placeholder="https://apipro.maynor1024.live"
            disabled={loading}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图片生成模型
            </label>
            <select
              value={config.image_model}
              onChange={(e) => setConfig({ ...config, image_model: e.target.value })}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">默认模型</option>
              <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
              <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              选择图片生成模型，留空使用系统默认模型
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>格式自动检测：</strong>系统会根据 API Base URL 自动选择合适的格式
              <br />
              • 官方 Google API (googleapis.com)：使用原生 Gemini SDK 格式
              <br />
              • 第三方代理：自动使用 OpenAI 兼容格式 (/v1/chat/completions)
            </p>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* 图片分辨率配置 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            图片分辨率
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成图片分辨率
            </label>
            <select
              value={config.resolution || '2K'}
              onChange={(e) => setConfig({ ...config, resolution: e.target.value })}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="1K">1K (1024x576)</option>
              <option value="2K">2K (2048x1152) - 推荐</option>
              <option value="4K">4K (4096x2304)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              选择图片生成分辨率。分辨率越高，生成时间越长，消耗的 Token 也越多
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={loading}>
            保存配置
          </Button>
        </div>
      </div>
    </Modal>
  );
};
