import React, { useState, memo } from 'react';
import { Sparkles, History, ChevronDown, ChevronUp, Send } from 'lucide-react';

export interface AiRefineInputProps {
  /** 标题文字 */
  title: string;
  /** 输入框占位文字 */
  placeholder: string;
  /** 提交回调函数，接收当前要求和历史要求，返回 Promise */
  onSubmit: (requirement: string, previousRequirements: string[]) => Promise<void>;
  /** 是否禁用（例如没有内容可修改时） */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 状态变化回调，通知父组件当前是否正在提交 */
  onStatusChange?: (isSubmitting: boolean) => void;
}

const AiRefineInputComponent: React.FC<AiRefineInputProps> = ({
  title,
  placeholder,
  onSubmit,
  disabled = false,
  className = '',
  onStatusChange,
}) => {
  const [requirement, setRequirement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async () => {
    if (!requirement.trim() || isSubmitting || disabled) return;

    const currentRequirement = requirement.trim();
    setIsSubmitting(true);
    onStatusChange?.(true); // 通知父组件开始提交
    try {
      await onSubmit(currentRequirement, history);
      // 成功后将当前要求添加到历史
      setHistory(prev => [...prev, currentRequirement]);
      // 清空输入框
      setRequirement('');
    } finally {
      setIsSubmitting(false);
      onStatusChange?.(false); // 通知父组件提交结束
    }
  };

  // 处理 Ctrl+Enter 快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (disabled) {
    return null;
  }

  // 判断是否为紧凑模式（没有标题时）
  const isCompactMode = !title;

  return (
    <div className={isCompactMode ? `group ${className}` : `group bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 md:p-4 border border-purple-200 ${className}`}>
      {/* 标题和历史按钮 - 仅非紧凑模式显示 */}
      {!isCompactMode && (
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600 md:w-[18px] md:h-[18px]" />
            <h3 className="text-xs md:text-sm font-semibold text-gray-800">{title}</h3>
            <span className="text-xs text-gray-500 hidden sm:inline">（Ctrl+Enter 提交）</span>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
            >
              <History size={14} />
              <span className="hidden sm:inline">历史 ({history.length})</span>
              <span className="sm:hidden">{history.length}</span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      )}
      
      {/* 历史记录展示 */}
      {showHistory && history.length > 0 && (
        <div className={`${isCompactMode ? 'mb-2' : 'mb-3'} p-2 bg-white rounded border ${isCompactMode ? 'border-gray-200 shadow-sm' : 'bg-white/60 border-purple-100'} max-h-32 overflow-y-auto`}>
          <div className="text-xs text-gray-500 mb-1">之前的修改要求：</div>
          <ul className="space-y-1">
            {history.map((req, idx) => (
              <li key={idx} className="text-xs text-gray-700 flex items-start gap-1">
                <span className="text-purple-400 flex-shrink-0">{idx + 1}.</span>
                <span className="break-all">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex gap-2 items-center relative">
        {/* 紧凑模式下显示图标和历史按钮 */}
        {isCompactMode && (
          <>
            <Sparkles size={16} className={`flex-shrink-0 transition-colors ${isSubmitting ? 'text-purple-500' : 'text-purple-600'}`} />
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 transition-colors flex-shrink-0"
                title={`查看 ${history.length} 条历史修改`}
              >
                <History size={14} />
                <span className="hidden sm:inline">{history.length}</span>
              </button>
            )}
          </>
        )}
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full px-3 py-1.5 text-sm border ${isCompactMode ? 'border-gray-200' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
              isSubmitting ? 'animate-gradient-x bg-gradient-to-r from-purple-100 via-purple-200 to-purple-100 bg-[length:200%_100%]' : 'bg-white'
            }`}
            disabled={isSubmitting}
          />
          {isSubmitting && (
            <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-300/30 to-transparent animate-shimmer" 
                   style={{ backgroundSize: '200% 100%' }} />
            </div>
          )}
        </div>
        
        {/* 提交按钮 - 移动端始终显示，桌面端鼠标悬停时显示 */}
        <button
          onClick={handleSubmit}
          disabled={!requirement.trim() || isSubmitting}
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
            !requirement.trim() || isSubmitting
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95'
          } md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100`}
          title="提交 (Ctrl+Enter)"
        >
          <Send size={16} className={isSubmitting ? 'animate-pulse' : ''} />
        </button>
      </div>
    </div>
  );
};

// 使用 memo 包装组件，避免父组件频繁重渲染时影响输入框
// 只有当 props 真正变化时才重新渲染
export const AiRefineInput = memo(AiRefineInputComponent);

