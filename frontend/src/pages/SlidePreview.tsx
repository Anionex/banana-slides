// TODO: split components
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import { devLog } from '@/utils/logger';

// 组件内翻译
const previewI18n = {
  zh: {
    home: { title: '蕉幻' },
    nav: { home: '主页', materialGenerate: '素材生成' },
    slidePreview: {
      pageGenerating: "该页面正在生成中，请稍候...", generationStarted: "已开始生成图片，请稍候...",
      versionSwitched: "已切换到该版本", outlineSaved: "大纲和描述已保存",
      materialsAdded: "已添加 {{count}} 个素材", exportStarted: "导出任务已开始，可在导出任务面板查看进度",
      cannotRefresh: "无法刷新：缺少项目ID", refreshSuccess: "刷新成功",
      extraRequirementsSaved: "额外要求已保存", styleDescSaved: "风格描述已保存",
      exportSettingsSaved: "导出设置已保存", aspectRatioSaved: "画面比例已保存", loadTemplateFailed: "加载模板失败", templateChanged: "模板更换成功",
      saveFailed: "保存失败: {{error}}", refreshFailed: "刷新失败，请稍后重试",
      loadMaterialFailed: "加载素材失败: {{error}}", templateChangeFailed: "更换模板失败: {{error}}",
      versionSwitchFailed: "切换失败: {{error}}", unknownError: "未知错误",
      regionCropSuccess: "已将选中区域添加为参考图片，可在下方\"上传图片\"中查看与删除",
      regionCropFailed: "无法从当前图片裁剪区域（浏览器安全限制）。可以尝试手动上传参考图片。"
    },
    preview: {
      title: "预览", pageCount: "共 {{count}} 页", export: "导出",
      exportPptx: "导出为 PPTX", exportPdf: "导出为 PDF",
      exportEditablePptx: "导出可编辑 PPTX（Beta）", exportImages: "导出为图片",
      exportSelectedPages: "将导出选中的 {{count}} 页",
      regenerate: "重新生成", regenerating: "生成中...",
      editMode: "编辑模式", viewMode: "查看模式", page: "第 {{num}} 页",
      projectSettings: "项目设置", changeTemplate: "更换模板", refresh: "刷新",
      batchGenerate: "批量生成图片 ({{count}})", generateSelected: "生成选中页面 ({{count}})",
      multiSelect: "多选", cancelMultiSelect: "取消多选", pagesUnit: "页",
      noPages: "还没有页面", noPagesHint: "请先返回编辑页面添加内容", backToEdit: "返回编辑",
      generating: "正在生成中...", notGenerated: "尚未生成图片", generateThisPage: "生成此页",
      prevPage: "上一页", nextPage: "下一页", historyVersions: "历史版本",
      versions: "版本", version: "版本", current: "当前", editPage: "编辑页面",
      regionSelect: "区域选图", endRegionSelect: "结束区域选图",
      pageOutline: "页面大纲（可编辑）", pageDescription: "页面描述（可编辑）",
      enterTitle: "输入页面标题", pointsPerLine: "要点（每行一个）",
      enterPointsPerLine: "每行输入一个要点", enterDescription: "输入页面的详细描述内容",
      selectContextImages: "选择上下文图片（可选）", useTemplateImage: "使用模板图片",
      imagesInDescription: "描述中的图片", uploadImages: "上传图片",
      selectFromMaterials: "从素材库选择", upload: "上传",
      editPromptLabel: "输入修改指令(将自动添加页面描述)",
      editPromptPlaceholder: "例如：将框选区域内的素材移除、把背景改成蓝色、增大标题字号、更改文本框样式为虚线...",
      saveOutlineOnly: "仅保存大纲/描述", generateImage: "生成图片",
      templateModalDesc: "选择一个新的模板将应用到后续PPT页面生成（不影响已经生成的页面）。你可以选择预设模板、已有模板或上传新模板。",
      useTextStyle: "使用文字描述风格",
      applyStyle: "应用风格",
      styleSaved: "风格描述已保存",
      uploadingTemplate: "正在上传模板...",
      resolution1KWarning: "1K分辨率警告",
      resolution1KWarningText: "当前使用 1K 分辨率 生成图片，可能导致渲染的文字乱码或模糊。",
      resolution1KWarningHint: "建议在「项目设置 → 全局设置」中切换到 2K 或 4K 分辨率以获得更清晰的效果。",
      dontShowAgain: "不再提示", generateAnyway: "仍然生成",
      confirmRegenerateSelected: "将重新生成选中的 {{count}} 页（历史记录将会保存），确定继续吗？",
      confirmRegenerateAll: "将重新生成所有页面（历史记录将会保存），确定继续吗？",
      confirmRegenerateTitle: "确认重新生成",
      generationFailed: "生成失败",
      disabledExportTip: "还有 {{count}} 页未生成图片，请先生成所有页面图片",
      disabledEditTip: "请先生成该页图片",
      messages: {
        exportSuccess: "导出成功", exportFailed: "导出失败",
        regenerateSuccess: "重新生成完成", regenerateFailed: "重新生成失败",
        loadingProject: "加载项目中...", processing: "处理中...",
        generatingBackgrounds: "正在生成干净背景...", creatingPdf: "正在创建PDF...",
        parsingContent: "正在解析内容...", creatingPptx: "正在创建可编辑PPTX...", complete: "完成！"
      }
    },
    outline: {
      titleLabel: "标题",
      keyPoints: "要点"
    }
  },
  en: {
    home: { title: 'Banana Slides' },
    nav: { home: 'Home', materialGenerate: 'Generate Material' },
    slidePreview: {
      pageGenerating: "This page is generating, please wait...", generationStarted: "Image generation started, please wait...",
      versionSwitched: "Switched to this version", outlineSaved: "Outline and description saved",
      materialsAdded: "Added {{count}} material(s)", exportStarted: "Export task started, check progress in export tasks panel",
      cannotRefresh: "Cannot refresh: Missing project ID", refreshSuccess: "Refresh successful",
      extraRequirementsSaved: "Extra requirements saved", styleDescSaved: "Style description saved",
      exportSettingsSaved: "Export settings saved", aspectRatioSaved: "Aspect ratio saved", loadTemplateFailed: "Failed to load template", templateChanged: "Template changed successfully",
      saveFailed: "Save failed: {{error}}", refreshFailed: "Refresh failed, please try again later",
      loadMaterialFailed: "Failed to load material: {{error}}", templateChangeFailed: "Failed to change template: {{error}}",
      versionSwitchFailed: "Switch failed: {{error}}", unknownError: "Unknown error",
      regionCropSuccess: "Selected region added as reference image. You can view and delete it in \"Upload Images\" below.",
      regionCropFailed: "Cannot crop from current image (browser security restriction). Try uploading a reference image manually."
    },
    preview: {
      title: "Preview", pageCount: "{{count}} pages", export: "Export",
      exportPptx: "Export as PPTX", exportPdf: "Export as PDF",
      exportEditablePptx: "Export Editable PPTX (Beta)", exportImages: "Export as Images",
      exportSelectedPages: "Will export {{count}} selected page(s)",
      regenerate: "Regenerate", regenerating: "Generating...",
      editMode: "Edit Mode", viewMode: "View Mode", page: "Page {{num}}",
      projectSettings: "Project Settings", changeTemplate: "Change Template", refresh: "Refresh",
      batchGenerate: "Batch Generate Images ({{count}})", generateSelected: "Generate Selected ({{count}})",
      multiSelect: "Multi-select", cancelMultiSelect: "Cancel Multi-select", pagesUnit: " pages",
      noPages: "No pages yet", noPagesHint: "Please go back to editor to add content first", backToEdit: "Back to Editor",
      generating: "Generating...", notGenerated: "Image not generated yet", generateThisPage: "Generate This Page",
      prevPage: "Previous", nextPage: "Next", historyVersions: "History Versions",
      versions: "Versions", version: "Version", current: "Current", editPage: "Edit Page",
      regionSelect: "Region Select", endRegionSelect: "End Region Select",
      pageOutline: "Page Outline (Editable)", pageDescription: "Page Description (Editable)",
      enterTitle: "Enter page title", pointsPerLine: "Key Points (one per line)",
      enterPointsPerLine: "Enter one key point per line", enterDescription: "Enter detailed page description",
      selectContextImages: "Select Context Images (Optional)", useTemplateImage: "Use Template Image",
      imagesInDescription: "Images in Description", uploadImages: "Upload Images",
      selectFromMaterials: "Select from Materials", upload: "Upload",
      editPromptLabel: "Enter edit instructions (page description will be auto-added)",
      editPromptPlaceholder: "e.g., Remove elements in selected area, change background to blue, increase title font size, change text box style to dashed...",
      saveOutlineOnly: "Save Outline/Description Only", generateImage: "Generate Image",
      templateModalDesc: "Selecting a new template will apply to future PPT page generation (won't affect already generated pages). You can choose preset templates, existing templates, or upload a new one.",
      useTextStyle: "Use text description for style",
      applyStyle: "Apply Style",
      styleSaved: "Style description saved",
      uploadingTemplate: "Uploading template...",
      resolution1KWarning: "1K Resolution Warning",
      resolution1KWarningText: "Currently using 1K resolution for image generation, which may cause garbled or blurry text.",
      resolution1KWarningHint: "It's recommended to switch to 2K or 4K resolution in \"Project Settings → Global Settings\" for clearer results.",
      dontShowAgain: "Don't show again", generateAnyway: "Generate Anyway",
      confirmRegenerateSelected: "Will regenerate {{count}} selected page(s) (history will be saved). Continue?",
      confirmRegenerateAll: "Will regenerate all pages (history will be saved). Continue?",
      confirmRegenerateTitle: "Confirm Regenerate",
      generationFailed: "Generation failed",
      disabledExportTip: "{{count}} page(s) have no images yet. Please generate all page images first",
      disabledEditTip: "Please generate this page's image first",
      messages: {
        exportSuccess: "Export successful", exportFailed: "Export failed",
        regenerateSuccess: "Regeneration complete", regenerateFailed: "Failed to regenerate",
        loadingProject: "Loading project...", processing: "Processing...",
        generatingBackgrounds: "Generating clean backgrounds...", creatingPdf: "Creating PDF...",
        parsingContent: "Parsing content...", creatingPptx: "Creating editable PPTX...", complete: "Complete!"
      }
    },
    outline: {
      titleLabel: "Title",
      keyPoints: "Key Points"
    }
  }
};
import {
  Home,
  ArrowLeft,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  Image as ImageIcon,
  ImagePlus,
  Settings,
  CheckSquare,
  Square,
  Check,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button, Loading, Modal, Textarea, useToast, useConfirm, MaterialSelector, ProjectSettingsModal, ExportTasksPanel, TextStyleSelector } from '@/components/shared';
import { MaterialGeneratorModal } from '@/components/shared/MaterialGeneratorModal';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { SlideCard } from '@/components/preview/SlideCard';
import { useProjectStore } from '@/store/useProjectStore';
import { useExportTasksStore, type ExportTaskType } from '@/store/useExportTasksStore';
import { getImageUrl } from '@/api/client';
import { getPageImageVersions, setCurrentImageVersion, updateProject, uploadTemplate, exportPPTX as apiExportPPTX, exportPDF as apiExportPDF, exportImages as apiExportImages, exportEditablePPTX as apiExportEditablePPTX, getSettings } from '@/api/endpoints';
import type { ImageVersion, DescriptionContent, ExportExtractorMethod, ExportInpaintMethod, Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';

export const SlidePreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(previewI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    generateImages,
    editPageImage,
    deletePageById,
    updatePageLocal,
    isGlobalLoading,
    taskProgress,
    pageGeneratingTasks,
    warningMessage,
  } = useProjectStore();
  
  const { addTask, pollTask: pollExportTask, tasks: exportTasks, restoreActiveTasks } = useExportTasksStore();

  // 页面挂载时恢复正在进行的导出任务（页面刷新后）
  useEffect(() => {
    restoreActiveTasks();
  }, [restoreActiveTasks]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [useTextStyleMode, setUseTextStyleMode] = useState(false);
  const [draftTemplateStyle, setDraftTemplateStyle] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  // 大纲和描述编辑状态
  const [editOutlineTitle, setEditOutlineTitle] = useState('');
  const [editOutlinePoints, setEditOutlinePoints] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportTasksPanel, setShowExportTasksPanel] = useState(false);
  // 多选导出相关状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imageVersions, setImageVersions] = useState<ImageVersion[]>([]);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [selectedContextImages, setSelectedContextImages] = useState<{
    useTemplate: boolean;
    descImageUrls: string[];
    uploadedFiles: File[];
  }>({
    useTemplate: false,
    descImageUrls: [],
    uploadedFiles: [],
  });
  const [extraRequirements, setExtraRequirements] = useState<string>('');
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const isEditingRequirements = useRef(false); // 跟踪用户是否正在编辑额外要求
  const [templateStyle, setTemplateStyle] = useState<string>('');
  const [isSavingTemplateStyle, setIsSavingTemplateStyle] = useState(false);
  const isEditingTemplateStyle = useRef(false); // 跟踪用户是否正在编辑风格描述
  const lastProjectId = useRef<string | null>(null); // 跟踪上一次的项目ID
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  // 素材生成模态开关（模块本身可复用，这里只是示例入口）
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  // 素材选择器模态开关
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  // 导出设置
  const [exportExtractorMethod, setExportExtractorMethod] = useState<ExportExtractorMethod>(
    (currentProject?.export_extractor_method as ExportExtractorMethod) || 'hybrid'
  );
  const [exportInpaintMethod, setExportInpaintMethod] = useState<ExportInpaintMethod>(
    (currentProject?.export_inpaint_method as ExportInpaintMethod) || 'hybrid'
  );
  const [exportAllowPartial, setExportAllowPartial] = useState<boolean>(
    currentProject?.export_allow_partial || false
  );
  const [isSavingExportSettings, setIsSavingExportSettings] = useState(false);
  // 画面比例
  const [aspectRatio, setAspectRatio] = useState<string>(
    currentProject?.image_aspect_ratio || '16:9'
  );
  const [isSavingAspectRatio, setIsSavingAspectRatio] = useState(false);
  // 根据画面比例计算 CSS aspect-ratio
  const aspectRatioStyle = useMemo(() => {
    const parts = aspectRatio.split(':');
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (w > 0 && h > 0) return `${w}/${h}`;
    }
    return '16/9';
  }, [aspectRatio]);
  // 1K分辨率警告对话框状态
  const [show1KWarningDialog, setShow1KWarningDialog] = useState(false);
  const [skip1KWarningChecked, setSkip1KWarningChecked] = useState(false);
  const [pending1KAction, setPending1KAction] = useState<(() => Promise<void>) | null>(null);
  // 每页编辑参数缓存（前端会话内缓存，便于重复执行）
  const [editContextByPage, setEditContextByPage] = useState<Record<string, {
    prompt: string;
    contextImages: {
      useTemplate: boolean;
      descImageUrls: string[];
      uploadedFiles: File[];
    };
  }>>({});

  // 预览图矩形选择状态（编辑弹窗内）
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isRegionSelectionMode, setIsRegionSelectionMode] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // Memoize pages with generated images to avoid re-computing in multiple places
  const pagesWithImages = useMemo(() => {
    return currentProject?.pages.filter(p => p.id && p.generated_image_path) || [];
  }, [currentProject?.pages]);

  const hasImages = useMemo(
    () => currentProject?.pages?.some(p => p.generated_image_path) ?? false,
    [currentProject?.pages]
  );

  // 加载项目数据 & 用户模板
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    }
    
    // 加载用户模板列表（用于按需获取File）
    const loadTemplates = async () => {
      try {
        const response = await listUserTemplates();
        if (response.data?.templates) {
          setUserTemplates(response.data.templates);
        }
      } catch (error) {
        console.error('Failed to load user templates:', error);
      }
    };
    loadTemplates();
  }, [projectId, currentProject, syncProject]);

  // 监听警告消息
  const lastWarningRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (warningMessage) {
      if (warningMessage !== lastWarningRef.current) {
        lastWarningRef.current = warningMessage;
        show({ message: warningMessage, type: 'warning', duration: 6000 });
      }
    } else {
      // warningMessage 被清空时重置 ref，以便下次能再次显示
      lastWarningRef.current = null;
    }
  }, [warningMessage, show]);

  // 当项目加载后，初始化额外要求和风格描述
  // 只在项目首次加载或项目ID变化时初始化，避免覆盖用户正在输入的内容
  useEffect(() => {
    if (currentProject) {
      // 检查是否是新项目
      const isNewProject = lastProjectId.current !== currentProject.id;
      
      if (isNewProject) {
        // 新项目，初始化额外要求和风格描述
        setExtraRequirements(currentProject.extra_requirements || '');
        setTemplateStyle(currentProject.template_style || '');
        // 初始化导出设置
        setExportExtractorMethod((currentProject.export_extractor_method as ExportExtractorMethod) || 'hybrid');
        setExportInpaintMethod((currentProject.export_inpaint_method as ExportInpaintMethod) || 'hybrid');
        setExportAllowPartial(currentProject.export_allow_partial || false);
        setAspectRatio(currentProject.image_aspect_ratio || '16:9');
        lastProjectId.current = currentProject.id || null;
        isEditingRequirements.current = false;
        isEditingTemplateStyle.current = false;
      } else {
        // 同一项目且用户未在编辑，可以更新（比如从服务器保存后同步回来）
        if (!isEditingRequirements.current) {
          setExtraRequirements(currentProject.extra_requirements || '');
        }
        if (!isEditingTemplateStyle.current) {
          setTemplateStyle(currentProject.template_style || '');
        }
        // 非文本输入的设置项，始终从服务器同步
        setAspectRatio(currentProject.image_aspect_ratio || '16:9');
        setExportExtractorMethod((currentProject.export_extractor_method as ExportExtractorMethod) || 'hybrid');
        setExportInpaintMethod((currentProject.export_inpaint_method as ExportInpaintMethod) || 'hybrid');
        setExportAllowPartial(currentProject.export_allow_partial || false);
      }
      // 如果用户正在编辑，则不更新本地状态
    }
  }, [currentProject?.id, currentProject?.extra_requirements, currentProject?.template_style, currentProject?.image_aspect_ratio, currentProject?.export_extractor_method, currentProject?.export_inpaint_method, currentProject?.export_allow_partial]);

  // 加载当前页面的历史版本
  useEffect(() => {
    const loadVersions = async () => {
      if (!currentProject || !projectId || selectedIndex < 0 || selectedIndex >= currentProject.pages.length) {
        setImageVersions([]);
        setShowVersionMenu(false);
        return;
      }

      const page = currentProject.pages[selectedIndex];
      if (!page?.id) {
        setImageVersions([]);
        setShowVersionMenu(false);
        return;
      }

      try {
        const response = await getPageImageVersions(projectId, page.id);
        if (response.data?.versions) {
          setImageVersions(response.data.versions);
        }
      } catch (error) {
        console.error('Failed to load image versions:', error);
        setImageVersions([]);
      }
    };

    loadVersions();
  }, [currentProject, selectedIndex, projectId]);

  // 检查是否需要显示1K分辨率警告
  const checkResolutionAndExecute = useCallback(async (action: () => Promise<void>) => {
    // 检查 localStorage 中是否已跳过警告
    const skipWarning = localStorage.getItem('skip1KResolutionWarning') === 'true';
    if (skipWarning) {
      await action();
      return;
    }

    try {
      const response = await getSettings();
      const resolution = response.data?.image_resolution;

      // 如果是1K分辨率，显示警告对话框
      if (resolution === '1K') {
        setPending1KAction(() => action);
        setSkip1KWarningChecked(false);
        setShow1KWarningDialog(true);
      } else {
        // 不是1K分辨率，直接执行
        await action();
      }
    } catch (error) {
      console.error('获取设置失败:', error);
      // 获取设置失败时，直接执行（不阻塞用户）
      await action();
    }
  }, []);

  // 确认1K分辨率警告后执行
  const handleConfirm1KWarning = useCallback(async () => {
    // 如果勾选了"不再提示"，保存到 localStorage
    if (skip1KWarningChecked) {
      localStorage.setItem('skip1KResolutionWarning', 'true');
    }

    setShow1KWarningDialog(false);

    // 执行待处理的操作
    if (pending1KAction) {
      await pending1KAction();
      setPending1KAction(null);
    }
  }, [skip1KWarningChecked, pending1KAction]);

  // 取消1K分辨率警告
  const handleCancel1KWarning = useCallback(() => {
    setShow1KWarningDialog(false);
    setPending1KAction(null);
  }, []);

  const handleGenerateAll = async () => {
    // 先检查分辨率，如果是1K则显示警告
    await checkResolutionAndExecute(async () => {
      const pageIds = getSelectedPageIdsForExport();
      const isPartialGenerate = isMultiSelectMode && selectedPageIds.size > 0;

      // 检查要生成的页面中是否有已有图片的
      const pagesToGenerate = isPartialGenerate
        ? currentProject?.pages.filter(p => p.id && selectedPageIds.has(p.id))
        : currentProject?.pages;
      const hasImages = pagesToGenerate?.some((p) => p.generated_image_path);

      const executeGenerate = async () => {
        try {
          await generateImages(pageIds);
        } catch (error: any) {
          console.error('批量生成错误:', error);
          console.error('错误响应:', error?.response?.data);

          // 提取后端返回的更具体错误信息
          let errorMessage = t('preview.generationFailed');
          const respData = error?.response?.data;

          if (respData) {
            if (respData.error?.message) {
              errorMessage = respData.error.message;
            } else if (respData.message) {
              errorMessage = respData.message;
            } else if (respData.error) {
              errorMessage =
                typeof respData.error === 'string'
                  ? respData.error
                  : respData.error.message || errorMessage;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          devLog('提取的错误消息:', errorMessage);

          // 使用统一的错误消息规范化函数
          errorMessage = normalizeErrorMessage(errorMessage);

          devLog('规范化后的错误消息:', errorMessage);

          show({
            message: errorMessage,
            type: 'error',
          });
        }
      };

      if (hasImages) {
        const message = isPartialGenerate
          ? t('preview.confirmRegenerateSelected', { count: selectedPageIds.size })
          : t('preview.confirmRegenerateAll');
        confirm(
          message,
          executeGenerate,
          { title: t('preview.confirmRegenerateTitle'), variant: 'warning' }
        );
      } else {
        await executeGenerate();
      }
    });
  };

  const handleRegeneratePage = useCallback(async () => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;

    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[page.id]) {
      show({ message: t('slidePreview.pageGenerating'), type: 'info' });
      return;
    }

    // 先检查分辨率，如果是1K则显示警告
    await checkResolutionAndExecute(async () => {
      try {
        // 使用统一的 generateImages，传入单个页面 ID
        await generateImages([page.id!]);
        show({ message: t('slidePreview.generationStarted'), type: 'success' });
      } catch (error: any) {
        // 提取后端返回的更具体错误信息
        let errorMessage = '生成失败';
        const respData = error?.response?.data;

        if (respData) {
          if (respData.error?.message) {
            errorMessage = respData.error.message;
          } else if (respData.message) {
            errorMessage = respData.message;
          } else if (respData.error) {
            errorMessage =
              typeof respData.error === 'string'
                ? respData.error
                : respData.error.message || errorMessage;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        // 使用统一的错误消息规范化函数
        errorMessage = normalizeErrorMessage(errorMessage);

        show({
          message: errorMessage,
          type: 'error',
        });
      }
    });
  }, [currentProject, selectedIndex, pageGeneratingTasks, generateImages, show, checkResolutionAndExecute]);

  const handleSwitchVersion = async (versionId: string) => {
    if (!currentProject || !selectedPage?.id || !projectId) return;
    
    try {
      await setCurrentImageVersion(projectId, selectedPage.id, versionId);
      await syncProject(projectId);
      setShowVersionMenu(false);
      show({ message: t('slidePreview.versionSwitched'), type: 'success' });
    } catch (error: any) {
      show({ 
        message: t('slidePreview.versionSwitchFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error' 
      });
    }
  };

  // 从描述内容中提取图片URL
  const extractImageUrlsFromDescription = (descriptionContent: DescriptionContent | undefined): string[] => {
    if (!descriptionContent) return [];
    
    // 处理两种格式
    let text: string = '';
    if ('text' in descriptionContent) {
      text = descriptionContent.text as string;
    } else if ('text_content' in descriptionContent && Array.isArray(descriptionContent.text_content)) {
      text = descriptionContent.text_content.join('\n');
    }
    
    if (!text) return [];
    
    // 匹配 markdown 图片语法: ![](url) 或 ![alt](url)
    const pattern = /!\[.*?\]\((.*?)\)/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(text)) !== null) {
      const url = match[1]?.trim();
      // 只保留有效的HTTP/HTTPS URL
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        matches.push(url);
      }
    }
    
    return matches;
  };

  const handleEditPage = () => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    const pageId = page?.id;

    setIsOutlineExpanded(false);
    setIsDescriptionExpanded(false);

    // 初始化大纲和描述编辑状态
    setEditOutlineTitle(page?.outline_content?.title || '');
    setEditOutlinePoints(page?.outline_content?.points?.join('\n') || '');
    // 提取描述文本
    const descContent = page?.description_content;
    let descText = '';
    if (descContent) {
      if ('text' in descContent) {
        descText = descContent.text as string;
      } else if ('text_content' in descContent && Array.isArray(descContent.text_content)) {
        descText = descContent.text_content.join('\n');
      }
    }
    setEditDescription(descText);

    if (pageId && editContextByPage[pageId]) {
      // 恢复该页上次编辑的内容和图片选择
      const cached = editContextByPage[pageId];
      setEditPrompt(cached.prompt);
      setSelectedContextImages({
        useTemplate: cached.contextImages.useTemplate,
        descImageUrls: [...cached.contextImages.descImageUrls],
        uploadedFiles: [...cached.contextImages.uploadedFiles],
      });
    } else {
      // 首次编辑该页，使用默认值
      setEditPrompt('');
      setSelectedContextImages({
        useTemplate: false,
        descImageUrls: [],
        uploadedFiles: [],
      });
    }

    // 打开编辑弹窗时，清空上一次的选区和模式
    setIsRegionSelectionMode(false);
    setSelectionStart(null);
    setSelectionRect(null);
    setIsSelectingRegion(false);

    setIsEditModalOpen(true);
  };

  // 保存大纲和描述修改
  const handleSaveOutlineAndDescription = useCallback(() => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page?.id) return;

    const updates: Partial<Page> = {};
    
    // 检查大纲是否有变化
    const originalTitle = page.outline_content?.title || '';
    const originalPoints = page.outline_content?.points?.join('\n') || '';
    if (editOutlineTitle !== originalTitle || editOutlinePoints !== originalPoints) {
      updates.outline_content = {
        title: editOutlineTitle,
        points: editOutlinePoints.split('\n').filter((p) => p.trim()),
      };
    }
    
    // 检查描述是否有变化
    const descContent = page.description_content;
    let originalDesc = '';
    if (descContent) {
      if ('text' in descContent) {
        originalDesc = descContent.text as string;
      } else if ('text_content' in descContent && Array.isArray(descContent.text_content)) {
        originalDesc = descContent.text_content.join('\n');
      }
    }
    if (editDescription !== originalDesc) {
      updates.description_content = {
        text: editDescription,
      } as DescriptionContent;
    }
    
    // 如果有修改，保存更新
    if (Object.keys(updates).length > 0) {
      updatePageLocal(page.id, updates);
      show({ message: t('slidePreview.outlineSaved'), type: 'success' });
    }
  }, [currentProject, selectedIndex, editOutlineTitle, editOutlinePoints, editDescription, updatePageLocal, show]);

  const handleSubmitEdit = useCallback(async () => {
    if (!currentProject || !editPrompt.trim()) return;
    
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;

    // 先保存大纲和描述的修改
    handleSaveOutlineAndDescription();

    // 调用后端编辑接口
    await editPageImage(
      page.id,
      editPrompt,
      {
        useTemplate: selectedContextImages.useTemplate,
        descImageUrls: selectedContextImages.descImageUrls,
        uploadedFiles: selectedContextImages.uploadedFiles.length > 0 
          ? selectedContextImages.uploadedFiles 
          : undefined,
      }
    );

    // 缓存当前页的编辑上下文，便于后续快速重复执行
    setEditContextByPage((prev) => ({
      ...prev,
      [page.id!]: {
        prompt: editPrompt,
        contextImages: {
          useTemplate: selectedContextImages.useTemplate,
          descImageUrls: [...selectedContextImages.descImageUrls],
          uploadedFiles: [...selectedContextImages.uploadedFiles],
        },
      },
    }));

    setIsEditModalOpen(false);
  }, [currentProject, selectedIndex, editPrompt, selectedContextImages, editPageImage, handleSaveOutlineAndDescription]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedContextImages((prev) => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...files],
    }));
  };

  const removeUploadedFile = (index: number) => {
    setSelectedContextImages((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index),
    }));
  };

  // Manage object URLs for uploaded files to prevent memory leaks
  const uploadedFileUrls = useRef<string[]>([]);
  useEffect(() => {
    uploadedFileUrls.current.forEach(url => URL.revokeObjectURL(url));
    uploadedFileUrls.current = selectedContextImages.uploadedFiles.map(file => URL.createObjectURL(file));
  }, [selectedContextImages.uploadedFiles]);
  useEffect(() => {
    return () => {
      uploadedFileUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSelectMaterials = async (materials: Material[]) => {
    try {
      // 将选中的素材转换为File对象并添加到上传列表
      const files = await Promise.all(
        materials.map((material) => materialUrlToFile(material))
      );
      setSelectedContextImages((prev) => ({
        ...prev,
        uploadedFiles: [...prev.uploadedFiles, ...files],
      }));
      show({ message: t('slidePreview.materialsAdded', { count: materials.length }), type: 'success' });
    } catch (error: any) {
      console.error('加载素材失败:', error);
      show({
        message: t('slidePreview.loadMaterialFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error',
      });
    }
  };

  // 编辑弹窗打开时，实时把输入与图片选择写入缓存（前端会话内）
  useEffect(() => {
    if (!isEditModalOpen || !currentProject) return;
    const page = currentProject.pages[selectedIndex];
    const pageId = page?.id;
    if (!pageId) return;

    setEditContextByPage((prev) => ({
      ...prev,
      [pageId]: {
        prompt: editPrompt,
        contextImages: {
          useTemplate: selectedContextImages.useTemplate,
          descImageUrls: [...selectedContextImages.descImageUrls],
          uploadedFiles: [...selectedContextImages.uploadedFiles],
        },
      },
    }));
  }, [isEditModalOpen, currentProject, selectedIndex, editPrompt, selectedContextImages]);

  // ========== 预览图矩形选择相关逻辑（编辑弹窗内） ==========
  const handleSelectionMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRegionSelectionMode || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    setIsSelectingRegion(true);
    setSelectionStart({ x, y });
    setSelectionRect(null);
  };

  const handleSelectionMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRegionSelectionMode || !isSelectingRegion || !selectionStart || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));

    const left = Math.min(selectionStart.x, clampedX);
    const top = Math.min(selectionStart.y, clampedY);
    const width = Math.abs(clampedX - selectionStart.x);
    const height = Math.abs(clampedY - selectionStart.y);

    setSelectionRect({ left, top, width, height });
  };

  const handleSelectionMouseUp = async () => {
    if (!isRegionSelectionMode || !isSelectingRegion || !selectionRect || !imageRef.current) {
      setIsSelectingRegion(false);
      setSelectionStart(null);
      return;
    }

    // 结束拖拽，但保留选中的矩形，直到用户手动退出区域选图模式
    setIsSelectingRegion(false);
    setSelectionStart(null);

    try {
      const img = imageRef.current;
      const { left, top, width, height } = selectionRect;
      if (width < 10 || height < 10) {
        // 选区太小，忽略
        return;
      }

      // 将选区从展示尺寸映射到原始图片尺寸
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const displayWidth = img.clientWidth;
      const displayHeight = img.clientHeight;

      if (!naturalWidth || !naturalHeight || !displayWidth || !displayHeight) return;

      const scaleX = naturalWidth / displayWidth;
      const scaleY = naturalHeight / displayHeight;

      const sx = left * scaleX;
      const sy = top * scaleY;
      const sWidth = width * scaleX;
      const sHeight = height * scaleY;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sWidth));
      canvas.height = Math.max(1, Math.round(sHeight));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        ctx.drawImage(
          img,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `crop-${Date.now()}.png`, { type: 'image/png' });
          // 把选中区域作为额外参考图片加入上传列表
          setSelectedContextImages((prev) => ({
            ...prev,
            uploadedFiles: [...prev.uploadedFiles, file],
          }));
          // 给用户一个明显反馈：选区已作为图片加入下方“上传图片”
          show({
            message: t('slidePreview.regionCropSuccess'),
            type: 'success',
          });
        }, 'image/png');
      } catch (e: any) {
        console.error('裁剪选中区域失败（可能是跨域图片导致 canvas 被污染）:', e);
        show({
          message: t('slidePreview.regionCropFailed'),
          type: 'error',
        });
      }
    } finally {
      // 不清理 selectionRect，让选区在界面上持续显示
    }
  };

  // 多选相关函数
  const togglePageSelection = (pageId: string) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const selectAllPages = () => {
    const allPageIds = pagesWithImages.map(p => p.id!);
    setSelectedPageIds(new Set(allPageIds));
  };

  const deselectAllPages = () => {
    setSelectedPageIds(new Set());
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(prev => {
      if (prev) {
        // 退出多选模式时清空选择
        setSelectedPageIds(new Set());
      }
      return !prev;
    });
  };

  // 获取有图片的选中页面ID列表
  const getSelectedPageIdsForExport = (): string[] | undefined => {
    if (!isMultiSelectMode || selectedPageIds.size === 0) {
      return undefined; // 导出全部
    }
    return Array.from(selectedPageIds);
  };

  const handleExport = async (type: 'pptx' | 'pdf' | 'editable-pptx' | 'images') => {
    setShowExportMenu(false);
    if (!projectId) return;

    const pageIds = getSelectedPageIdsForExport();
    const exportTaskId = `export-${Date.now()}`;

    try {
      if (type === 'pptx' || type === 'pdf' || type === 'images') {
        // Synchronous export - direct download, create completed task directly
        const exportApi = { pptx: apiExportPPTX, pdf: apiExportPDF, images: apiExportImages };
        const response = await exportApi[type](projectId, pageIds);
        const downloadUrl = response.data?.download_url || response.data?.download_url_absolute;
        if (downloadUrl) {
          addTask({
            id: exportTaskId,
            taskId: '',
            projectId,
            type: type as ExportTaskType,
            status: 'COMPLETED',
            downloadUrl,
            pageIds: pageIds,
          });
          window.open(downloadUrl, '_blank');
        }
      } else if (type === 'editable-pptx') {
        // Async export - create processing task and start polling
        addTask({
          id: exportTaskId,
          taskId: '', // Will be updated below
          projectId,
          type: 'editable-pptx',
          status: 'PROCESSING',
          pageIds: pageIds,
        });
        
        show({ message: t('slidePreview.exportStarted'), type: 'success' });
        
        const response = await apiExportEditablePPTX(projectId, undefined, pageIds);
        const taskId = response.data?.task_id;
        
        if (taskId) {
          // Update task with real taskId
          addTask({
            id: exportTaskId,
            taskId,
            projectId,
            type: 'editable-pptx',
            status: 'PROCESSING',
            pageIds: pageIds,
          });
          
          // Start polling in background (non-blocking)
          pollExportTask(exportTaskId, projectId, taskId);
        }
      }
    } catch (error: any) {
      // Update task as failed
      addTask({
        id: exportTaskId,
        taskId: '',
        projectId,
        type: type as ExportTaskType,
        status: 'FAILED',
        errorMessage: normalizeErrorMessage(error.message || t('preview.messages.exportFailed')),
        pageIds: pageIds,
      });
      show({ message: normalizeErrorMessage(error.message || t('preview.messages.exportFailed')), type: 'error' });
    }
  };

  const handleRefresh = useCallback(async () => {
    const targetProjectId = projectId || currentProject?.id;
    if (!targetProjectId) {
      show({ message: t('slidePreview.cannotRefresh'), type: 'error' });
      return;
    }

    setIsRefreshing(true);
    try {
      await syncProject(targetProjectId);
      show({ message: t('slidePreview.refreshSuccess'), type: 'success' });
    } catch (error: any) {
      show({ 
        message: error.message || t('slidePreview.refreshFailed'),
        type: 'error' 
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, currentProject?.id, syncProject, show]);

  const handleSaveExtraRequirements = useCallback(async () => {
    if (!currentProject || !projectId) return;
    
    setIsSavingRequirements(true);
    try {
      await updateProject(projectId, { extra_requirements: extraRequirements || '' });
      // 保存成功后，标记为不在编辑状态，允许同步更新
      isEditingRequirements.current = false;
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.extraRequirementsSaved'), type: 'success' });
    } catch (error: any) {
      show({ 
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error' 
      });
    } finally {
      setIsSavingRequirements(false);
    }
  }, [currentProject, projectId, extraRequirements, syncProject, show]);

  const handleSaveTemplateStyle = useCallback(async () => {
    if (!currentProject || !projectId) return;
    
    setIsSavingTemplateStyle(true);
    try {
      await updateProject(projectId, { template_style: templateStyle || '' });
      // 保存成功后，标记为不在编辑状态，允许同步更新
      isEditingTemplateStyle.current = false;
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.styleDescSaved'), type: 'success' });
    } catch (error: any) {
      show({ 
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error' 
      });
    } finally {
      setIsSavingTemplateStyle(false);
    }
  }, [currentProject, projectId, templateStyle, syncProject, show]);

  const handleSaveExportSettings = useCallback(async () => {
    if (!currentProject || !projectId) return;

    setIsSavingExportSettings(true);
    try {
      await updateProject(projectId, {
        export_extractor_method: exportExtractorMethod,
        export_inpaint_method: exportInpaintMethod,
        export_allow_partial: exportAllowPartial
      });
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.exportSettingsSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingExportSettings(false);
    }
  }, [currentProject, projectId, exportExtractorMethod, exportInpaintMethod, exportAllowPartial, syncProject, show]);

  const handleSaveAspectRatio = useCallback(async () => {
    if (!currentProject || !projectId) return;

    setIsSavingAspectRatio(true);
    try {
      await updateProject(projectId, { image_aspect_ratio: aspectRatio });
      await syncProject(projectId);
      show({ message: t('slidePreview.aspectRatioSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingAspectRatio(false);
    }
  }, [currentProject, projectId, aspectRatio, syncProject, show]);

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    if (!projectId) return;
    
    // 如果有templateId，按需加载File
    let file = templateFile;
    if (templateId && !file) {
      file = await getTemplateFile(templateId, userTemplates);
      if (!file) {
        show({ message: t('slidePreview.loadTemplateFailed'), type: 'error' });
        return;
      }
    }
    
    if (!file) {
      // 如果没有文件也没有 ID，可能是取消选择
      return;
    }
    
    setIsUploadingTemplate(true);
    try {
      await uploadTemplate(projectId, file);
      await syncProject(projectId);
      setIsTemplateModalOpen(false);
      show({ message: t('slidePreview.templateChanged'), type: 'success' });
      
      // 更新选择状态
      if (templateId) {
        // 判断是用户模板还是预设模板（短ID通常是预设模板）
        if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
          setSelectedPresetTemplateId(templateId);
          setSelectedTemplateId(null);
        } else {
          setSelectedTemplateId(templateId);
          setSelectedPresetTemplateId(null);
        }
      }
    } catch (error: any) {
      show({ 
        message: t('slidePreview.templateChangeFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error' 
      });
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  if (!currentProject) {
    return <Loading fullscreen message={t('preview.messages.loadingProject')} />;
  }

  if (isGlobalLoading) {
    // 根据任务进度显示不同的消息
    let loadingMessage = t('preview.messages.processing');
    if (taskProgress && typeof taskProgress === 'object') {
      const progressData = taskProgress as any;
      if (progressData.current_step) {
        // 使用后端提供的当前步骤信息
        const stepMap: Record<string, string> = {
          'Generating clean backgrounds': t('preview.messages.generatingBackgrounds'),
          'Creating PDF': t('preview.messages.creatingPdf'),
          'Parsing with MinerU': t('preview.messages.parsingContent'),
          'Creating editable PPTX': t('preview.messages.creatingPptx'),
          'Complete': t('preview.messages.complete')
        };
        loadingMessage = stepMap[progressData.current_step] || progressData.current_step;
      }
      // 不再显示 "处理中 (X/Y)..." 格式，百分比已在进度条显示
    }
    
    return (
      <Loading
        fullscreen
        message={loadingMessage}
        progress={taskProgress || undefined}
      />
    );
  }

  const selectedPage = currentProject.pages[selectedIndex];
  const imageUrl = selectedPage?.generated_image_path
    ? getImageUrl(selectedPage.generated_image_path, selectedPage.updated_at)
    : '';

  const hasAllImages = currentProject.pages.every(
    (p) => p.generated_image_path
  );
  const missingImageCount = currentProject.pages.filter(p => !p.generated_image_path).length;

  return (
    <div className="h-screen bg-gray-50 dark:bg-background-primary flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-200 dark:border-border-primary flex items-center justify-between px-3 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate('/')}
            className="hidden sm:inline-flex flex-shrink-0"
            >
              <span className="hidden md:inline">{t('nav.home')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                if (fromHistory) {
                  navigate('/history');
                } else {
                  navigate(`/project/${projectId}/detail`);
                }
              }}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
              <span className="text-xl md:text-2xl">🍌</span>
              <span className="text-base md:text-xl font-bold truncate">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden md:inline">|</span>
            <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">{t('preview.title')}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsProjectSettingsOpen(true)}
              className="hidden lg:inline-flex"
            >
              <span className="hidden xl:inline">{t('preview.projectSettings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => { setDraftTemplateStyle(templateStyle); setIsTemplateModalOpen(true); }}
              className="hidden lg:inline-flex"
            >
              <span className="hidden xl:inline">{t('preview.changeTemplate')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsMaterialModalOpen(true)}
              className="hidden lg:inline-flex"
            >
              <span className="hidden xl:inline">{t('nav.materialGenerate')}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/detail`)}
              className="hidden sm:inline-flex"
            >
              <span className="hidden md:inline">{t('common.previous')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} className={`md:w-[18px] md:h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hidden md:inline-flex"
            >
              <span className="hidden lg:inline">{t('preview.refresh')}</span>
            </Button>
          
          {/* 导出任务按钮 */}
          {exportTasks.filter(t => t.projectId === projectId).length > 0 && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowExportTasksPanel(!showExportTasksPanel);
                  setShowExportMenu(false);
                }}
                className="relative"
              >
                {exportTasks.filter(t => t.projectId === projectId && (t.status === 'PROCESSING' || t.status === 'RUNNING' || t.status === 'PENDING')).length > 0 ? (
                  <Loader2 size={16} className="animate-spin text-banana-500" />
                ) : (
                  <FileText size={16} />
                )}
                <span className="ml-1 text-xs">
                  {exportTasks.filter(t => t.projectId === projectId).length}
                </span>
              </Button>
              {showExportTasksPanel && (
                <div className="absolute right-0 mt-2 z-20">
                  <ExportTasksPanel 
                    projectId={projectId} 
                    pages={currentProject?.pages || []}
                    className="w-96 max-h-[28rem] shadow-lg" 
                  />
                </div>
              )}
            </div>
          )}
          
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowExportTasksPanel(false);
              }}
              disabled={isMultiSelectMode ? selectedPageIds.size === 0 : !hasAllImages}
              title={!isMultiSelectMode && !hasAllImages ? t('preview.disabledExportTip', { count: missingImageCount }) : undefined}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">
                {isMultiSelectMode && selectedPageIds.size > 0 
                  ? `${t('preview.export')} (${selectedPageIds.size})` 
                  : t('preview.export')}
              </span>
              <span className="sm:hidden">
                {isMultiSelectMode && selectedPageIds.size > 0 
                  ? `(${selectedPageIds.size})` 
                  : t('preview.export')}
              </span>
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary py-2 z-10">
                {isMultiSelectMode && selectedPageIds.size > 0 && (
                  <div className="px-4 py-2 text-xs text-gray-500 dark:text-foreground-tertiary border-b border-gray-100 dark:border-border-primary">
                    {t('preview.exportSelectedPages', { count: selectedPageIds.size })}
                  </div>
                )}
                <button
                  onClick={() => handleExport('pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm"
                >
                  {t('preview.exportPptx')}
                </button>
                <button
                  onClick={() => handleExport('editable-pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm"
                >
                  {t('preview.exportEditablePptx')}
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm"
                >
                  {t('preview.exportPdf')}
                </button>
                <button
                  onClick={() => handleExport('images')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm"
                >
                  {t('preview.exportImages')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 min-h-0">
        {/* 左侧：缩略图列表 */}
        <aside className="w-full md:w-80 bg-white dark:bg-background-secondary border-b md:border-b-0 md:border-r border-gray-200 dark:border-border-primary flex flex-col flex-shrink-0">
          <div className="p-3 md:p-4 border-b border-gray-200 dark:border-border-primary flex-shrink-0 space-y-2 md:space-y-3">
            <Button
              variant="primary"
              icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleGenerateAll}
              className="w-full text-sm md:text-base"
              disabled={isMultiSelectMode && selectedPageIds.size === 0}
            >
              {isMultiSelectMode && selectedPageIds.size > 0
                ? t('preview.generateSelected', { count: selectedPageIds.size })
                : t('preview.batchGenerate', { count: currentProject.pages.length })}
            </Button>
          </div>
          
          {/* 缩略图列表：桌面端垂直，移动端横向滚动 */}
          <div className="flex-1 overflow-y-auto md:overflow-y-auto overflow-x-auto md:overflow-x-visible p-3 md:p-4 min-h-0">
            {/* 多选模式切换 - 紧凑布局 */}
            <div className="flex items-center gap-2 text-xs mb-3">
              <button
                onClick={toggleMultiSelectMode}
                className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  isMultiSelectMode 
                    ? 'bg-banana-100 text-banana-700 hover:bg-banana-200' 
                    : 'text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover'
                }`}
              >
                {isMultiSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{isMultiSelectMode ? t('preview.cancelMultiSelect') : t('preview.multiSelect')}</span>
              </button>
              {isMultiSelectMode && (
                <>
                  <button
                    onClick={selectedPageIds.size === pagesWithImages.length ? deselectAllPages : selectAllPages}
                    className="text-gray-500 dark:text-foreground-tertiary hover:text-banana-600 transition-colors"
                  >
                    {selectedPageIds.size === pagesWithImages.length ? t('common.deselectAll') : t('common.selectAll')}
                  </button>
                  {selectedPageIds.size > 0 && (
                    <span className="text-banana-600 font-medium">
                      ({selectedPageIds.size}{t('preview.pagesUnit')})
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex md:flex-col gap-2 md:gap-4 min-w-max md:min-w-0">
              {currentProject.pages.map((page, index) => (
                <div key={page.id} className="md:w-full flex-shrink-0 relative">
                  {/* 移动端：简化缩略图 */}
                  <div className="md:hidden relative">
                    <button
                      onClick={() => {
                        if (isMultiSelectMode && page.id && page.generated_image_path) {
                          togglePageSelection(page.id);
                        } else {
                          setSelectedIndex(index);
                        }
                      }}
                      className={`w-20 h-14 rounded border-2 transition-all ${
                        selectedIndex === index
                          ? 'border-banana-500 shadow-md'
                          : 'border-gray-200 dark:border-border-primary'
                      } ${isMultiSelectMode && page.id && selectedPageIds.has(page.id) ? 'ring-2 ring-banana-400' : ''}`}
                    >
                      {page.generated_image_path ? (
                        <img
                          src={getImageUrl(page.generated_image_path, page.updated_at)}
                          alt={`Slide ${index + 1}`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-background-secondary rounded flex items-center justify-center text-xs text-gray-400">
                          {index + 1}
                        </div>
                      )}
                    </button>
                    {/* 多选复选框（移动端） */}
                    {isMultiSelectMode && page.id && page.generated_image_path && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePageSelection(page.id!);
                        }}
                        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          selectedPageIds.has(page.id)
                            ? 'bg-banana-500 text-white'
                            : 'bg-white dark:bg-background-secondary border-2 border-gray-300 dark:border-border-primary'
                        }`}
                      >
                        {selectedPageIds.has(page.id) && <Check size={12} />}
                      </button>
                    )}
                  </div>
                  {/* 桌面端：完整卡片 */}
                  <div className="hidden md:block relative">
                    {/* 多选复选框（桌面端） */}
                    {isMultiSelectMode && page.id && page.generated_image_path && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePageSelection(page.id!);
                        }}
                        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center transition-all ${
                          selectedPageIds.has(page.id)
                            ? 'bg-banana-500 text-white shadow-md'
                            : 'bg-white/90 border-2 border-gray-300 dark:border-border-primary hover:border-banana-400'
                        }`}
                      >
                        {selectedPageIds.has(page.id) && <Check size={14} />}
                      </button>
                    )}
                    <SlideCard
                      page={page}
                      index={index}
                      isSelected={selectedIndex === index}
                      onClick={() => {
                        if (isMultiSelectMode && page.id && page.generated_image_path) {
                          togglePageSelection(page.id);
                        } else {
                          setSelectedIndex(index);
                        }
                      }}
                      onEdit={() => {
                        setSelectedIndex(index);
                        handleEditPage();
                      }}
                      onDelete={() => page.id && deletePageById(page.id)}
                      isGenerating={page.id ? !!pageGeneratingTasks[page.id] : false}
                      aspectRatio={aspectRatio}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 右侧：大图预览 */}
        <main className="flex-1 flex flex-col bg-gradient-to-br from-banana-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary min-w-0 overflow-hidden">
          {currentProject.pages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center overflow-y-auto">
              <div className="text-center">
                <div className="text-4xl md:text-6xl mb-4">📊</div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
                  {t('preview.noPages')}
                </h3>
                <p className="text-sm md:text-base text-gray-500 dark:text-foreground-tertiary mb-6">
                  {t('preview.noPagesHint')}
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/project/${projectId}/outline`)}
                  className="text-sm md:text-base"
                >
                  {t('preview.backToEdit')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 预览区 */}
              <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-4 md:p-8">
                <div className="max-w-5xl w-full">
                  <div className="relative bg-white dark:bg-background-secondary rounded-lg shadow-xl overflow-hidden touch-manipulation" style={{ aspectRatio: aspectRatioStyle }}>
                    {selectedPage?.generated_image_path ? (
                      <img
                        src={imageUrl}
                        alt={`Slide ${selectedIndex + 1}`}
                        className="w-full h-full object-cover select-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-background-secondary">
                        <div className="text-center">
                          <div className="text-6xl mb-4">🍌</div>
                          <p className="text-gray-500 dark:text-foreground-tertiary mb-4">
                            {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                              ? t('preview.generating')
                              : selectedPage?.status === 'GENERATING'
                              ? t('preview.generating')
                              : t('preview.notGenerated')}
                          </p>
                          {(!selectedPage?.id || !pageGeneratingTasks[selectedPage.id]) && 
                           selectedPage?.status !== 'GENERATING' && (
                            <Button
                              variant="primary"
                              onClick={handleRegeneratePage}
                            >
                              {t('preview.generateThisPage')}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 控制栏 */}
              <div className="bg-white dark:bg-background-secondary border-t border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
                  {/* 导航 */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />}
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                      className="text-xs md:text-sm"
                    >
                      <span className="hidden sm:inline">{t('preview.prevPage')}</span>
                      <span className="sm:hidden">{t('preview.prevPage')}</span>
                    </Button>
                    <span className="px-2 md:px-4 text-xs md:text-sm text-gray-600 dark:text-foreground-tertiary whitespace-nowrap">
                      {selectedIndex + 1} / {currentProject.pages.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />}
                      onClick={() =>
                        setSelectedIndex(
                          Math.min(currentProject.pages.length - 1, selectedIndex + 1)
                        )
                      }
                      disabled={selectedIndex === currentProject.pages.length - 1}
                      className="text-xs md:text-sm"
                    >
                      <span className="hidden sm:inline">{t('preview.nextPage')}</span>
                      <span className="sm:hidden">{t('preview.nextPage')}</span>
                    </Button>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1.5 md:gap-2 w-full sm:w-auto justify-center">
                    {/* 手机端：模板更换按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Upload size={16} />}
                      onClick={() => { setDraftTemplateStyle(templateStyle); setIsTemplateModalOpen(true); }}
                      className="lg:hidden text-xs"
                      title={t('preview.changeTemplate')}
                    />
                    {/* 手机端：素材生成按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ImagePlus size={16} />}
                      onClick={() => setIsMaterialModalOpen(true)}
                      className="lg:hidden text-xs"
                      title={t('nav.materialGenerate')}
                    />
                    {/* 手机端：刷新按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />}
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="md:hidden text-xs"
                      title={t('preview.refresh')}
                    />
                    {imageVersions.length > 1 && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowVersionMenu(!showVersionMenu)}
                          className="text-xs md:text-sm"
                        >
                          <span className="hidden md:inline">{t('preview.historyVersions')} ({imageVersions.length})</span>
                          <span className="md:hidden">{t('preview.versions')}</span>
                        </Button>
                        {showVersionMenu && (
                          <div className="absolute right-0 bottom-full mb-2 w-56 md:w-64 bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary py-2 z-20 max-h-96 overflow-y-auto">
                            {imageVersions.map((version) => (
                              <button
                                key={version.version_id}
                                onClick={() => handleSwitchVersion(version.version_id)}
                                className={`w-full px-3 md:px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors flex items-center justify-between text-xs md:text-sm ${
                                  version.is_current ? 'bg-banana-50 dark:bg-background-secondary' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>
                                    {t('preview.version')} {version.version_number}
                                  </span>
                                  {version.is_current && (
                                    <span className="text-xs text-banana-600 font-medium">
                                      ({t('preview.current')})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 hidden md:inline">
                                  {version.created_at
                                    ? new Date(version.created_at).toLocaleString('zh-CN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleEditPage}
                      disabled={!selectedPage?.generated_image_path}
                      title={!selectedPage?.generated_image_path ? t('preview.disabledEditTip') : undefined}
                      className="text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePage}
                      disabled={selectedPage?.id && pageGeneratingTasks[selectedPage.id] ? true : false}
                      className="text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                        ? t('preview.regenerating')
                        : t('preview.regenerate')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* 编辑对话框 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('preview.editPage')}
        size="lg"
      >
        <div className="space-y-4">
          {/* 图片（支持矩形区域选择） */}
          <div
            className="bg-gray-100 dark:bg-background-secondary rounded-lg overflow-hidden relative"
            style={{ aspectRatio: aspectRatioStyle }}
            onMouseDown={handleSelectionMouseDown}
            onMouseMove={handleSelectionMouseMove}
            onMouseUp={handleSelectionMouseUp}
            onMouseLeave={handleSelectionMouseUp}
          >
            {imageUrl && (
              <>
                {/* 左上角：区域选图模式开关 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 切换矩形选择模式
                    setIsRegionSelectionMode((prev) => !prev);
                    // 切模式时清空当前选区
                    setSelectionStart(null);
                    setSelectionRect(null);
                    setIsSelectingRegion(false);
                  }}
                  className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-white/80 text-[10px] text-gray-700 dark:text-foreground-secondary hover:bg-banana-50 dark:hover:bg-background-hover shadow-sm dark:shadow-background-primary/30 flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  <span>{isRegionSelectionMode ? t('preview.endRegionSelect') : t('preview.regionSelect')}</span>
                </button>

                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Current slide"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                  crossOrigin="anonymous"
                />
                {selectionRect && (
                  <div
                    className="absolute border-2 border-banana-500 bg-banana-400/10 pointer-events-none"
                    style={{
                      left: selectionRect.left,
                      top: selectionRect.top,
                      width: selectionRect.width,
                      height: selectionRect.height,
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* 大纲内容 - 可编辑 */}
          <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary">
            <button
              onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">{t('preview.pageOutline')}</h4>
              {isOutlineExpanded ? (
                <ChevronUp size={18} className="text-gray-500 dark:text-foreground-tertiary" />
              ) : (
                <ChevronDown size={18} className="text-gray-500 dark:text-foreground-tertiary" />
              )}
            </button>
            {isOutlineExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1">{t('outline.titleLabel')}</label>
                  <input
                    type="text"
                    value={editOutlineTitle}
                    onChange={(e) => setEditOutlineTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500"
                    placeholder={t('preview.enterTitle')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1">{t('preview.pointsPerLine')}</label>
                  <textarea
                    value={editOutlinePoints}
                    onChange={(e) => setEditOutlinePoints(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500 resize-none"
                    placeholder={t('preview.enterPointsPerLine')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 描述内容 - 可编辑 */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">{t('preview.pageDescription')}</h4>
              {isDescriptionExpanded ? (
                <ChevronUp size={18} className="text-gray-500 dark:text-foreground-tertiary" />
              ) : (
                <ChevronDown size={18} className="text-gray-500 dark:text-foreground-tertiary" />
              )}
            </button>
            {isDescriptionExpanded && (
              <div className="px-4 pb-4">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500 resize-none"
                  placeholder={t('preview.enterDescription')}
                />
              </div>
            )}
          </div>

          {/* 上下文图片选择 */}
          <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary mb-3">{t('preview.selectContextImages')}</h4>
            
            {/* Template图片选择 */}
            {currentProject?.template_image_path && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-template"
                  checked={selectedContextImages.useTemplate}
                  onChange={(e) =>
                    setSelectedContextImages((prev) => ({
                      ...prev,
                      useTemplate: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-banana-600 rounded focus:ring-banana-500"
                />
                <label htmlFor="use-template" className="flex items-center gap-2 cursor-pointer">
                  <ImageIcon size={16} className="text-gray-500 dark:text-foreground-tertiary" />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">{t('preview.useTemplateImage')}</span>
                  {currentProject.template_image_path && (
                    <img
                      src={getImageUrl(currentProject.template_image_path, currentProject.updated_at)}
                      alt="Template"
                      className="w-16 h-10 object-cover rounded border border-gray-300 dark:border-border-primary"
                    />
                  )}
                </label>
              </div>
            )}

            {/* Desc中的图片 */}
            {selectedPage?.description_content && (() => {
              const descImageUrls = extractImageUrlsFromDescription(selectedPage.description_content);
              return descImageUrls.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('preview.imagesInDescription')}:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {descImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Desc image ${idx + 1}`}
                          className="w-full h-20 object-cover rounded border-2 border-gray-300 dark:border-border-primary cursor-pointer transition-all"
                          style={{
                            borderColor: selectedContextImages.descImageUrls.includes(url)
                              ? 'var(--banana-yellow)'
                              : 'var(--border-primary)',
                          }}
                          onClick={() => {
                            setSelectedContextImages((prev) => {
                              const isSelected = prev.descImageUrls.includes(url);
                              return {
                                ...prev,
                                descImageUrls: isSelected
                                  ? prev.descImageUrls.filter((u) => u !== url)
                                  : [...prev.descImageUrls, url],
                              };
                            });
                          }}
                        />
                        {selectedContextImages.descImageUrls.includes(url) && (
                          <div className="absolute inset-0 bg-banana-500/20 border-2 border-banana-500 rounded flex items-center justify-center">
                            <div className="w-6 h-6 bg-banana-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* 上传图片 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('preview.uploadImages')}:</label>
                {projectId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ImagePlus size={16} />}
                    onClick={() => setIsMaterialSelectorOpen(true)}
                  >
                    {t('preview.selectFromMaterials')}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedContextImages.uploadedFiles.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={uploadedFileUrls.current[idx] || ''}
                      alt={`Uploaded ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-border-primary"
                    />
                    <button
                      onClick={() => removeUploadedFile(idx)}
                      className="no-min-touch-target absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-border-primary rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500 dark:text-foreground-tertiary">{t('preview.upload')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 编辑框 */}
          <Textarea
            label={t('preview.editPromptLabel')}
            placeholder={t('preview.editPromptPlaceholder')}
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={4}
          />
          <div className="flex justify-between gap-3">
            <Button 
              variant="secondary" 
              onClick={() => {
                handleSaveOutlineAndDescription();
                setIsEditModalOpen(false);
              }}
            >
              {t('preview.saveOutlineOnly')}
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitEdit}
                disabled={!editPrompt.trim()}
              >
                {t('preview.generateImage')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ToastContainer />
      {ConfirmDialog}
      
      {/* 模板选择 Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={t('preview.changeTemplate')}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary mb-4">
            {t('preview.templateModalDesc')}
          </p>
          {/* 图片模板 / 文字风格 切换 */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {t('preview.useTextStyle')}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={useTextStyleMode}
                onChange={(e) => setUseTextStyleMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-banana-300 dark:peer-focus:ring-banana/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-banana"></div>
            </div>
          </label>
          {useTextStyleMode ? (
            <TextStyleSelector
              value={draftTemplateStyle}
              onChange={setDraftTemplateStyle}
              onToast={show}
            />
          ) : (
            <>
              <TemplateSelector
                onSelect={handleTemplateSelect}
                selectedTemplateId={selectedTemplateId}
                selectedPresetTemplateId={selectedPresetTemplateId}
                showUpload={false}
                projectId={projectId || null}
              />
              {isUploadingTemplate && (
                <div className="text-center py-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('preview.uploadingTemplate')}
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {useTextStyleMode && (
              <Button
                variant="primary"
                loading={isSavingTemplateStyle}
                onClick={async () => {
                  isEditingTemplateStyle.current = true;
                  setTemplateStyle(draftTemplateStyle);
                  setIsSavingTemplateStyle(true);
                  try {
                    await updateProject(projectId!, { template_style: draftTemplateStyle || '' });
                    isEditingTemplateStyle.current = false;
                    await syncProject(projectId!);
                    show({ message: t('slidePreview.styleDescSaved'), type: 'success' });
                    setIsTemplateModalOpen(false);
                  } catch (error: any) {
                    show({ message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }), type: 'error' });
                  } finally {
                    setIsSavingTemplateStyle(false);
                  }
                }}
              >
                {t('preview.applyStyle')}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isUploadingTemplate || isSavingTemplateStyle}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>
      {/* 素材生成模态组件（可复用模块，这里只是示例挂载） */}
      {projectId && (
        <>
          <MaterialGeneratorModal
            projectId={projectId}
            isOpen={isMaterialModalOpen}
            onClose={() => setIsMaterialModalOpen(false)}
          />
          {/* 素材选择器 */}
          <MaterialSelector
            projectId={projectId}
            isOpen={isMaterialSelectorOpen}
            onClose={() => setIsMaterialSelectorOpen(false)}
            onSelect={handleSelectMaterials}
            multiple={true}
          />
          {/* 项目设置模态框 */}
          <ProjectSettingsModal
            isOpen={isProjectSettingsOpen}
            onClose={() => setIsProjectSettingsOpen(false)}
            extraRequirements={extraRequirements}
            templateStyle={templateStyle}
            onExtraRequirementsChange={(value) => {
              isEditingRequirements.current = true;
              setExtraRequirements(value);
            }}
            onTemplateStyleChange={(value) => {
              isEditingTemplateStyle.current = true;
              setTemplateStyle(value);
            }}
            onSaveExtraRequirements={handleSaveExtraRequirements}
            onSaveTemplateStyle={handleSaveTemplateStyle}
            isSavingRequirements={isSavingRequirements}
            isSavingTemplateStyle={isSavingTemplateStyle}
            // 导出设置
            exportExtractorMethod={exportExtractorMethod}
            exportInpaintMethod={exportInpaintMethod}
            exportAllowPartial={exportAllowPartial}
            onExportExtractorMethodChange={setExportExtractorMethod}
            onExportInpaintMethodChange={setExportInpaintMethod}
            onExportAllowPartialChange={setExportAllowPartial}
            onSaveExportSettings={handleSaveExportSettings}
            isSavingExportSettings={isSavingExportSettings}
            // 画面比例
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            onSaveAspectRatio={handleSaveAspectRatio}
            isSavingAspectRatio={isSavingAspectRatio}
            hasImages={hasImages}
          />
        </>
      )}

      {/* 1K分辨率警告对话框 */}
      <Modal
        isOpen={show1KWarningDialog}
        onClose={handleCancel1KWarning}
        title={t('preview.resolution1KWarning')}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <p className="text-sm text-amber-800">
                {t('preview.resolution1KWarningText')}
              </p>
              <p className="text-sm text-amber-700 mt-2">
                {t('preview.resolution1KWarningHint')}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skip1KWarningChecked}
              onChange={(e) => setSkip1KWarningChecked(e.target.checked)}
              className="w-4 h-4 text-banana-600 rounded focus:ring-banana-500"
            />
            <span className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('preview.dontShowAgain')}</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleCancel1KWarning}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm1KWarning}>
              {t('preview.generateAnyway')}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

