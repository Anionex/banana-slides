import React, { useEffect, useState } from 'react';
import { FileText, Loader2, CheckCircle2, XCircle, X, RefreshCw } from 'lucide-react';
import { getReferenceFile, deleteReferenceFile, dissociateFileFromProject, triggerFileParse, type ReferenceFile } from '@/api/endpoints';
import { useT } from '@/hooks/useT';

// ReferenceFileCard 组件自包含翻译
const referenceFileCardI18n = {
  zh: {
    referenceFile: {
      parseStatus: { pending: "等待解析", parsing: "解析中...", completed: "解析完成", failed: "解析失败" },
      reparse: "重新解析", removeFromProject: "从项目中移除", deleteFile: "删除文件",
      imageCaptionFailed: "⚠️ {{count}} 张图片未能生成描述"
    }
  },
  en: {
    referenceFile: {
      parseStatus: { pending: "Pending", parsing: "Parsing...", completed: "Completed", failed: "Failed" },
      reparse: "Reparse", removeFromProject: "Remove from Project", deleteFile: "Delete File",
      imageCaptionFailed: "⚠️ {{count}} images failed to generate captions"
    }
  }
};

export interface ReferenceFileCardProps {
  file: ReferenceFile;
  onDelete: (fileId: string) => void;
  onStatusChange?: (file: ReferenceFile) => void;
  deleteMode?: 'delete' | 'remove';
  onClick?: () => void;
}

export const ReferenceFileCard: React.FC<ReferenceFileCardProps> = ({
  file: initialFile,
  onDelete,
  onStatusChange,
  deleteMode = 'delete',
  onClick,
}) => {
  const t = useT(referenceFileCardI18n);
  const [file, setFile] = useState<ReferenceFile>(initialFile);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);

  useEffect(() => {
    if (file.parse_status === 'pending' || file.parse_status === 'parsing') {
      const intervalId = setInterval(async () => {
        try {
          const response = await getReferenceFile(file.id);
          if (response.data?.file) {
            const updatedFile = response.data.file;
            setFile(updatedFile);
            
            if (onStatusChange) {
              onStatusChange(updatedFile);
            }
            
            if (updatedFile.parse_status === 'completed' || updatedFile.parse_status === 'failed') {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Failed to poll file status:', error);
        }
      }, 2000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [file.id, file.parse_status, onStatusChange]);

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      if (deleteMode === 'remove') {
        await dissociateFileFromProject(file.id);
      } else {
        await deleteReferenceFile(file.id);
      }
      onDelete(file.id);
    } catch (error) {
      console.error('Failed to delete/remove file:', error);
      setIsDeleting(false);
    }
  };

  const handleReparse = async () => {
    if (isReparsing || file.parse_status === 'parsing' || file.parse_status === 'pending') return;
    
    setIsReparsing(true);
    try {
      const response = await triggerFileParse(file.id);
      if (response.data?.file) {
        const updatedFile = response.data.file;
        setFile(updatedFile);
        
        if (onStatusChange) {
          onStatusChange(updatedFile);
        }
      }
    } catch (error) {
      console.error('Failed to trigger reparse:', error);
    } finally {
      setIsReparsing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = () => {
    switch (file.parse_status) {
      case 'pending':
      case 'parsing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (file.parse_status) {
      case 'pending':
        return t('referenceFile.parseStatus.pending');
      case 'parsing':
        return t('referenceFile.parseStatus.parsing');
      case 'completed':
        return t('referenceFile.parseStatus.completed');
      case 'failed':
        return t('referenceFile.parseStatus.failed');
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (file.parse_status) {
      case 'pending':
      case 'parsing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600 dark:text-foreground-tertiary';
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 w-72 bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary rounded-lg hover:shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-md flex items-center justify-center">
          <FileText className="w-4 h-4 text-blue-600" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-foreground-primary truncate">
            {file.filename}
          </p>
          <span className="text-xs text-gray-500 dark:text-foreground-tertiary flex-shrink-0">
            {formatFileSize(file.file_size)}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 mt-1">
          {getStatusIcon()}
          <p className={`text-xs ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>

        {file.parse_status === 'completed' && 
         typeof file.image_caption_failed_count === 'number' && 
         file.image_caption_failed_count > 0 && (
          <p className="text-xs text-orange-500 mt-1">
            {t('referenceFile.imageCaptionFailed', { count: file.image_caption_failed_count })}
          </p>
        )}

        {file.parse_status === 'failed' && file.error_message && (
          <p className="text-xs text-red-500 mt-1 line-clamp-2">
            {file.error_message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {file.parse_status === 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReparse();
            }}
            disabled={isReparsing}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title={t('referenceFile.reparse')}
          >
            {isReparsing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={isDeleting}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          title={deleteMode === 'remove' ? t('referenceFile.removeFromProject') : t('referenceFile.deleteFile')}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
