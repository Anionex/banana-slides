import { useMemo } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useUserStore } from '@/store/useUserStore';

function buildProtectedImageUrl(
  path?: string,
  timestamp?: string | number,
  accessToken?: string | null
): string {
  if (!path) return '';

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const absoluteUrl = new URL(path);

      if (timestamp && !absoluteUrl.searchParams.get('v')) {
        const ts = typeof timestamp === 'string'
          ? new Date(timestamp).getTime()
          : timestamp;
        absoluteUrl.searchParams.set('v', String(ts));
      }

      if (absoluteUrl.pathname.startsWith('/files/') && accessToken) {
        absoluteUrl.searchParams.set('access_token', accessToken);
      }

      return absoluteUrl.toString();
    } catch {
      return path;
    }
  }

  let url = path.startsWith('/') ? path : `/${path}`;

  if (timestamp) {
    const ts = typeof timestamp === 'string'
      ? new Date(timestamp).getTime()
      : timestamp;
    url += `?v=${ts}`;
  }

  if (url.startsWith('/files/') && accessToken) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}access_token=${encodeURIComponent(accessToken)}`;
  }

  return url;
}

export function useProtectedImageUrl(path?: string, timestamp?: string | number): string {
  const userAccessToken = useUserStore((state) => state.accessToken);
  const adminAccessToken = useAdminStore((state) => state.accessToken);

  return useMemo(
    () => buildProtectedImageUrl(path, timestamp, userAccessToken || adminAccessToken),
    [adminAccessToken, path, timestamp, userAccessToken]
  );
}
