/**
 * Forgot Password Page
 * 忘记密码页面
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || '发送失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
              <h2 className="text-2xl font-semibold text-white mb-2">邮件已发送</h2>
              <p className="text-purple-200/70 mb-6">
                如果该邮箱已注册，您将收到重置密码的邮件。请检查您的收件箱。
              </p>
              <Link
                to="/login"
                className="inline-block py-2 px-6 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
              >
                返回登录
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">忘记密码</h2>
              <p className="text-purple-200/70 text-center mb-6">
                输入您的邮箱，我们将发送重置密码的链接
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-1.5">
                    邮箱
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="your@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? '发送中...' : '发送重置链接'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-purple-300 hover:text-purple-200 text-sm transition">
                  ← 返回登录
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
