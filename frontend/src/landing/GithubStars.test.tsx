import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubStars } from './GithubStars';

const cacheKey = 'github-stats-cache-v2';
const hour = 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

function cache(stars: number, age: number) {
  const entry = { data: { stars, forks: 100 }, timestamp: Date.now() - age };
  localStorage.setItem(cacheKey, JSON.stringify(entry));
  return entry;
}

describe('homepage GitHub stars', () => {
  it.each(['network', 'http', 'invalid'] as const)(
    'keeps an expired successful count when refreshing fails: %s',
    async failure => {
      const previous = cache(15773, 2 * hour);
      const request = vi.mocked(fetch);
      if (failure === 'network') request.mockRejectedValue(new TypeError('Offline'));
      else request.mockResolvedValue({
        ok: failure !== 'http',
        json: async () => ({ stargazers_count: null }),
      } as Response);

      await act(async () => { render(<GithubStars />); });

      expect(screen.getByLabelText('15,773 stars')).toHaveTextContent('15.8k');
      expect(request).toHaveBeenCalledTimes(1);
      expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual(previous);
    },
  );

  it('displays stale data while refreshing, then replaces and caches the new count', async () => {
    cache(15773, 2 * hour);
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<GithubStars />);
    expect(screen.getByLabelText('15,773 stars')).toHaveTextContent('15.8k');

    await act(async () => {
      complete({ ok: true, json: async () => ({ stargazers_count: 16000, forks_count: 120 }) } as Response);
    });

    expect(screen.getByLabelText('16,000 stars')).toHaveTextContent('16k');
    expect(JSON.parse(localStorage.getItem(cacheKey)!).data).toEqual({ stars: 16000, forks: 120 });
  });

  it('uses a fresh cached result without requesting GitHub', () => {
    cache(0, 1000);
    render(<GithubStars />);
    expect(screen.getByLabelText('0 stars')).toHaveTextContent('0');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not invent a count when no successful result exists', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Offline'));
    const view = render(<GithubStars />);
    await act(async () => {});
    expect(view.container).toBeEmptyDOMElement();
  });
});
