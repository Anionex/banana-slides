import React, { useRef, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import { getImageUrl } from '@/api/client';
import type { TemplateAsset } from '@/types';

const i18n = {
  zh: {
    ssm: {
      title: '转为单模板',
      desc: '所有页面将统一使用同一张模板。请选择一张现有模板，或上传一张新模板。',
      styleLabel: '统一风格描述（可选）',
      stylePlaceholder: '为所有页面追加统一的风格说明…',
      uploadNew: '上传新模板',
      uploading: '上传中…',
      empty: '模板库为空，请上传一张模板',
      confirm: '确认转换',
      converting: '转换中…',
      cancel: '取消',
      pickFirst: '请先选择或上传一张模板',
    },
  },
  en: {
    ssm: {
      title: 'Switch to single template',
      desc: 'All pages will use the same template. Pick an existing one, or upload a new template.',
      styleLabel: 'Unified style description (optional)',
      stylePlaceholder: 'Append a unified style note for all pages…',
      uploadNew: 'Upload new template',
      uploading: 'Uploading…',
      empty: 'Template library is empty, please upload one',
      confirm: 'Confirm switch',
      converting: 'Switching…',
      cancel: 'Cancel',
      pickFirst: 'Pick or upload a template first',
    },
  },
};

export interface SwitchToSingleModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assets: TemplateAsset[];
  /** 选择现有模板作为统一模板。 */
  onConfirmExisting: (assetId: string, unifiedStyleText?: string) => Promise<void>;
  /** 上传新模板并作为统一模板。 */
  onConfirmUpload: (file: File, unifiedStyleText?: string) => Promise<void>;
}

export const SwitchToSingleModeDialog: React.FC<SwitchToSingleModeDialogProps> = ({
  isOpen,
  onClose,
  assets,
  onConfirmExisting,
  onConfirmUpload,
}) => {
  const t = useT(i18n);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [styleText, setStyleText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedId(null);
    setPendingFile(null);
    setStyleText('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    setSelectedId(null);
  };

  const canConfirm = !!selectedId || !!pendingFile;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const style = styleText.trim() || undefined;
      if (pendingFile) {
        await onConfirmUpload(pendingFile, style);
      } else if (selectedId) {
        await onConfirmExisting(selectedId, style);
      }
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('ssm.title')} size="wide">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('ssm.desc')}</p>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={16} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('ssm.uploadNew')}
          </Button>
          {pendingFile && (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {pendingFile.name}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {assets.length === 0 && !pendingFile && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('ssm.empty')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => {
            const selected = asset.id === selectedId && !pendingFile;
            const thumb = asset.thumb_url || asset.image_url;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  setSelectedId(asset.id);
                  setPendingFile(null);
                }}
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
                {asset.user_label && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-left text-[11px] text-white">
                    {asset.user_label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('ssm.styleLabel')}
          </label>
          <textarea
            className="min-h-[60px] w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-banana-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder={t('ssm.stylePlaceholder')}
            value={styleText}
            onChange={(e) => setStyleText(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
            {t('ssm.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {submitting ? t('ssm.converting') : t('ssm.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SwitchToSingleModeDialog;
