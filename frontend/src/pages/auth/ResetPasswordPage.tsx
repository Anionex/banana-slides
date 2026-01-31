/**
 * Reset Password Page
 * 重置密码页面
 */
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 8) {
      setError('密码长度不能少于8位');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || '重置失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">无效的链接</h2>
          <p className="text-purple-200/70 mb-6">重置密码链接无效或已过期</p>
          <Link
            to="/forgot-password"
            className="inline-block py-2 px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition"
          >
            重新发送
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold text-white">
            <span className="text-4xl">🍌</span>
            <span>Banana Slides</span>
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">密码已重置</h2>
              <p className="text-purple-200/70 mb-6">
                您的密码已成功重置，正在跳转到登录页面...
              </p>
              <Link
                to="/login"
                className="inline-block py-2 px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition"
              >
                立即登录
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">重置密码</h2>
              <p className="text-purple-200/70 text-center mb-6">请输入您的新密码</p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-1.5">
                    新密码
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="至少8位字符"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-1.5">
                    确认新密码
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="再次输入新密码"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? '重置中...' : '重置密码'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
