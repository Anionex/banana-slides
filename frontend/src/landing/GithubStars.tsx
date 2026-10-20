import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

// Share the cache used by the existing GitHub badge.
const CACHE_KEY = 'github-stats-cache-v2';
const CACHE_DURATION = 60 * 60 * 1000;

export function GithubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Number.isInteger(cached.data?.stars) && cached.data.stars >= 0) {
        setStars(cached.data.stars);
        if (Date.now() - cached.timestamp < CACHE_DURATION) return;
      }
    } catch { /* A blocked or invalid cache should not prevent fetching. */ }

    const controller = new AbortController();
    void fetch('https://api.github.com/repos/Anionex/banana-slides', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('GitHub stats unavailable');
        return response.json();
      })
      .then(data => {
        if (!Number.isInteger(data.stargazers_count) || data.stargazers_count < 0) return;
        setStars(data.stargazers_count);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: { stars: data.stargazers_count, forks: data.forks_count }, timestamp: Date.now(),
          }));
        } catch { /* Stats still display when storage is unavailable. */ }
      })
      .catch(() => { /* Keep the last successful count when refreshing fails. */ });
    return () => controller.abort();
  }, []);

  if (stars === null) return null;
  const count = stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(stars);
  return <span className="landing-github-stars" title={`${stars.toLocaleString('en-US')} GitHub stars`} aria-label={`${stars.toLocaleString('en-US')} stars`}>
    <span>{count}</span><Star size={13} fill="currentColor" aria-hidden="true" />
  </span>;
}
