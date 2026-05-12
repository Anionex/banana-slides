import React, { useState, useEffect } from 'react';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { useT } from '@/hooks/useT';
import { getImageUrl } from '@/api/client';

// Template 组件自包含翻译
const templateI18n = {
  zh: {
    template: {
      myTemplates: "我的模板", presetTemplates: "预设模板", uploadTemplate: "上传模板",
      deleteTemplate: "删除模板", templateSelected: "已选择",
      saveToLibraryOnUpload: "上传模板时同时保存到我的模板库",
      selectFromMaterials: "从素材库选择", selectAsTemplate: "从素材库选择作为模板",
      cannotDeleteInUse: "当前使用中的模板不能删除，请先取消选择或切换",
      stylePromptLabel: "风格描述", stylePromptPlaceholder: "例如：极简商务蓝白配色，顶部标题区，留白充足",
      generateCandidates: "生成5个模板候选", styleCandidates: "模板风格候选", styleCandidatesHint: "候选是幻灯片模板/风格参考图，不是普通插图。选择后会走现有模板上传流程，并作为后续页面复用的模板图；不会保存到模板库。",
      selectCandidate: "选择此候选", generatingCandidates: "正在生成候选...", selectingCandidate: "正在应用候选...",
      presets: {
        retroScroll: "复古卷轴", vectorIllustration: "矢量插画", glassEffect: "拟物玻璃",
        techBlue: "科技蓝", simpleBusiness: "简约商务", academicReport: "学术报告"
      },
      messages: {
        uploadSuccess: "模板上传成功", uploadFailed: "模板上传失败", deleteSuccess: "模板已删除", deleteFailed: "删除模板失败",
        candidateGenerateFailed: "生成候选失败", candidateSelected: "已选择候选模板", stylePromptRequired: "请先输入风格描述"
      }
    },
    material: { messages: { savedToLibrary: "素材已保存到模板库", selectedAsTemplate: "已从素材库选择作为模板", loadMaterialFailed: "加载素材失败" } }
  },
  en: {
    template: {
      myTemplates: "My Templates", presetTemplates: "Preset Templates", uploadTemplate: "Upload Template",
      deleteTemplate: "Delete Template", templateSelected: "Selected",
      saveToLibraryOnUpload: "Save to my template library when uploading",
      selectFromMaterials: "Select from Materials", selectAsTemplate: "Select from materials as template",
      cannotDeleteInUse: "Cannot delete template in use, please deselect or switch first",
      stylePromptLabel: "Style Prompt", stylePromptPlaceholder: "e.g. Minimal business blue/white palette, title block on top, generous whitespace",
      generateCandidates: "Generate 5 template candidates", styleCandidates: "Template Style Candidates", styleCandidatesHint: "Candidates are transient slide template/style references, not generic illustrations. Selecting one feeds the existing template upload flow and becomes the template image reused for later page generation; it is not saved to your library.",
      selectCandidate: "Use this candidate", generatingCandidates: "Generating candidates...", selectingCandidate: "Applying candidate...",
      presets: {
        retroScroll: "Retro Scroll", vectorIllustration: "Vector Illustration", glassEffect: "Glass Effect",
        techBlue: "Tech Blue", simpleBusiness: "Simple Business", academicReport: "Academic Report"
      },
      messages: {
        uploadSuccess: "Template uploaded successfully", uploadFailed: "Failed to upload template", deleteSuccess: "Template deleted", deleteFailed: "Failed to delete template",
        candidateGenerateFailed: "Failed to generate candidates", candidateSelected: "Candidate template selected", stylePromptRequired: "Please enter a style prompt first"
      }
    },
    material: { messages: { savedToLibrary: "Material saved to template library", selectedAsTemplate: "Selected from library as template", loadMaterialFailed: "Failed to load materials" } }
  }
};
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, createTemplateCandidates, type Material, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { TemplateCandidate } from '@/types';
import { ImagePlus, Loader2, Sparkles, X } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (templateFile: File | null, templateId?: string) => void;
  selectedTemplateId?: string | null;
  selectedPresetTemplateId?: string | null;
  showUpload?: boolean;
  projectId?: string | null;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  selectedPresetTemplateId,
  showUpload = true,
  projectId,
}) => {
  const t = useT(templateI18n);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [stylePrompt, setStylePrompt] = useState('');
  const [templateCandidates, setTemplateCandidates] = useState<TemplateCandidate[]>([]);
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const { show, ToastContainer } = useToast();

  const presetTemplates = [
    { id: '1', nameKey: 'template.presets.retroScroll', preview: '/templates/template_y.png', thumb: '/templates/template_y-thumb.webp' },
    { id: '2', nameKey: 'template.presets.vectorIllustration', preview: '/templates/template_vector_illustration.png', thumb: '/templates/template_vector_illustration-thumb.webp' },
    { id: '3', nameKey: 'template.presets.glassEffect', preview: '/templates/template_glass.png', thumb: '/templates/template_glass-thumb.webp' },
  ];

  useEffect(() => {
    loadUserTemplates();
  }, []);

  const loadUserTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await listUserTemplates();
      if (response.data?.templates) {
        setUserTemplates(response.data.templates);
      }
    } catch (error: any) {
      console.error('Failed to load user templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (showUpload) {
          const response = await uploadUserTemplate(file);
          if (response.data) {
            const template = response.data;
            setUserTemplates(prev => [template, ...prev]);
            onSelect(null, template.template_id);
            show({ message: t('template.messages.uploadSuccess'), type: 'success' });
          }
        } else {
          if (saveToLibrary) {
            const response = await uploadUserTemplate(file);
            if (response.data) {
              const template = response.data;
              setUserTemplates(prev => [template, ...prev]);
              onSelect(file, template.template_id);
              show({ message: t('material.messages.savedToLibrary'), type: 'success' });
            }
          } else {
            onSelect(file);
          }
        }
      } catch (error: any) {
        console.error('Failed to upload template:', error);
        show({ message: t('template.messages.uploadFailed') + ': ' + (error.message || t('common.unknownError')), type: 'error' });
      }
    }
    e.target.value = '';
  };

  const handleSelectUserTemplate = (template: UserTemplate) => {
    onSelect(null, template.template_id);
  };

  const handleSelectPresetTemplate = (templateId: string, preview: string) => {
    if (!preview) return;
    onSelect(null, templateId);
  };

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const fileExtension = blob.type === 'image/webp' ? 'webp' : 'png';
    const normalizedFilename = filename.replace(/\.[^.]+$/, '') || 'template-candidate';
    return new File([blob], `${normalizedFilename}.${fileExtension}`, { type: blob.type || 'image/png' });
  };

  const handleGenerateCandidates = async () => {
    if (!projectId || isGeneratingCandidates) return;

    const trimmedPrompt = stylePrompt.trim();
    if (!trimmedPrompt) {
      show({ message: t('template.messages.stylePromptRequired'), type: 'info' });
      return;
    }

    setTemplateCandidates([]);
    setIsGeneratingCandidates(true);
    setSelectedCandidateId(null);
    try {
      const response = await createTemplateCandidates(projectId, trimmedPrompt);
      setTemplateCandidates(response.data?.candidates || []);
    } catch (error: any) {
      setTemplateCandidates([]);
      console.error('Failed to generate template candidates:', error);
      show({ message: t('template.messages.candidateGenerateFailed') + ': ' + (error.message || t('common.unknownError')), type: 'error' });
    } finally {
      setIsGeneratingCandidates(false);
    }
  };

  const handleSelectTemplateCandidate = async (candidate: TemplateCandidate) => {
    if (selectedCandidateId) return;

    setSelectedCandidateId(candidate.candidate_id);
    try {
      // Keep maintainer-required semantics: candidate selection stays a pre-step
      // to the existing template upload flow by converting the preview into a File.
      const file = await dataUrlToFile(candidate.image_url, candidate.candidate_id);
      await onSelect(file);
      show({ message: t('template.messages.candidateSelected'), type: 'success' });
    } catch (error: any) {
      console.error('Failed to select template candidate:', error);
      show({ message: t('template.messages.uploadFailed') + ': ' + (error.message || t('common.unknownError')), type: 'error' });
    } finally {
      setSelectedCandidateId(null);
    }
  };

  const handleSelectMaterials = async (materials: Material[], saveAsTemplate?: boolean) => {
    if (materials.length === 0) return;
    
    try {
      const file = await materialUrlToFile(materials[0]);
      
      if (saveAsTemplate) {
        const response = await uploadUserTemplate(file);
        if (response.data) {
          const template = response.data;
          setUserTemplates(prev => [template, ...prev]);
          onSelect(file, template.template_id);
          show({ message: t('material.messages.savedToLibrary'), type: 'success' });
        }
      } else {
        onSelect(file);
        show({ message: t('material.messages.selectedAsTemplate'), type: 'success' });
      }
    } catch (error: any) {
      console.error('Failed to load material:', error);
      show({ message: t('material.messages.loadMaterialFailed') + ': ' + (error.message || t('common.unknownError')), type: 'error' });
    }
  };

  const handleDeleteUserTemplate = async (template: UserTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTemplateId === template.template_id) {
      show({ message: t('template.cannotDeleteInUse'), type: 'info' });
      return;
    }
    setDeletingTemplateId(template.template_id);
    try {
      await deleteUserTemplate(template.template_id);
      setUserTemplates((prev) => prev.filter((t) => t.template_id !== template.template_id));
      show({ message: t('template.messages.deleteSuccess'), type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      show({ message: t('template.messages.deleteFailed') + ': ' + (error.message || t('common.unknownError')), type: 'error' });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {userTemplates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">{t('template.myTemplates')}</h4>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {userTemplates.map((template) => (
                <div
                  key={template.template_id}
                  onClick={() => handleSelectUserTemplate(template)}
                  className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all relative group ${
                    selectedTemplateId === template.template_id
                      ? 'border-banana-500 ring-2 ring-banana-200'
                      : 'border-gray-200 dark:border-border-primary hover:border-banana-300'
                  }`}
                >
                  <img
                    src={getImageUrl(template.thumb_url || template.template_image_url)}
                    alt={template.name || 'Template'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {selectedTemplateId !== template.template_id && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteUserTemplate(template, e)}
                      disabled={deletingTemplateId === template.template_id}
                      className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow z-20 opacity-0 group-hover:opacity-100 transition-opacity ${
                        deletingTemplateId === template.template_id ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      aria-label={t('template.deleteTemplate')}
                    >
                      <X size={12} />
                    </button>
                  )}
                  {selectedTemplateId === template.template_id && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-semibold text-sm">{t('template.templateSelected')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {projectId && (
          <div className="rounded-lg border border-gray-200 dark:border-border-primary p-4 space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('template.styleCandidates')}</h4>
              <p className="text-xs text-gray-500 dark:text-foreground-tertiary mt-1">{t('template.styleCandidatesHint')}</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-700 dark:text-foreground-secondary">
                {t('template.stylePromptLabel')}
              </label>
              <textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                disabled={isGeneratingCandidates}
                placeholder={t('template.stylePromptPlaceholder')}
                className="w-full min-h-[88px] rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary px-3 py-2 text-sm text-gray-900 dark:text-foreground-primary focus:outline-none focus:ring-2 focus:ring-banana-400 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={isGeneratingCandidates ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              onClick={handleGenerateCandidates}
              disabled={!projectId || isGeneratingCandidates}
              className="w-full"
            >
              {isGeneratingCandidates ? t('template.generatingCandidates') : t('template.generateCandidates')}
            </Button>
            {templateCandidates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templateCandidates.map((candidate) => {
                  const isSelecting = selectedCandidateId === candidate.candidate_id;
                  return (
                    <button
                      key={candidate.candidate_id}
                      type="button"
                      onClick={() => handleSelectTemplateCandidate(candidate)}
                      disabled={!!selectedCandidateId}
                      className="group text-left rounded-lg border border-gray-200 dark:border-border-primary hover:border-banana-400 transition-all overflow-hidden bg-white dark:bg-background-secondary disabled:opacity-70"
                    >
                      <img
                        src={candidate.image_url}
                        alt={candidate.candidate_id}
                        className="w-full aspect-[4/3] object-cover"
                      />
                      <div className="p-3 flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 dark:text-foreground-secondary truncate">{candidate.candidate_id}</span>
                        <span className="text-xs text-banana-600 dark:text-banana-400">{isSelecting ? t('template.selectingCandidate') : t('template.selectCandidate')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">{t('template.presetTemplates')}</h4>
          <div className="grid grid-cols-4 gap-4">
            {presetTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => template.preview && handleSelectPresetTemplate(template.id, template.preview)}
                className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all bg-gray-100 dark:bg-background-secondary flex items-center justify-center relative ${
                  selectedPresetTemplateId === template.id
                    ? 'border-banana-500 ring-2 ring-banana-200'
                    : 'border-gray-200 dark:border-border-primary hover:border-banana-500'
                }`}
              >
                {template.preview ? (
                  <>
                    <img
                      src={template.thumb || template.preview}
                      alt={t(template.nameKey)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {selectedPresetTemplateId === template.id && (
                      <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                        <span className="text-white font-semibold text-sm">{t('template.templateSelected')}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-foreground-tertiary">{t(template.nameKey)}</span>
                )}
              </div>
            ))}

            <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 dark:border-border-primary hover:border-banana-500 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden">
              <span className="text-2xl">+</span>
              <span className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('template.uploadTemplate')}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleTemplateUpload}
                className="hidden"
                disabled={isLoadingTemplates}
              />
            </label>
          </div>
          
          {!showUpload && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 text-banana-500 border-gray-300 dark:border-border-primary rounded focus:ring-banana-500"
                />
                <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                  {t('template.saveToLibraryOnUpload')}
                </span>
              </label>
            </div>
          )}
        </div>

        {projectId && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">{t('template.selectFromMaterials')}</h4>
            <Button
              variant="secondary"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={() => setIsMaterialSelectorOpen(true)}
              className="w-full"
            >
              {t('template.selectAsTemplate')}
            </Button>
          </div>
        )}
      </div>
      <ToastContainer />
      {projectId && (
        <MaterialSelector
          projectId={projectId}
          isOpen={isMaterialSelectorOpen}
          onClose={() => setIsMaterialSelectorOpen(false)}
          onSelect={handleSelectMaterials}
          multiple={false}
          showSaveAsTemplateOption={true}
        />
      )}
    </>
  );
};

export const getTemplateFile = async (
  templateId: string,
  userTemplates: UserTemplate[]
): Promise<File | null> => {
  const presetTemplates = [
    { id: '1', preview: '/templates/template_y.png' },
    { id: '2', preview: '/templates/template_vector_illustration.png' },
    { id: '3', preview: '/templates/template_glass.png' },
  ];

  const presetTemplate = presetTemplates.find(t => t.id === templateId);
  if (presetTemplate && presetTemplate.preview) {
    try {
      const response = await fetch(presetTemplate.preview);
      const blob = await response.blob();
      return new File([blob], presetTemplate.preview.split('/').pop() || 'template.png', { type: blob.type });
    } catch (error) {
      console.error('Failed to load preset template:', error);
      return null;
    }
  }

  const userTemplate = userTemplates.find(t => t.template_id === templateId);
  if (userTemplate) {
    try {
      const imageUrl = getImageUrl(userTemplate.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], 'template.png', { type: blob.type });
    } catch (error) {
      console.error('Failed to load user template:', error);
      return null;
    }
  }

  return null;
};
