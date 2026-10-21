import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubStars } from './GithubStars';
import snapshot from './githubStats.snapshot.json';

const label = `${snapshot.stars.toLocaleString('en-US')} stars`;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('shared website GitHub stars', () => {
  it('renders the successful site snapshot in HTML without browser storage or network', () => {
    expect(renderToString(<GithubStars />)).toContain(`aria-label="${label}"`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['network', 'http', 'invalid', 'older'] as const)(
    'keeps the site snapshot for first-time visitors on %s refresh', async failure => {
      if (failure === 'network') vi.mocked(fetch).mockRejectedValue(new TypeError('Offline'));
      else vi.mocked(fetch).mockResolvedValue({
        ok: failure !== 'http',
        json: async () => failure === 'older'
          ? { ...snapshot, stars: 1, updated_at: '2000-01-01T00:00:00Z' }
          : { ...snapshot, stars: null },
      } as Response);
      await act(async () => { render(<GithubStars />); });
      expect(screen.getByLabelText(label)).toBeVisible();
      expect(fetch).toHaveBeenCalledWith('/stats/github.json', expect.objectContaining({ cache: 'no-cache' }));
      expect(localStorage.length).toBe(0);
    },
  );

  it('keeps the seed while fetching, then shows the shared server result', async () => {
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<GithubStars />);
    expect(screen.getByLabelText(label)).toBeVisible();
    await act(async () => {
      complete({ ok: true, json: async () => ({ ...snapshot, stars: 16000, updated_at: '2099-01-01T00:00:00Z' }) } as Response);
    });
    expect(screen.getByLabelText('16,000 stars')).toHaveTextContent('16k');
    expect(localStorage.length).toBe(0);
  });
});
