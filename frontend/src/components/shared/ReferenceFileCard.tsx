import React, { useEffect, useState } from 'react';
import { FileText, Loader2, CheckCircle2, XCircle, X, RefreshCw } from 'lucide-react';
import { getReferenceFile, deleteReferenceFile, triggerFileParse, type ReferenceFile } from '@/api/endpoints';
import { isLocalMode } from '@/utils/mode';
import { LocalStorageService } from '@/services/localStorageService';

interface ReferenceFileCardProps {
  file: ReferenceFile;
  onDelete: (fileId: string) => void;
  onStatusChange?: (file: ReferenceFile) => void;
  deleteMode?: 'delete' | 'remove'; // 'delete': 彻底删除文件, 'remove': 只从项目中移除
}

export const ReferenceFileCard: React.FC<ReferenceFileCardProps> = ({
  file: initialFile,
  onDelete,
  onStatusChange,
  deleteMode = 'delete', // 默认是彻底删除（文件选择器中使用）
}) => {
  const [file, setFile] = useState<ReferenceFile>(initialFile);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);

  // Poll for status updates if parsing
  useEffect(() => {
    if (file.parse_status === 'pending' || file.parse_status === 'parsing') {
      // 本地模式：从 localStorage 轮询
      if (isLocalMode()) {
        const intervalId = setInterval(() => {
          try {
            const updatedFile = LocalStorageService.getReferenceFile(file.id);
            if (updatedFile) {
              setFile(updatedFile);
              
              // Notify parent of status change
              if (onStatusChange) {
                onStatusChange(updatedFile);
              }
              
              // Stop polling if completed or failed
              if (updatedFile.parse_status === 'completed' || updatedFile.parse_status === 'failed') {
                clearInterval(intervalId);
              }
            }
          } catch (error) {
            console.error('Failed to poll file status:', error);
          }
        }, 2000);

        return () => clearInterval(intervalId);
      } else {
        // 后端模式：从 API 轮询
        const intervalId = setInterval(async () => {
          try {
            const response = await getReferenceFile(file.id);
            if (response.data?.file) {
              const updatedFile = response.data.file;
              setFile(updatedFile);
              
              // Notify parent of status change
              if (onStatusChange) {
                onStatusChange(updatedFile);
              }
              
              // Stop polling if completed or failed
              if (updatedFile.parse_status === 'completed' || updatedFile.parse_status === 'failed') {
                clearInterval(intervalId);
              }
            }
          } catch (error) {
            console.error('Failed to poll file status:', error);
          }
        }, 2000);

        return () => clearInterval(intervalId);
      }
    }
  }, [file.id, file.parse_status, onStatusChange]);

  const handleDelete = async () => {
    if (isDeleting) return;
    
    if (deleteMode === 'remove') {
      // 只从项目中移除，不调用删除 API
      onDelete(file.id);
      return;
    }
    
    // 彻底删除文件
    setIsDeleting(true);
    try {
      if (isLocalMode()) {
        // 本地模式：从 localStorage 删除
        LocalStorageService.deleteReferenceFile(file.id);
        onDelete(file.id);
      } else {
        // 后端模式：调用 API 删除
        await deleteReferenceFile(file.id);
        onDelete(file.id);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      setIsDeleting(false);
    }
  };

  const handleReparse = async () => {
    if (isReparsing || file.parse_status === 'parsing' || file.parse_status === 'pending') return;
    
    // 本地模式：不支持重新解析（需要重新上传文件）
    if (isLocalMode()) {
      console.log('本地模式暂不支持重新解析，请重新上传文件');
      return;
    }
    
    // 后端模式：触发重新解析
    setIsReparsing(true);
    try {
      const response = await triggerFileParse(file.id);
      if (response.data?.file) {
        const updatedFile = response.data.file;
        setFile(updatedFile);
        
        // Notify parent of status change
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
        return '等待解析';
      case 'parsing':
        return '解析中...';
      case 'completed':
        return '解析完成';
      case 'failed':
        return '解析失败';
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
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      {/* File Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.filename}
          </p>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatFileSize(file.file_size)}
          </span>
        </div>
        
        {/* Status */}
        <div className="flex items-center gap-1.5 mt-1">
          {getStatusIcon()}
          <p className={`text-xs ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>

        {/* Image Caption Failure Warning */}
        {file.parse_status === 'completed' && 
         typeof file.image_caption_failed_count === 'number' && 
         file.image_caption_failed_count > 0 && (
          <p className="text-xs text-orange-500 mt-1">
            ⚠️ {file.image_caption_failed_count} 张图片未能生成描述
          </p>
        )}

        {/* Error Message */}
        {file.parse_status === 'failed' && file.error_message && (
          <p className="text-xs text-red-500 mt-1 line-clamp-2">
            {file.error_message}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Reparse Button - 只在解析完成时显示 */}
        {file.parse_status === 'completed' && (
          <button
            onClick={handleReparse}
            disabled={isReparsing}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="重新解析"
          >
            {isReparsing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}
        
        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          title={deleteMode === 'remove' ? '从项目中移除' : '删除文件'}
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

