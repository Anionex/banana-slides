import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/utils';

interface ProgressData {
  total: number;
  completed: number;
  percent?: number;
  current_step?: string;
  messages?: string[];
}

interface LoadingProps {
  fullscreen?: boolean;
  message?: string;
  progress?: ProgressData;
  /** Callback when user clicks "Run in Background" button */
  onBackgroundClick?: () => void;
  /** Label for the background button */
  backgroundButtonLabel?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  fullscreen = false,
  message = '加载中...',
  progress,
  onBackgroundClick,
  backgroundButtonLabel = '在后台执行',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress?.messages]);
  
  // 计算进度百分比
  const getPercent = () => {
    if (!progress) return 0;
    if (progress.percent !== undefined) return progress.percent;
    if (progress.total > 0) return Math.round((progress.completed / progress.total) * 100);
    return 0;
  };
  
  const percent = getPercent();
  const hasMessages = progress?.messages && progress.messages.length > 0;
  
  const content = (
    <div className="flex flex-col items-center justify-center max-w-md w-full px-4">
      {/* 加载图标 */}
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-4 border-banana-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-banana-500 rounded-full border-t-transparent animate-spin" />
      </div>
      
      {/* 消息 */}
      <p className="text-lg text-gray-700 mb-4 text-center">{message}</p>
      
      {/* 进度条 */}
      {progress && (
        <div className="w-full">
          <div className="flex justify-end text-sm text-gray-600 mb-2">
            <span className="font-medium">{percent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-banana-500 to-banana-600 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      
      {/* 滚动消息日志 */}
      {hasMessages && (
        <div className="w-full mt-4">
          <div className="bg-banana-50 border border-banana-200 rounded-lg p-3 h-32 overflow-y-auto text-xs">
            {progress.messages!.map((msg, index) => (
              <div 
                key={index} 
                className={cn(
                  "py-0.5",
                  index === progress.messages!.length - 1 
                    ? "text-banana-700 font-medium" 
                    : "text-gray-500"
                )}
              >
                <span className="text-banana-400 mr-2">›</span>
                {msg}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
        {/* Background button - top left corner */}
        {onBackgroundClick && (
          <button
            onClick={onBackgroundClick}
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-banana-600 bg-white/80 hover:bg-banana-50 rounded-lg border border-gray-200 shadow-sm transition-colors"
          >
            <ArrowLeft size={16} />
            {backgroundButtonLabel}
          </button>
        )}
        {content}
      </div>
    );
  }

  return content;
};

// 骨架屏组件
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-gray-200 via-banana-50 to-gray-200',
        'bg-[length:200%_100%]',
        className
      )}
    />
  );
};

