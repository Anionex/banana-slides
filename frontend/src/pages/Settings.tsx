import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, Link, Save, RotateCcw } from 'lucide-react';
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

            {/* 图像生成配置（TODO） */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Link size={20} className="mr-2" />
                图像生成配置
              </h2>
              <div className="bg-banana-50 border border-banana-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  🚧 图像清晰度和比例设置即将推出...
                </p>
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
