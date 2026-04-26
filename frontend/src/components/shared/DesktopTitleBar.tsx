import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, ImagePlus, FolderOpen, Globe, Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/hooks/useT';
import { isDesktop } from '@/utils';

const titleBarI18n = {
  zh: {
    materialGenerate: '素材生成',
    materialCenter: '素材中心',
    history: '历史',
    settings: '设置',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
  },
  en: {
    materialGenerate: 'Generate',
    materialCenter: 'Materials',
    history: 'History',
    settings: 'Settings',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
  },
};

export function DesktopTitleBar() {
  const [platform, setPlatform] = useState<string>('');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(titleBarI18n);
  const { theme, isDark, setTheme } = useTheme();

  useEffect(() => {
    if (isDesktop) {
      setPlatform((window as any).electronAPI.getPlatform());
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isDesktop) return null;

  const isMac = platform === 'darwin';

  const handleMinimize = () => (window as any).electronAPI.minimizeWindow();
  const handleMaximize = () => (window as any).electronAPI.maximizeWindow();
  const handleClose = () => (window as any).electronAPI.closeWindow();

  const winBtnBase: React.CSSProperties = {
    width: 46,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    color: '#6b7280',
    padding: 0,
  };

  const navBtnClass = 'flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-all cursor-pointer';

  return (
    <div
      id="desktop-titlebar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        WebkitAppRegion: 'drag' as any,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      {isMac && <div style={{ width: 78, flexShrink: 0 }} />}

      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          paddingLeft: isMac ? 0 : 12,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>🍌</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.3px' }}>
          Banana Slides
        </span>
      </div>

      {/* Draggable spacer */}
      <div style={{ flex: 1 }} />

      {/* Nav buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          paddingRight: 4,
          height: '100%',
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <button className={navBtnClass} onClick={() => navigate('/?action=material-generate')}>
          <ImagePlus size={14} />
          <span>{t('materialGenerate')}</span>
        </button>
        <button className={navBtnClass} onClick={() => navigate('/?action=material-center')}>
          <FolderOpen size={14} />
          <span>{t('materialCenter')}</span>
        </button>
        <button className={navBtnClass} onClick={() => navigate('/history')}>
          <span>{t('history')}</span>
        </button>
        <button className={navBtnClass} onClick={() => navigate('/settings')}>
          <Settings size={14} />
          <span>{t('settings')}</span>
        </button>

        <div style={{ width: 1, height: 16, backgroundColor: '#d1d5db', margin: '0 4px' }} />

        {/* Language toggle */}
        <button
          className={navBtnClass}
          onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
        >
          <Globe size={12} />
          <span>{i18n.language?.startsWith('zh') ? 'EN' : '中'}</span>
        </button>

        {/* Theme switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            className={navBtnClass}
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
          >
            {theme === 'system' ? <Monitor size={14} /> : isDark ? <Moon size={14} /> : <Sun size={14} />}
            <ChevronDown size={10} className={`transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isThemeMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px]"
              style={{ zIndex: 10001 }}
            >
              {([['light', Sun, t('themeLight')], ['dark', Moon, t('themeDark')], ['system', Monitor, t('themeSystem')]] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  onClick={() => { setTheme(value as any); setIsThemeMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 ${theme === value ? 'text-orange-500' : 'text-gray-700'}`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Window controls — Windows only */}
      {!isMac && (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' as any }}>
          <button
            onClick={handleMinimize}
            onMouseEnter={() => setHoveredBtn('min')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{ ...winBtnBase, backgroundColor: hoveredBtn === 'min' ? 'rgba(0,0,0,0.06)' : 'transparent' }}
            title="最小化"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            onMouseEnter={() => setHoveredBtn('max')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{ ...winBtnBase, backgroundColor: hoveredBtn === 'max' ? 'rgba(0,0,0,0.06)' : 'transparent' }}
            title="最大化"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            onMouseEnter={() => setHoveredBtn('close')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{ ...winBtnBase, backgroundColor: hoveredBtn === 'close' ? '#e81123' : 'transparent', color: hoveredBtn === 'close' ? '#fff' : '#6b7280' }}
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}

      {isMac && <div style={{ width: 12, flexShrink: 0 }} />}
    </div>
  );
}
