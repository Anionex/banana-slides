import React, { useState, useEffect } from 'react';
import { Star, GitFork } from 'lucide-react';

const GITHUB_REPO = 'Anionex/banana-slides';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

interface RepoStats {
  stars: number;
  forks: number;
}

export const GithubRepoCard: React.FC = () => {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 先尝试从 localStorage 读取缓存
        const cached = localStorage.getItem('github_repo_stats');
        const cacheTime = localStorage.getItem('github_repo_stats_time');
        const now = Date.now();

        // 缓存有效期 10 分钟
        if (cached && cacheTime && now - parseInt(cacheTime) < 10 * 60 * 1000) {
          setStats(JSON.parse(cached));
          setLoading(false);
          return;
        }

        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
        if (response.ok) {
          const data = await response.json();
          const newStats = {
            stars: data.stargazers_count,
            forks: data.forks_count,
          };
          setStats(newStats);
          // 缓存结果
          localStorage.setItem('github_repo_stats', JSON.stringify(newStats));
          localStorage.setItem('github_repo_stats_time', now.toString());
        }
      } catch (error) {
        console.error('Failed to fetch GitHub stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };

  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-background-tertiary hover:bg-gray-100 dark:hover:bg-background-hover border border-gray-200 dark:border-border-primary rounded-lg transition-all duration-200 hover:shadow-sm hover:border-gray-300 dark:hover:border-border-hover group"
      title="View on GitHub"
    >
      {/* GitHub 图标 */}
      <svg
        className="w-4 h-4 text-gray-700 dark:text-foreground-secondary group-hover:text-gray-900 dark:group-hover:text-white transition-colors"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>

      {/* 分隔线 */}
      <div className="w-px h-4 bg-gray-300 dark:bg-border-primary" />

      {/* Star 数量 */}
      <div className="flex items-center gap-1 text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-800 dark:group-hover:text-foreground-secondary transition-colors">
        <Star size={14} className="text-yellow-500" fill="currentColor" />
        <span className="text-xs font-medium">
          {loading ? '...' : stats ? formatNumber(stats.stars) : '-'}
        </span>
      </div>

      {/* Fork 数量 */}
      <div className="flex items-center gap-1 text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-800 dark:group-hover:text-foreground-secondary transition-colors">
        <GitFork size={14} />
        <span className="text-xs font-medium">
          {loading ? '...' : stats ? formatNumber(stats.forks) : '-'}
        </span>
      </div>
    </a>
  );
};
