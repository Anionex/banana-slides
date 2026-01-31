/**
 * Register Page
 * 注册页面
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../../api/auth';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
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
      const { message } = await registerUser(email, password, username || undefined);
      // Show success message and redirect
      navigate('/', { state: { message } });
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || '注册失败，请重试';
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
          <p className="mt-2 text-purple-200/70">AI 驱动的 PPT 生成器</p>
        </div>

        {/* Register Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">创建账号</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-1.5">
                邮箱 <span className="text-red-400">*</span>
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

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-purple-200 mb-1.5">
                用户名 <span className="text-purple-200/50">(可选)</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="您的昵称"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-1.5">
                密码 <span className="text-red-400">*</span>
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
                确认密码 <span className="text-red-400">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="再次输入密码"
              />
            </div>

            <div className="flex items-start text-sm pt-2">
              <input
                type="checkbox"
                required
                className="mt-0.5 mr-2 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-purple-200/70">
                我已阅读并同意{' '}
                <a href="/terms" className="text-purple-300 hover:text-purple-200">
                  服务条款
                </a>{' '}
                和{' '}
                <a href="/privacy" className="text-purple-300 hover:text-purple-200">
                  隐私政策
                </a>
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  注册中...
                </span>
              ) : (
                '创建账号'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-purple-200/70">
            已有账号？{' '}
            <Link to="/login" className="text-purple-300 hover:text-purple-200 font-medium transition">
              立即登录
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-purple-200/50 text-sm">
          © 2026 Banana Slides. All rights reserved.
        </p>
      </div>
    </div>
  );
}
