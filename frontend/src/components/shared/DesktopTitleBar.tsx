import { useEffect, useState } from 'react';

const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

export function DesktopTitleBar() {
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    if (isDesktop) {
      setPlatform((window as any).electronAPI.getPlatform());
    }
  }, []);

  if (!isDesktop) return null;

  const isMac = platform === 'darwin';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center select-none"
      style={{
        // @ts-expect-error -- WebkitAppRegion is a non-standard Electron CSS property
        WebkitAppRegion: 'drag',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      {isMac && <div className="w-[70px] flex-shrink-0" />}
      {!isMac && (
        <div
          className="flex items-center gap-2 pl-4 flex-shrink-0"
          // @ts-expect-error -- WebkitAppRegion is a non-standard Electron CSS property
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <span className="text-lg">🍌</span>
          <span className="text-sm font-semibold text-gray-700 tracking-wide">
            Banana Slides
          </span>
        </div>
      )}
      <div className="flex-1" />
      {isMac && <div className="w-4 flex-shrink-0" />}
    </div>
  );
}
