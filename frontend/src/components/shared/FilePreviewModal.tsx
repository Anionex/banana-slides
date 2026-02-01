import React, { useState, useEffect, useRef } from 'react';
import { Modal, Markdown, Loading, useToast } from '@/components/shared';
import { useT } from '@/hooks/useT';
import { getReferenceFile, type ReferenceFile } from '@/api/endpoints';

// FilePreviewModal 组件自包含翻译
const filePreviewI18n = {
  zh: {
    filePreview: {
      title: "文件预览", loading: "加载文件内容中...",
      notParsed: "文件尚未解析完成，无法预览", loadFailed: "加载文件内容失败"
    }
  },
  en: {
    filePreview: {
      title: "File Preview", loading: "Loading file content...",
      notParsed: "File not yet parsed, cannot preview", loadFailed: "Failed to load file content"
    }
  }
};

interface FilePreviewModalProps {
  fileId: string | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  fileId,
  onClose,
}) => {
  const t = useT(filePreviewI18n);
  const [file, setFile] = useState<ReferenceFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { show } = useToast();
  
  // 使用 ref 保存函数引用，避免依赖项变化导致无限循环
  const onCloseRef = useRef(onClose);
  const showRef = useRef(show);
  
  useEffect(() => {
    onCloseRef.current = onClose;
    showRef.current = show;
  }, [onClose, show]);

  useEffect(() => {
    if (!fileId) {
      setFile(null);
      setContent(null);
      setIsLoading(false);
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      try {
        const response = await getReferenceFile(fileId);
        if (response.data?.file) {
          const fileData = response.data.file;
          
          // 检查文件是否已解析完成
          if (fileData.parse_status !== 'completed') {
            showRef.current({
              message: t('filePreview.notParsed'),
              type: 'info',
            });
            onCloseRef.current();
            return;
          }

          setFile(fileData);
          setContent(fileData.markdown_content || t('common.noData'));
        }
      } catch (error: any) {
        console.error('Load file content failed:', error);
        showRef.current({
          message: error?.response?.data?.error?.message || error.message || t('filePreview.loadFailed'),
          type: 'error',
        });
        setFile(null);
        setContent(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [fileId]); // 只依赖 fileId

  return (
    <Modal
      isOpen={fileId !== null}
      onClose={onClose}
      title={file?.filename || t('filePreview.title')}
      size="xl"
    >
      {isLoading ? (
        <div className="text-center py-8">
          <Loading message={t('filePreview.loading')} />
        </div>
      ) : content ? (
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="prose max-w-none">
            <Markdown>{content}</Markdown>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-foreground-tertiary">
          <p>{t('common.noData')}</p>
        </div>
      )}
    </Modal>
  );
};

