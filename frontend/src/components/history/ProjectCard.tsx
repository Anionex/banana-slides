import React, { useState, useEffect } from 'react';
import { Clock, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { Card } from '@/components/shared';
import { getProjectTitle, getFirstPageImage, formatDate, getStatusText, getStatusColor } from '@/utils/projectUtils';
import type { Project } from '@/types';

export interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: (project: Project) => void;
  onToggleSelect: (projectId: string) => void;
  onDelete: (e: React.MouseEvent, project: Project) => void;
  onStartEdit: (e: React.MouseEvent, project: Project) => void;
  onTitleChange: (title: string) => void;
  onTitleKeyDown: (e: React.KeyboardEvent, projectId: string) => void;
  onSaveEdit: (projectId: string) => void;
  isBatchMode: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isSelected,
  isEditing,
  editingTitle,
  onSelect,
  onToggleSelect,
  onDelete,
  onStartEdit,
  onTitleChange,
  onTitleKeyDown,
  onSaveEdit,
  isBatchMode,
}) => {
  // 检测屏幕尺寸，只在非手机端加载图片（必须在早期返回之前声明hooks）
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      // sm breakpoint is 640px
      setShouldLoadImage(window.innerWidth >= 640);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const projectId = project.id || project.project_id;
  if (!projectId) return null;

  const title = getProjectTitle(project);
  const pageCount = project.pages?.length || 0;
  const statusText = getStatusText(project);
  const statusColor = getStatusColor(project);
  
  const firstPageImage = shouldLoadImage ? getFirstPageImage(project) : null;

  return (
    <Card
      className={`p-3 md:p-6 transition-all ${
        isSelected 
          ? 'border-2 border-banana-500 bg-banana-50' 
          : 'hover:shadow-lg border border-gray-200'
      } ${isBatchMode ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={() => onSelect(project)}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* 复选框 */}
        <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(projectId)}
            className="w-4 h-4 text-banana-600 border-gray-300 rounded focus:ring-banana-500 cursor-pointer"
          />
        </div>
        
        {/* 中间：项目信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => onTitleKeyDown(e, projectId)}
                onBlur={() => onSaveEdit(projectId)}
                autoFocus
                className="text-base md:text-lg font-semibold text-gray-900 px-2 py-1 border border-banana-500 rounded focus:outline-none focus:ring-2 focus:ring-banana-500 flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3 
                className={`text-base md:text-lg font-semibold text-gray-900 truncate flex-1 min-w-0 ${
                  isBatchMode 
                    ? 'cursor-default' 
                    : 'cursor-pointer hover:text-banana-600 transition-colors'
                }`}
                onClick={(e) => onStartEdit(e, project)}
                title={isBatchMode ? undefined : "点击编辑名称"}
              >
                {title}
              </h3>
            )}
            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${statusColor}`}>
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <FileText size={14} />
              {pageCount} 页
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDate(project.updated_at || project.created_at)}
            </span>
          </div>
        </div>
        
        {/* 右侧：图片预览 */}
        <div className="hidden sm:block w-40 h-24 md:w-64 md:h-36 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
          {firstPageImage ? (
            <img
              src={firstPageImage}
              alt="第一页预览"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <FileText size={20} className="md:w-6 md:h-6" />
            </div>
          )}
        </div>
        
        {/* 右侧：操作按钮 */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={(e) => onDelete(e, project)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="删除项目"
          >
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <ChevronRight size={18} className="text-gray-400 md:w-5 md:h-5" />
        </div>
      </div>
    </Card>
  );
};

