import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Minimize2, Play, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { getImageUrl } from '@/api/client';
import type { Page } from '@/types';

const playerI18n = {
  zh: {
    player: {
      playing: '播放中',
      exitPlayer: '退出播放',
      fullscreen: '全屏播放',
      exitFullscreen: '退出全屏',
      prevPage: '上一页',
      nextPage: '下一页',
      notGenerated: '尚未生成图片',
      queued: '排队等待生成...',
      generating: '正在生成中...',
      fullscreenUnavailable: '当前环境不支持全屏，请稍后再试',
    },
  },
  en: {
    player: {
      playing: 'Playing',
      exitPlayer: 'Exit presentation',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      prevPage: 'Previous slide',
      nextPage: 'Next slide',
      notGenerated: 'Image not generated yet',
      queued: 'Queued for generation...',
      generating: 'Generating...',
      fullscreenUnavailable: 'Fullscreen is not supported in this environment',
    },
  },
};

interface SlidePlayerProps {
  open: boolean;
  initialIndex: number;
  pages: Page[];
  aspectRatio: string; // e.g. '16:9'
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

/** 顶部栏 + 底部控制条 + 上下留白占用的纵向空间（px） */
const VERTICAL_RESERVED = 168;

function parseAspectRatio(aspectRatio: string): number {
  const parts = aspectRatio.split(':');
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (w > 0 && h > 0) return w / h;
  }
  return 16 / 9;
}

function pageImageUrl(page: Page): string {
  return page?.generated_image_path ? getImageUrl(page.generated_image_path, page.updated_at) : '';
}

export const SlidePlayer: React.FC<SlidePlayerProps> = ({
  open,
  initialIndex,
  pages,
  aspectRatio,
  onClose,
  onIndexChange,
}) => {
  const t = useT(playerI18n);
  const [index, setIndex] = useState(initialIndex);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [fullscreenError, setFullscreenError] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  // 每次打开都从调用方指定的当前页开始
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const clampedIndex = Math.max(0, Math.min(pages.length - 1, index));
  const page = pages[clampedIndex];

  const goTo = useCallback(
    (target: number) => {
      setIndex(Math.max(0, Math.min(pages.length - 1, target)));
    },
    [pages.length]
  );
  const prev = useCallback(() => goTo(clampedIndex - 1), [goTo, clampedIndex]);
  const next = useCallback(() => goTo(clampedIndex + 1), [goTo, clampedIndex]);

  // 播放中把页码同步给宿主页面，退出后主预览区停留在最后播放的页
  useEffect(() => {
    if (open) onIndexChange?.(clampedIndex);
  }, [open, clampedIndex, onIndexChange]);

  // 键盘：←/→ 翻页，Esc 退出播放（原生全屏时 Esc 由浏览器先退出全屏）
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, next, prev, onClose]);

  // 同步浏览器原生全屏状态（用户按 Esc 退出原生全屏时回到近似全屏）
  useEffect(() => {
    if (!open) return;
    const handler = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [open]);

  // 打开时刷新一次视口尺寸（避免沿用上次会话的陈旧值），随后跟随 resize
  useEffect(() => {
    if (!open) return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // 焦点陷阱：Tab 在播放器内循环，避免焦点逃逸到背景页面
  useEffect(() => {
    if (!open) return;
    const root = playerRef.current;
    if (!root) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inRoot = !!active && root.contains(active);
      // 焦点在 overlay 内但落在 items 之外（如 pending 期间被禁用的按钮）时同样回绕，
      // 否则浏览器默认 Tab 会把焦点送出 overlay
      const inItems = inRoot && !!active && items.includes(active as HTMLElement);
      if (e.shiftKey && (!inItems || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inItems || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    // capture 阶段挂在 document：进入原生全屏后焦点可能落在 body/root 之外，
    // 此时 keydown 不经过 playerRef，仍要兜住 Tab 防止焦点逃逸
    document.addEventListener('keydown', onTab, true);
    return () => document.removeEventListener('keydown', onTab, true);
  }, [open]);

  // 关闭播放时若仍在原生全屏，先退出全屏
  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open]);

  // 全屏失败提示自动消失
  useEffect(() => {
    if (!fullscreenError) return;
    errorTimerRef.current = window.setTimeout(() => setFullscreenError(false), 2500);
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
  }, [fullscreenError]);

  const toggleNativeFullscreen = async () => {
    if (fullscreenPending) return;
    setFullscreenPending(true);
    try {
      if (isNativeFullscreen) {
        await document.exitFullscreen?.();
      } else {
        const el = playerRef.current;
        if (!el?.requestFullscreen) {
          setFullscreenError(true);
          return;
        }
        await el.requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
    } finally {
      setFullscreenPending(false);
    }
  };

  if (!open) return null;

  const ratio = parseAspectRatio(aspectRatio);
  const availW = viewport.w - 2 * 32;
  const availH = viewport.h - VERTICAL_RESERVED;
  let slideWidth = availW;
  let slideHeight = slideWidth / ratio;
  if (slideHeight > availH) {
    slideHeight = availH;
    slideWidth = slideHeight * ratio;
  }

  const imageUrl = pageImageUrl(page);
  const generating = page?.status === 'QUEUED' || page?.status === 'GENERATING';
  const hasImage = !!imageUrl;

  return (
    <div
      ref={playerRef}
      data-testid="slide-player"
      role="dialog"
      aria-modal="true"
      aria-label={t('player.playing')}
      className="fixed inset-0 z-[100] flex flex-col bg-black select-none"
    >
      {/* 顶部：播放标识 + 退出 */}
      <header className="flex flex-shrink-0 items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Play size={14} className="shrink-0" />
          <span>{t('player.playing')}</span>
        </div>
        <button
          type="button"
          data-testid="player-exit"
          autoFocus
          onClick={onClose}
          aria-label={t('player.exitPlayer')}
          title={t('player.exitPlayer')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </header>

      {fullscreenError && (
        <div
          data-testid="player-fullscreen-error"
          role="alert"
          className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur"
        >
          {t('player.fullscreenUnavailable')}
        </div>
      )}

      {/* 画面区：等比缩放居中，左右分区域点击翻页 */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 md:px-8">
        <div
          className="relative overflow-hidden rounded-lg shadow-2xl"
          style={{ width: slideWidth, height: slideHeight }}
          data-testid="player-slide-stage"
        >
          {hasImage ? (
            <img
              src={imageUrl}
              alt={`Slide ${clampedIndex + 1}`}
              className="h-full w-full select-none object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-900">
              <div className="text-center">
                <ImageIcon
                  size={48}
                  className="mx-auto mb-4 text-white/25"
                  strokeWidth={1.5}
                />
                <p className="px-6 text-sm text-white/50">
                  {page?.status === 'QUEUED'
                    ? t('player.queued')
                    : generating
                      ? t('player.generating')
                      : t('player.notGenerated')}
                </p>
              </div>
            </div>
          )}
          {/* 点击翻页：左 1/3 上一页，右 2/3 下一页（PowerPoint 习惯） */}
          <div className="absolute inset-0 flex">
            <button
              type="button"
              aria-label={t('player.prevPage')}
              onClick={prev}
              disabled={clampedIndex === 0}
              tabIndex={-1}
              className="h-full w-1/3 cursor-w-resize"
            />
            <button
              type="button"
              aria-label={t('player.nextPage')}
              onClick={next}
              disabled={clampedIndex >= pages.length - 1}
              tabIndex={-1}
              className="h-full flex-1 cursor-e-resize"
            />
          </div>
        </div>
      </div>

      {/* 底部控制条 */}
      <footer className="flex flex-shrink-0 items-center justify-center px-4 pb-4 pt-2">
        <div
          data-testid="player-toolbar"
          className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur"
        >
          <button
            type="button"
            onClick={prev}
            disabled={clampedIndex === 0}
            aria-label={t('player.prevPage')}
            title={t('player.prevPage')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-1.5 text-sm tabular-nums text-white/80">
            {clampedIndex + 1} / {pages.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={clampedIndex >= pages.length - 1}
            aria-label={t('player.nextPage')}
            title={t('player.nextPage')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/20" />
          <button
            type="button"
            data-testid="player-fullscreen-toggle"
            onClick={toggleNativeFullscreen}
            disabled={fullscreenPending}
            aria-label={isNativeFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
            title={isNativeFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            {isNativeFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </footer>
    </div>
  );
};
