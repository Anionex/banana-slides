/**
 * Change Password Modal Component
 * 修改密码模态框组件
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, X } from 'lucide-react';
import { authApi } from '../../api/auth';
import { Button, Input, useToast } from '../shared';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation();
  const { show, ToastContainer } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
      show({
        message: t('auth.changePassword.success', '密码修改成功'),
        type: 'success',
      });
      handleClose();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error?.message ||
                          err?.message ||
                          t('auth.changePassword.failed', '密码修改失败');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ToastContainer />
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          className="bg-white dark:bg-background-secondary rounded-xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border-primary">
            <div className="flex items-center gap-2">
              <Lock size={20} className="text-banana-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('auth.changePassword.title', '修改密码')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-foreground-tertiary" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="flex-1"
              >
                {t('common.cancel', '取消')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                className="flex-1"
              >
                {isLoading
                  ? t('auth.changePassword.changing', '修改中...')
                  : t('auth.changePassword.confirm', '确认修改')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
