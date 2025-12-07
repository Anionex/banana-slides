import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, Image, Zap, Save, RotateCcw } from 'lucide-react';
import { Button, Input, Card, Loading, useToast } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    api_base_url: '',
    api_key: '',
    image_resolution: '2K',
    image_aspect_ratio: '16:9',
    max_description_workers: 5,
    max_image_workers: 8,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData({
          api_base_url: response.data.api_base_url || '',
          api_key: '', // 不显示实际的 API key, 留空则在更新的时候不设置新的 apikey.
          image_resolution: response.data.image_resolution || '2K',
          image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
          max_description_workers: response.data.max_description_workers || 5,
          max_image_workers: response.data.max_image_workers || 8,
        });
      }
    } catch (error: any) {
      console.error('加载设置失败:', error);
      show({
        message: '加载设置失败: ' + (error?.message || '未知错误'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 只发送有值的字段
      const updateData: any = {};
      if (formData.api_base_url) {
        updateData.api_base_url = formData.api_base_url;
      }
      if (formData.api_key) {
        updateData.api_key = formData.api_key;
      }
      if (formData.image_resolution) {
        updateData.image_resolution = formData.image_resolution;
      }
      if (formData.image_aspect_ratio) {
        updateData.image_aspect_ratio = formData.image_aspect_ratio;
      }
      if (formData.max_description_workers) {
        updateData.max_description_workers = formData.max_description_workers;
      }
      if (formData.max_image_workers) {
        updateData.max_image_workers = formData.max_image_workers;
      }

      const response = await api.updateSettings(updateData);
      if (response.data) {
        setSettings(response.data);
        show({ message: '设置保存成功', type: 'success' });
        // 清空 API key 输入框
        setFormData(prev => ({ ...prev, api_key: '' }));
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      show({
        message: '保存设置失败: ' + (error?.response?.data?.error?.message || error?.message || '未知错误'),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有设置到默认值吗？')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.resetSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData({
          api_base_url: response.data.api_base_url || '',
          api_key: '',
          image_resolution: response.data.image_resolution || '2K',
          image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
          max_description_workers: response.data.max_description_workers || 5,
          max_image_workers: response.data.max_image_workers || 8,
        });
        show({ message: '设置已重置', type: 'success' });
      }
    } catch (error: any) {
      console.error('重置设置失败:', error);
      show({
        message: '重置设置失败: ' + (error?.message || '未知错误'),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-banana-50 via-white to-banana-100 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 via-white to-banana-100">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                icon={<Home size={18} />}
                onClick={() => navigate('/')}
              >
                返回主页
              </Button>
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-8">
          <div className="space-y-8">
            {/* API 配置 */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Key size={20} className="mr-2" />
                大模型 API 配置
              </h2>
              <div className="space-y-4">
                <div>
                  <Input
                    label="API Base URL"
                    placeholder="https://api.example.com"
                    value={formData.api_base_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_base_url: e.target.value }))}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    设置大模型提供商 API 的基础 URL
                  </p>
                </div>
                <div>
                  <Input
                    label="API Key"
                    type="password"
                    placeholder={settings?.api_key_length ? `已设置（长度: ${settings.api_key_length}）` : '输入新的 API Key'}
                    value={formData.api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {settings?.api_key_length
                      ? '留空则保持当前设置不变，输入新值则更新'
                      : '输入你的 API Key'}
                  </p>
                </div>
              </div>
            </div>

            {/* 图像生成配置 */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Image size={20} className="mr-2" />
                图像生成配置
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    图像清晰度
                  </label>
                  <select
                    value={formData.image_resolution}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_resolution: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
                  >
                    <option value="1K">1K (1024px)</option>
                    <option value="2K">2K (2048px)</option>
                    <option value="4K">4K (4096px)</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    更高的清晰度会生成更详细的图像，但需要更长时间
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    图像比例
                  </label>
                  <select
                    value={formData.image_aspect_ratio}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_aspect_ratio: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
                  >
                    <option value="1:1">1:1 (正方形)</option>
                    <option value="2:3">2:3 (竖向)</option>
                    <option value="3:2">3:2 (横向)</option>
                    <option value="3:4">3:4 (竖向)</option>
                    <option value="4:3">4:3 (标准)</option>
                    <option value="4:5">4:5 (竖向)</option>
                    <option value="5:4">5:4 (横向)</option>
                    <option value="9:16">9:16 (竖向)</option>
                    <option value="16:9">16:9 (宽屏)</option>
                    <option value="21:9">21:9 (超宽屏)</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    选择适合你 PPT 的图像比例
                  </p>
                </div>
              </div>
            </div>

            {/* 性能配置 */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Zap size={20} className="mr-2" />
                性能配置
              </h2>
              <div className="space-y-4">
                <div>
                  <Input
                    label="描述生成最大并发数"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.max_description_workers}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_description_workers: parseInt(e.target.value) || 5 }))}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    同时生成描述的最大工作线程数 (1-20)，越大速度越快
                  </p>
                </div>
                <div>
                  <Input
                    label="图像生成最大并发数"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.max_image_workers}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_image_workers: parseInt(e.target.value) || 8 }))}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    同时生成图像的最大工作线程数 (1-20)，越大速度越快
                  </p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                icon={<RotateCcw size={18} />}
                onClick={handleReset}
                disabled={isSaving}
              >
                重置为默认值
              </Button>
              <Button
                variant="primary"
                icon={<Save size={18} />}
                onClick={handleSave}
                loading={isSaving}
              >
                保存设置
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ToastContainer />
    </div>
  );
};
