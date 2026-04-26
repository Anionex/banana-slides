import { useEffect, useState } from 'react';

const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

export function DesktopTitleBar() {
  const [platform, setPlatform] = useState<string>('');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    if (isDesktop) {
      setPlatform((window as any).electronAPI.getPlatform());
    }
  }, []);

  if (!isDesktop) return null;

  const isMac = platform === 'darwin';

  const handleMinimize = () => (window as any).electronAPI.minimizeWindow();
  const handleMaximize = () => (window as any).electronAPI.maximizeWindow();
  const handleClose = () => (window as any).electronAPI.closeWindow();

  const btnBase: React.CSSProperties = {
    WebkitAppRegion: 'no-drag' as any,
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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        WebkitAppRegion: 'drag' as any,
        backdropFilter: 'blur(16px) saturate(1.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* macOS: traffic light space */}
      {isMac && <div style={{ width: 78, flexShrink: 0 }} />}

      {/* Logo + app name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          paddingLeft: isMac ? 0 : 12,
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>🍌</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            letterSpacing: '0.3px',
          }}
        >
          Banana Slides
        </span>
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Window controls — Windows only */}
      {!isMac && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            WebkitAppRegion: 'no-drag' as any,
          }}
        >
          <button
            onClick={handleMinimize}
            onMouseEnter={() => setHoveredBtn('min')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              ...btnBase,
              backgroundColor: hoveredBtn === 'min' ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
            }}
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
            style={{
              ...btnBase,
              backgroundColor: hoveredBtn === 'max' ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
            }}
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
            style={{
              ...btnBase,
              backgroundColor: hoveredBtn === 'close' ? '#e81123' : 'transparent',
              color: hoveredBtn === 'close' ? '#ffffff' : '#6b7280',
            }}
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}

      {/* macOS right padding */}
      {isMac && <div style={{ width: 12, flexShrink: 0 }} />}
    </div>
  );
}
