import { isDesktop } from '@/utils';

// Opt in only for the official web build; Electron retains its existing entry.
export const publicLandingEnabled = import.meta.env.VITE_PUBLIC_LANDING === 'true' && !isDesktop;

export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || /^\/landing\/?$/.test(pathname);
}
