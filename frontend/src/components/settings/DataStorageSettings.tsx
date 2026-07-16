import React, { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import { Button, Input, Modal } from '@/components/shared';
import { useT } from '@/hooks/useT';
import {
  getDataStorageElectronApi,
  type DataStorageInspection,
} from '@/types/dataStorage';

const dataStorageI18n = {
  zh: {
    dataStorage: {
      title: '数据存储位置',
      description: '用于保存项目、生成图片、上传素材和导出缓存。',
      pathLabel: '存储路径',
      browse: '浏览',
      openCurrent: '打开当前目录',
      saveRestart: '保存并重启',
      saving: '正在保存',
      loadFailed: '无法读取当前数据存储位置',
      inspectFailed: '无法使用所选目录',
      openFailed: '无法打开当前数据目录',
      applyFailed: '保存数据存储位置失败',
      pathRequired: '请选择或输入数据存储路径。',
      unchanged: '当前已使用此数据存储位置。',
      manualMigration: '应用不会自动移动或删除已有数据。需要迁移时，请先完全退出 Banana Slides，再将原目录中的 data、uploads、exports 完整复制到新位置。',
      restartHint: '修改后将立即重启应用，并从新位置读取数据。普通“保存设置”和“重置为默认配置”不会更改此路径。',
      confirmTitle: '确认使用新的空数据位置',
      confirmBody: '所选目录中没有 data/database.db。切换后 Banana Slides 将显示为全新安装，原有项目仍保留在原目录，不会被移动或删除。',
      confirmCheck: '我确认已按需复制 data、uploads、exports，并理解新目录可能不包含原有项目。',
      cancel: '取消',
      confirmRestart: '确认并重启',
    },
  },
  en: {
    dataStorage: {
      title: 'Data storage location',
      description: 'Stores projects, generated images, uploaded assets, and export cache.',
      pathLabel: 'Storage path',
      browse: 'Browse',
      openCurrent: 'Open current folder',
      saveRestart: 'Save and restart',
      saving: 'Saving',
      loadFailed: 'Could not load the current data storage location',
      inspectFailed: 'The selected folder cannot be used',
      openFailed: 'Could not open the current data folder',
      applyFailed: 'Could not save the data storage location',
      pathRequired: 'Choose or enter a data storage path.',
      unchanged: 'This data storage location is already in use.',
      manualMigration: 'The app does not move or delete existing data automatically. To migrate, quit Banana Slides completely, then copy data, uploads, and exports in full from the old folder to the new one.',
      restartHint: 'The app restarts immediately after this change and reads data from the new location. Regular Save Settings and Reset to Default do not change this path.',
      confirmTitle: 'Use a new empty data location?',
      confirmBody: 'The selected folder does not contain data/database.db. Banana Slides will appear as a new installation after switching. Existing projects remain in the old folder and will not be moved or deleted.',
      confirmCheck: 'I confirm that I copied data, uploads, and exports if needed, and understand that the new folder may not contain my existing projects.',
      cancel: 'Cancel',
      confirmRestart: 'Confirm and restart',
    },
  },
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

export const DataStorageSettings: React.FC = () => {
  const t = useT(dataStorageI18n);
  const api = getDataStorageElectronApi();
  const [currentPath, setCurrentPath] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [configurable, setConfigurable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingInspection, setPendingInspection] = useState<DataStorageInspection | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const loadFailedMessage = t('dataStorage.loadFailed');

  useEffect(() => {
    if (!api) return;
    let active = true;
    api.getDataStorageInfo()
      .then((info) => {
        if (!active) return;
        setConfigurable(info.configurable);
        setCurrentPath(info.dataRoot);
        setPath(info.dataRoot);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setConfigurable(true);
        setError(errorMessage(loadError, loadFailedMessage));
        setLoading(false);
      });
    return () => { active = false; };
  }, [api, loadFailedMessage]);

  if (!api || configurable === false || configurable === null) return null;

  const chooseDirectory = async () => {
    setError('');
    try {
      const selected = await api.chooseDataStorageDirectory();
      if (selected) setPath(selected);
    } catch (chooseError) {
      setError(errorMessage(chooseError, t('dataStorage.inspectFailed')));
    }
  };

  const openCurrentDirectory = async () => {
    setError('');
    try {
      const result = await api.openDataStorageDirectory();
      if (!result.success) setError(result.error || t('dataStorage.openFailed'));
    } catch (openError) {
      setError(errorMessage(openError, t('dataStorage.openFailed')));
    }
  };

  const apply = async (inspection: DataStorageInspection, allowInitialize: boolean) => {
    setSaving(true);
    setError('');
    try {
      const result = await api.applyDataStorageDirectory(inspection.dataRoot, allowInitialize);
      if (!result.success) {
        setError(t('dataStorage.applyFailed'));
        setSaving(false);
      }
    } catch (applyError) {
      setError(errorMessage(applyError, t('dataStorage.applyFailed')));
      setSaving(false);
    }
  };

  const inspectAndApply = async () => {
    const candidate = path.trim();
    setError('');
    if (!candidate) {
      setError(t('dataStorage.pathRequired'));
      return;
    }
    if (candidate === currentPath) {
      setError(t('dataStorage.unchanged'));
      return;
    }
    setSaving(true);
    try {
      const inspection = await api.inspectDataStorageDirectory(candidate);
      if (inspection.dataRoot === currentPath) {
        setError(t('dataStorage.unchanged'));
        setSaving(false);
        return;
      }
      if (!inspection.hasDatabase) {
        setPendingInspection(inspection);
        setAcknowledged(false);
        setSaving(false);
        return;
      }
      await apply(inspection, false);
    } catch (inspectError) {
      setError(errorMessage(inspectError, t('dataStorage.inspectFailed')));
      setSaving(false);
    }
  };

  const confirmEmptyDirectory = async () => {
    if (!pendingInspection || !acknowledged) return;
    const inspection = pendingInspection;
    setPendingInspection(null);
    await apply(inspection, true);
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white/70 p-5 dark:border-border-primary dark:bg-background-secondary/70" aria-labelledby="data-storage-title">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-banana-100 p-2 text-banana-800 dark:bg-banana-500/15 dark:text-banana-300">
          <HardDrive size={22} />
        </div>
        <div>
          <h2 id="data-storage-title" className="text-xl font-semibold text-gray-900 dark:text-foreground-primary">{t('dataStorage.title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('dataStorage.description')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label={t('dataStorage.pathLabel')}
          value={path}
          onChange={(event) => setPath(event.target.value)}
          disabled={loading || saving}
          aria-label={t('dataStorage.pathLabel')}
        />
        <Button variant="secondary" icon={<FolderOpen size={17} />} onClick={chooseDirectory} disabled={loading || saving}>
          {t('dataStorage.browse')}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <p className="font-medium">{t('dataStorage.manualMigration')}</p>
        <p className="mt-2 opacity-90">{t('dataStorage.restartHint')}</p>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" icon={<FolderOpen size={17} />} onClick={openCurrentDirectory} disabled={loading || saving || !currentPath}>
          {t('dataStorage.openCurrent')}
        </Button>
        <Button icon={<RefreshCw size={17} />} onClick={inspectAndApply} loading={saving} disabled={loading}>
          {saving ? t('dataStorage.saving') : t('dataStorage.saveRestart')}
        </Button>
      </div>

      <Modal
        isOpen={Boolean(pendingInspection)}
        onClose={() => setPendingInspection(null)}
        title={t('dataStorage.confirmTitle')}
        size="md"
      >
        <div className="space-y-5 px-7 pb-7">
          <p className="text-sm leading-6 text-gray-700 dark:text-foreground-secondary">{t('dataStorage.confirmBody')}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-banana-500"
            />
            <span>{t('dataStorage.confirmCheck')}</span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPendingInspection(null)}>{t('dataStorage.cancel')}</Button>
            <Button onClick={confirmEmptyDirectory} disabled={!acknowledged} loading={saving}>{t('dataStorage.confirmRestart')}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
