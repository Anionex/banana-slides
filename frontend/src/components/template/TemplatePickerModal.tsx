import React, { useRef, useState } from 'react';
import { Check, Upload, Ban } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import { getImageUrl } from '@/api/client';
import type { TemplateAsset } from '@/types';

const i18n = {
  zh: {
    tpm: {
      title: '选择模板',
      none: '不使用模板',
      uploadNew: '上传新模板',
      uploading: '上传中…',
      empty: '模板库为空，请先上传模板',
      pending: '解析中',
      processing: '解析中',
      completed: '已解析',
      failed: '解析失败',
      cancel: '取消',
    },
  },
  en: {
    tpm: {
      title: 'Select template',
      none: 'No template',
      uploadNew: 'Upload new template',
      uploading: 'Uploading…',
      empty: 'Template library is empty, upload one first',
      pending: 'Analyzing',
      processing: 'Analyzing',
      completed: 'Analyzed',
      failed: 'Analysis failed',
      cancel: 'Cancel',
    },
  },
};

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: TemplateAsset[];
  currentAssetId?: string | null;
  /** 选中某张模板（或传 null 清空）。 */
  onSelect: (assetId: string | null) => void | Promise<void>;
  /** 上传新模板，应返回新建的 asset 以便自动选中。 */
  onUpload?: (file: File) => Promise<TemplateAsset>;
  /** 是否展示"不使用模板"选项，默认 true。 */
  allowNone?: boolean;
}

const statusClass: Record<TemplateAsset['analysis_status'], string> = {
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  assets,
  currentAssetId,
  onSelect,
  onUpload,
  allowNone = true,
}) => {
  const t = useT(i18n);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      const asset = await onUpload(file);
      await onSelect(asset.id);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  const handlePick = async (assetId: string | null) => {
    await onSelect(assetId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('tpm.title')} size="wide">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {onUpload && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload size={16} />}
              loading={uploading}
              onClick={handleUploadClick}
            >
              {uploading ? t('tpm.uploading') : t('tpm.uploadNew')}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {assets.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('tpm.empty')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {allowNone && (
            <button
              type="button"
              onClick={() => handlePick(null)}
              className={cn(
                'group relative flex aspect-[4/3] flex-col items-center justify-center rounded-xl border-2 border-dashed text-gray-400 transition-all',
                !currentAssetId
                  ? 'border-banana-500 text-banana-600'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
              )}
            >
              <Ban size={24} />
              <span className="mt-1 text-xs">{t('tpm.none')}</span>
            </button>
          )}

          {assets.map((asset) => {
            const selected = asset.id === currentAssetId;
            const thumb = asset.thumb_url || asset.image_url;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handlePick(asset.id)}
                className={cn(
                  'group relative flex aspect-[4/3] flex-col overflow-hidden rounded-xl border-2 transition-all',
                  selected
                    ? 'border-banana-500 ring-2 ring-banana-500/40'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                )}
              >
                <img
                  src={getImageUrl(thumb)}
                  alt={asset.user_label || asset.id}
                  className="h-full w-full object-cover"
                />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-banana-500 text-black">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
                <span
                  className={cn(
                    'absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                    statusClass[asset.analysis_status]
                  )}
                >
                  {t(`tpm.${asset.analysis_status}`)}
                </span>
                {asset.user_label && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-left text-[11px] text-white">
                    {asset.user_label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default TemplatePickerModal;
