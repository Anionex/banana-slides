import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Preference = 'system' | 'light' | 'dark';
const key = 'banana-landing-theme';
const ThemeContext = createContext({ dark: false, preference: 'system' as Preference, setPreference: (_value: Preference) => {} });
export const useLandingTheme = () => useContext(ThemeContext);
export function LandingTheme({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(() => {
    if (typeof window === 'undefined') return 'system';
    try { const value = localStorage.getItem(key); return value === 'dark' || value === 'light' ? value : 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.landingTheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#181818' : '#ffffff');
    try { localStorage.setItem(key, preference); } catch { /* Session-only preference when storage is unavailable. */ }
  }, [dark, preference]);
  useEffect(() => () => { delete document.documentElement.dataset.landingTheme; }, []);
  return <ThemeContext.Provider value={{ dark, preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { dark, setPreference } = useLandingTheme();
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith('zh');
  const title = dark ? (zh ? '切换为浅色' : 'Switch to light mode') : (zh ? '切换为暗色' : 'Switch to dark mode');
  return <button type="button" className="landing-language-trigger landing-theme-trigger"
    aria-label={zh ? '暗色主题' : 'Dark theme'} aria-pressed={dark} title={title}
    onClick={() => setPreference(dark ? 'light' : 'dark')}>
    <span className="landing-theme-icons" aria-hidden="true">
      <Sun size={19} className="landing-theme-sun" />
      <Moon size={19} className="landing-theme-moon" />
    </span>
  </button>;
}
