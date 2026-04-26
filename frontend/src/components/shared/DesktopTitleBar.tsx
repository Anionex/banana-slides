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
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    color: '#6b7280',
    borderRadius: 6,
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center select-none"
      style={{
        WebkitAppRegion: 'drag' as any,
        backdropFilter: 'blur(16px) saturate(1.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* macOS: traffic light space */}
      {isMac && <div className="w-[78px] flex-shrink-0" />}

      {/* Logo + app name */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0"
        style={{
          WebkitAppRegion: 'no-drag' as any,
          paddingLeft: isMac ? 0 : 16,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>🍌</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#374151',
            letterSpacing: '0.5px',
          }}
        >
          Banana Slides
        </span>
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Window controls — Windows only, custom buttons */}
      {!isMac && (
        <div
          className="flex items-center mr-1"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          {/* Minimize */}
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
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>

          {/* Maximize */}
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

          {/* Close */}
          <button
            onClick={handleClose}
            onMouseEnter={() => setHoveredBtn('close')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              ...btnBase,
              backgroundColor: hoveredBtn === 'close' ? '#e81123' : 'transparent',
              color: hoveredBtn === 'close' ? '#ffffff' : '#6b7280',
              borderRadius: '0 8px 0 0',
            }}
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}

      {/* macOS right padding */}
      {isMac && <div className="w-3 flex-shrink-0" />}
    </div>
  );
}
