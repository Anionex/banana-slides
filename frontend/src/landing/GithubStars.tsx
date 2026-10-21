import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

import snapshot from './githubStats.snapshot.json';

export function GithubStars() {
  // The server-rendered page and first client render share a verified snapshot.
  const [stars, setStars] = useState(snapshot.stars);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/stats/github.json', { signal: controller.signal, cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Website stats unavailable');
        return response.json();
      })
      .then(data => {
        if (data.repository === snapshot.repository && Number.isInteger(data.stars) && data.stars >= 0
          && Date.parse(data.updated_at) >= Date.parse(snapshot.updated_at)) {
          setStars(data.stars);
        }
      })
      .catch(() => { /* The bundled successful snapshot remains visible, including on first visits. */ });
    return () => controller.abort();
  }, []);

  const count = stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(stars);
  return <span className="landing-github-stars" title={`${stars.toLocaleString('en-US')} GitHub stars`} aria-label={`${stars.toLocaleString('en-US')} stars`}>
    <span>{count}</span><Star size={13} fill="currentColor" aria-hidden="true" />
  </span>;
}
