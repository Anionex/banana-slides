import React, { useState, useEffect, useRef } from 'react';
import { ReferenceFileCard, useToast } from '@/components/shared';
import { listProjectReferenceFiles, type ReferenceFile } from '@/api/endpoints';

interface ReferenceFileListProps {
  // 两种模式：1. 从 API 加载（传入 projectId） 2. 直接显示（传入 files）
  projectId?: string | null;
  files?: ReferenceFile[]; // 如果传入 files，则直接显示，不从 API 加载
  onFileClick?: (fileId: string) => void;
  onFileStatusChange?: (file: ReferenceFile) => void;
  onFileDelete?: (fileId: string) => void; // 如果传入，使用外部删除逻辑
  deleteMode?: 'delete' | 'remove';
  title?: string; // 自定义标题
  className?: string; // 自定义样式
}

export const ReferenceFileList: React.FC<ReferenceFileListProps> = ({
  projectId,
  files: externalFiles,
  onFileClick,
  onFileStatusChange,
  onFileDelete,
  deleteMode = 'remove',
  title = '已上传的文件',
  className = 'mb-6',
}) => {
  const [internalFiles, setInternalFiles] = useState<ReferenceFile[]>([]);
  const { show } = useToast();
  const showRef = useRef(show);

  // 如果传入了 files，使用外部文件列表；否则从 API 加载
  const isExternalMode = externalFiles !== undefined;
  const files = isExternalMode ? externalFiles : internalFiles;

  useEffect(() => {
    showRef.current = show;
  }, [show]);

  // 只在非外部模式下从 API 加载
  useEffect(() => {
    if (isExternalMode || !projectId) {
      if (!isExternalMode) {
        setInternalFiles([]);
      }
      return;
    }

    const loadFiles = async () => {
      try {
        const response = await listProjectReferenceFiles(projectId);
        if (response.data?.files) {
          setInternalFiles(response.data.files);
        }
      } catch (error: any) {
        console.error('加载文件列表失败:', error);
        showRef.current({
          message: error?.response?.data?.error?.message || error.message || '加载文件列表失败',
          type: 'error',
        });
      }
    };

    loadFiles();
  }, [projectId, isExternalMode]);

  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    if (!isExternalMode) {
      setInternalFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
    }
    onFileStatusChange?.(updatedFile);
  };

  const handleFileDelete = (fileId: string) => {
    if (onFileDelete) {
      // 使用外部删除逻辑
      onFileDelete(fileId);
    } else if (!isExternalMode) {
      // 内部删除逻辑
      setInternalFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {files.map(file => (
          <ReferenceFileCard
            key={file.id}
            file={file}
            onDelete={handleFileDelete}
            onStatusChange={handleFileStatusChange}
            deleteMode={deleteMode}
            onClick={() => onFileClick?.(file.id)}
          />
        ))}
      </div>
    </div>
  );
};

