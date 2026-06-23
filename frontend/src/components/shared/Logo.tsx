import React from 'react';
import { cn } from '@/utils';

interface LogoProps {
  /** 图标尺寸(px)，默认 28 */
  size?: number;
  /** 文字商标，传入即在图标右侧显示（通常为 t('home.title')） */
  wordmark?: React.ReactNode;
  className?: string;
}

/**
 * 品牌标识：应用 logo 图标 + 可选文字商标。
 * 用于替代各页面散落的 🍌 emoji，保证品牌呈现一致。
 */
export const Logo: React.FC<LogoProps> = ({ size = 28, wordmark, className }) => (
  <span className={cn('inline-flex items-center gap-2 select-none', className)}>
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ width: size, height: size }}
      className="object-contain shrink-0"
    />
    {wordmark != null && (
      <span className="text-base md:text-xl font-extrabold tracking-tight">{wordmark}</span>
    )}
  </span>
);
