import { isDesktop } from '@/utils';

// Opt in only for the official web build; Electron retains its existing entry.
export const publicLandingEnabled = import.meta.env.VITE_PUBLIC_LANDING === 'true' && !isDesktop;

export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || /^\/en\/?$/.test(pathname) || /^\/landing\/?$/.test(pathname);
}

export function isGalleryPath(pathname: string): boolean {
  return /^\/(en\/)?gallery\/?$/.test(pathname);
}

export function isGalleryDetailPath(pathname: string): boolean {
  return /^\/(?:en\/)?gallery\/[a-z0-9-]+\/?$/.test(pathname);
}
