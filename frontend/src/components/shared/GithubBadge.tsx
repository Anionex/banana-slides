import React, { useEffect, useState } from 'react';
import { Github, Star, GitFork } from 'lucide-react';

const GITHUB_REPO = 'Anionex/banana-slides';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

interface GithubStats {
  stars: number;
  forks: number;
}

const CACHE_KEY = 'github-stats-cache-v2';
const CACHE_DURATION = 3600 * 1000; // 1 hour

export const GithubBadge: React.FC = () => {
  const [stats, setStats] = useState<GithubStats>({
    stars: 0,
    forks: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Check cache
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setStats(data);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to read github stats cache', e);
      }

      // Fetch from API
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
        if (!res.ok) throw new Error('Failed to fetch repo info');
        const data = await res.json();

        const newStats = {
          stars: data.stargazers_count,
          forks: data.forks_count,
        };

        setStats(newStats);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: newStats,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error('Error fetching GitHub stats:', error);
      }
    };

    fetchStats();
  }, []);

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  };

  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md"
      title="View on GitHub"
    >
      {/* 左侧：GitHub Logo */}
      <div className="flex items-center justify-center text-gray-700 dark:text-gray-200">
        <Github size={36} />
      </div>

      {/* 右侧：上下结构 (Stars & Forks) */}
      <div className="flex flex-col text-[10px] leading-none gap-1 font-medium text-gray-600 dark:text-gray-400">
        {/* Stars */}
        <div className="flex items-center gap-1">
          <Star size={16} />
          <span>{formatCount(stats.stars)}</span>
        </div>
        
        {/* Forks */}
        <div className="flex items-center gap-1">
          <GitFork size={16} />
          <span>{formatCount(stats.forks)}</span>
        </div>
      </div>
    </a>
  );
};
