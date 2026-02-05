/**
 * Change Password Page
 * 修改密码页面
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { authApi } from '../../api/auth';
import { Button, Input, Card, useToast } from '../../components/shared';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!currentPassword) {
      setError(t('auth.changePassword.currentPasswordRequired', '请输入当前密码'));
      return;
    }

    if (!newPassword) {
      setError(t('auth.changePassword.newPasswordRequired', '请输入新密码'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth.changePassword.passwordTooShort', '新密码长度至少为8位'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.changePassword.passwordMismatch', '两次输入的密码不一致'));
      return;
    }

    if (currentPassword === newPassword) {
      setError(t('auth.changePassword.sameAsOld', '新密码不能与当前密码相同'));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      show({
        message: t('auth.changePassword.success', '密码修改成功'),
        type: 'success',
      });
      // Redirect after success
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error?.message ||
                          err?.message ||
                          t('auth.changePassword.failed', '密码修改失败');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('auth.changePassword.success', '密码修改成功')}
          </h2>
          <p className="text-gray-500 dark:text-foreground-tertiary mb-4">
            {t('auth.changePassword.successDesc', '您的密码已成功修改，即将返回...')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary flex items-center justify-center p-4">
      <ToastContainer />
      <Card className="w-full max-w-md p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">{t('common.back', '返回')}</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-banana-100 dark:bg-banana-900/30 rounded-full flex items-center justify-center">
              <Lock size={20} className="text-banana-600 dark:text-banana-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('auth.changePassword.title', '修改密码')}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-foreground-tertiary">
            {t('auth.changePassword.subtitle', '请输入当前密码和新密码')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Current Password */}
          <div className="relative">
            <Input
              label={t('auth.changePassword.currentPassword', '当前密码')}
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('auth.changePassword.enterCurrentPassword', '请输入当前密码')}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* New Password */}
          <div className="relative">
            <Input
              label={t('auth.changePassword.newPassword', '新密码')}
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.changePassword.enterNewPassword', '请输入新密码（至少8位）')}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <Input
              label={t('auth.changePassword.confirmPassword', '确认新密码')}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.changePassword.enterConfirmPassword', '请再次输入新密码')}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Requirements */}
          <div className="text-xs text-gray-500 dark:text-foreground-tertiary space-y-1">
            <p>{t('auth.changePassword.requirements', '密码要求：')}</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>{t('auth.changePassword.reqLength', '至少8个字符')}</li>
              <li>{t('auth.changePassword.reqDifferent', '不能与当前密码相同')}</li>
            </ul>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            className="w-full"
          >
            {isLoading
              ? t('auth.changePassword.changing', '修改中...')
              : t('auth.changePassword.confirm', '确认修改')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
