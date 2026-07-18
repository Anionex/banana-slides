import React, { useState } from 'react';
import { RefreshCw, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import type { TemplateAsset, TemplateAnalysis, TemplateRegion } from '@/types';

const i18n = {
  zh: {
    tae: {
      role: '模板角色',
      layout: '布局结构',
      capacity: '内容容量',
      textRegions: '文本区域',
      imageRegions: '图片区域',
      density: '视觉密度',
      keywords: '风格关键词',
      palette: '配色',
      notes: '备注',
      low: '低',
      medium: '中',
      high: '高',
      save: '保存',
      saving: '保存中…',
      reanalyze: '重新解析',
      failedHint: '解析失败，可重新解析或手动填写',
      regionName: '名称',
      regionPosition: '位置',
      regionSize: '尺寸',
      addRegion: '添加区域',
      remove: '删除',
      commaHint: '逗号分隔',
    },
  },
  en: {
    tae: {
      role: 'Template role',
      layout: 'Layout structure',
      capacity: 'Content capacity',
      textRegions: 'Text regions',
      imageRegions: 'Image regions',
      density: 'Visual density',
      keywords: 'Style keywords',
      palette: 'Color palette',
      notes: 'Notes',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      save: 'Save',
      saving: 'Saving…',
      reanalyze: 'Re-analyze',
      failedHint: 'Analysis failed, re-analyze or fill in manually',
      regionName: 'Name',
      regionPosition: 'Position',
      regionSize: 'Size',
      addRegion: 'Add region',
      remove: 'Remove',
      commaHint: 'comma separated',
    },
  },
};

const emptyAnalysis: TemplateAnalysis = {
  template_role: '',
  layout_structure: '',
  content_capacity: 'medium',
  text_regions: [],
  image_regions: [],
  visual_density: 'medium',
  style_keywords: [],
  color_palette: [],
  notes: '',
};

// Merge with defaults so a partial analysis_json (e.g. an LLM response missing
// text_regions/image_regions) can't leave array fields undefined and crash the
// render via draft[field].map().
const withDefaults = (a?: TemplateAnalysis | null): TemplateAnalysis => ({
  ...emptyAnalysis,
  ...(a ?? {}),
});

export interface TemplateAnalysisEditorProps {
  asset: TemplateAsset;
  onSave: (analysis: TemplateAnalysis, notes: string) => Promise<void> | void;
  onReanalyze: () => Promise<void> | void;
}

export const TemplateAnalysisEditor: React.FC<TemplateAnalysisEditorProps> = ({
  asset,
  onSave,
  onReanalyze,
}) => {
  const t = useT(i18n);
  const failed = asset.analysis_status === 'failed';
  const [draft, setDraft] = useState<TemplateAnalysis>(withDefaults(asset.analysis_json));
  const [notes, setNotes] = useState<string>(asset.analysis_notes ?? '');
  // Keep keywords/palette as raw text while editing so trailing commas and
  // in-progress entries aren't stripped on every keystroke; parse on save.
  const [keywordsText, setKeywordsText] = useState<string>(
    (asset.analysis_json?.style_keywords ?? []).join(', ')
  );
  const [paletteText, setPaletteText] = useState<string>(
    (asset.analysis_json?.color_palette ?? []).join(', ')
  );
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Re-sync local editor state only when a different asset is selected or this
  // asset's analysis status actually changes (e.g. a re-analyze completes).
  // Depending on analysis_json/notes object refs would re-fire on every
  // background poll of *other* templates and clobber the user's unsaved edits.
  React.useEffect(() => {
    const next = withDefaults(asset.analysis_json);
    setDraft(next);
    setNotes(asset.analysis_notes ?? '');
    setKeywordsText((next.style_keywords ?? []).join(', '));
    setPaletteText((next.color_palette ?? []).join(', '));
  }, [asset.id, asset.analysis_status]);

  const levelOptions: TemplateAnalysis['content_capacity'][] = ['low', 'medium', 'high'];

  const updateField = <K extends keyof TemplateAnalysis>(key: K, value: TemplateAnalysis[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const updateRegion = (
    field: 'text_regions' | 'image_regions',
    idx: number,
    key: keyof TemplateRegion,
    value: string
  ) =>
    setDraft((prev) => {
      const next = [...prev[field]];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, [field]: next };
    });

  const addRegion = (field: 'text_regions' | 'image_regions') =>
    setDraft((prev) => ({
      ...prev,
      [field]: [...prev[field], { name: '', position: '', size: '' }],
    }));

  const removeRegion = (field: 'text_regions' | 'image_regions', idx: number) =>
    setDraft((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalDraft: TemplateAnalysis = {
        ...draft,
        style_keywords: keywordsText.split(',').map((s) => s.trim()).filter(Boolean),
        color_palette: paletteText.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await onSave(finalDraft, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await onReanalyze();
    } finally {
      setReanalyzing(false);
    }
  };

  const labelCls = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300';
  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-banana-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  const renderRegions = (field: 'text_regions' | 'image_regions') => (
    <div className="space-y-2">
      {draft[field].map((region, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            className={inputCls}
            placeholder={t('tae.regionName')}
            value={region.name}
            onChange={(e) => updateRegion(field, idx, 'name', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder={t('tae.regionPosition')}
            value={region.position}
            onChange={(e) => updateRegion(field, idx, 'position', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder={t('tae.regionSize')}
            value={region.size}
            onChange={(e) => updateRegion(field, idx, 'size', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeRegion(field, idx)}
            className="shrink-0 text-xs text-red-500 hover:text-red-600"
          >
            {t('tae.remove')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addRegion(field)}
        className="text-xs text-banana-600 hover:text-banana-700"
      >
        + {t('tae.addRegion')}
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border p-4',
        failed
          ? 'border-red-400 bg-red-50/50 dark:border-red-700 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      {failed && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={16} />
          <span>{t('tae.failedHint')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('tae.role')}</label>
          <input
            className={inputCls}
            value={draft.template_role}
            onChange={(e) => updateField('template_role', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t('tae.layout')}</label>
          <input
            className={inputCls}
            value={draft.layout_structure}
            onChange={(e) => updateField('layout_structure', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t('tae.capacity')}</label>
          <select
            className={inputCls}
            value={draft.content_capacity}
            onChange={(e) =>
              updateField('content_capacity', e.target.value as TemplateAnalysis['content_capacity'])
            }
          >
            {levelOptions.map((lv) => (
              <option key={lv} value={lv}>
                {t(`tae.${lv}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('tae.density')}</label>
          <select
            className={inputCls}
            value={draft.visual_density}
            onChange={(e) =>
              updateField('visual_density', e.target.value as TemplateAnalysis['visual_density'])
            }
          >
            {levelOptions.map((lv) => (
              <option key={lv} value={lv}>
                {t(`tae.${lv}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('tae.textRegions')}</label>
        {renderRegions('text_regions')}
      </div>
      <div>
        <label className={labelCls}>{t('tae.imageRegions')}</label>
        {renderRegions('image_regions')}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            {t('tae.keywords')} <span className="text-gray-400">({t('tae.commaHint')})</span>
          </label>
          <input
            className={inputCls}
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>
            {t('tae.palette')} <span className="text-gray-400">({t('tae.commaHint')})</span>
          </label>
          <input
            className={inputCls}
            value={paletteText}
            onChange={(e) => setPaletteText(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('tae.notes')}</label>
        <textarea
          className={cn(inputCls, 'min-h-[64px] resize-y')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} />}
          loading={reanalyzing}
          onClick={handleReanalyze}
        >
          {t('tae.reanalyze')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? t('tae.saving') : t('tae.save')}
        </Button>
      </div>
    </div>
  );
};

export default TemplateAnalysisEditor;
