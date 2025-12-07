import React from 'react';

interface ShimmerOverlayProps {
  /** 是否显示渐变效果 */
  show: boolean;
  /** 透明度，默认 0.4 */
  opacity?: number;
  /** 圆角类型，默认 'card' */
  rounded?: 'card' | 'lg' | 'md' | 'sm' | 'none';
}

/**
 * 通用的渐变滚动覆盖层组件
 * 用于在卡片上显示"生成中"或"处理中"的视觉反馈
 * 复用了 Skeleton 组件的渐变效果样式
 */
export const ShimmerOverlay: React.FC<ShimmerOverlayProps> = ({
  show,
  opacity = 0.4,
  rounded = 'card',
}) => {
  if (!show) return null;

  const roundedClass = {
    card: 'rounded-card',
    lg: 'rounded-lg',
    md: 'rounded-md',
    sm: 'rounded-sm',
    none: '',
  }[rounded];

  return (
    <div className={`absolute inset-0 ${roundedClass} overflow-hidden pointer-events-none z-10`}>
      <div 
        className="absolute inset-0 bg-gradient-to-r from-gray-200 via-banana-50 to-gray-200 animate-shimmer" 
        style={{ 
          backgroundSize: '200% 100%',
          opacity 
        }}
      />
    </div>
  );
};

