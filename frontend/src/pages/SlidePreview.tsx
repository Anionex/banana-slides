// TODO: split components
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { Button, Loading, Modal, Textarea, useToast, useConfirm, MaterialSelector, ProjectSettingsModal, ExportTasksPanel } from '@/components/shared';
import { MaterialGeneratorModal } from '@/components/shared/MaterialGeneratorModal';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { SlideCard } from '@/components/preview/SlideCard';
import { useProjectStore } from '@/store/useProjectStore';
import { useExportTasksStore, type ExportTaskType } from '@/store/useExportTasksStore';
import { getImageUrl } from '@/api/client';
import { getPageImageVersions, setCurrentImageVersion, updateProject, uploadTemplate, exportPPTX as apiExportPPTX, exportPDF as apiExportPDF, exportEditablePPTX as apiExportEditablePPTX } from '@/api/endpoints';
import type { ImageVersion, DescriptionContent, ExportExtractorMethod, ExportInpaintMethod, Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';

export const SlidePreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  } = useProjectStore();
  
  const { addTask, pollTask: pollExportTask, tasks: exportTasks, restoreActiveTasks } = useExportTasksStore();

  // 页面挂载时恢复正在进行的导出任务（页面刷新后）
  useEffect(() => {
    restoreActiveTasks();
  }, [restoreActiveTasks]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
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
  const [isSavingExportSettings, setIsSavingExportSettings] = useState(false);
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
        console.error('加载用户模板失败:', error);
      }
    };
    loadTemplates();
  }, [projectId, currentProject, syncProject]);

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
      }
      // 如果用户正在编辑，则不更新本地状态
    }
  }, [currentProject?.id, currentProject?.extra_requirements, currentProject?.template_style]);

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

  const handleGenerateAll = async () => {
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

        console.log('提取的错误消息:', errorMessage);

        // 使用统一的错误消息规范化函数
        errorMessage = normalizeErrorMessage(errorMessage);

        console.log('规范化后的错误消息:', errorMessage);

        show({
          message: errorMessage,
          type: 'error',
        });
      }
    };
    
    if (hasImages) {
      const message = isPartialGenerate
        ? `将重新生成选中的 ${selectedPageIds.size} 页（历史记录将会保存），确定继续吗？`
        : '将重新生成所有页面（历史记录将会保存），确定继续吗？';
      confirm(
        message,
        executeGenerate,
        { title: '确认重新生成', variant: 'warning' }
      );
    } else {
      await executeGenerate();
    }
  };

  const handleRegeneratePage = useCallback(async () => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;
    
    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[page.id]) {
      show({ message: '该页面正在生成中，请稍候...', type: 'info' });
      return;
    }
    
    try {
      // 使用统一的 generateImages，传入单个页面 ID
      await generateImages([page.id]);
      show({ message: '已开始生成图片，请稍候...', type: 'success' });
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
  }, [currentProject, selectedIndex, pageGeneratingTasks, generateImages, show]);

  const handleSwitchVersion = async (versionId: string) => {
    if (!currentProject || !selectedPage?.id || !projectId) return;
    
    try {
      await setCurrentImageVersion(projectId, selectedPage.id, versionId);
      await syncProject(projectId);
      setShowVersionMenu(false);
      show({ message: '已切换到该版本', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `切换失败: ${error.message || '未知错误'}`, 
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
      show({ message: '大纲和描述已保存', type: 'success' });
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
      show({ message: `已添加 ${materials.length} 个素材`, type: 'success' });
    } catch (error: any) {
      console.error('加载素材失败:', error);
      show({
        message: '加载素材失败: ' + (error.message || '未知错误'),
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
            message: '已将选中区域添加为参考图片，可在下方“上传图片”中查看与删除',
            type: 'success',
          });
        }, 'image/png');
      } catch (e: any) {
        console.error('裁剪选中区域失败（可能是跨域图片导致 canvas 被污染）:', e);
        show({
          message: '无法从当前图片裁剪区域（浏览器安全限制）。可以尝试手动上传参考图片。',
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

  const handleExport = async (type: 'pptx' | 'pdf' | 'editable-pptx') => {
    setShowExportMenu(false);
    if (!projectId) return;
    
    const pageIds = getSelectedPageIdsForExport();
    const exportTaskId = `export-${Date.now()}`;
    
    try {
      if (type === 'pptx' || type === 'pdf') {
        // Synchronous export - direct download, create completed task directly
        const response = type === 'pptx' 
          ? await apiExportPPTX(projectId, pageIds)
          : await apiExportPDF(projectId, pageIds);
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
        
        show({ message: '导出任务已开始，可在导出任务面板查看进度', type: 'success' });
        
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
        errorMessage: normalizeErrorMessage(error.message || '导出失败'),
        pageIds: pageIds,
      });
      show({ message: normalizeErrorMessage(error.message || '导出失败'), type: 'error' });
    }
  };

  const handleRefresh = useCallback(async () => {
    const targetProjectId = projectId || currentProject?.id;
    if (!targetProjectId) {
      show({ message: '无法刷新：缺少项目ID', type: 'error' });
      return;
    }

    setIsRefreshing(true);
    try {
      await syncProject(targetProjectId);
      show({ message: '刷新成功', type: 'success' });
    } catch (error: any) {
      show({ 
        message: error.message || '刷新失败，请稍后重试', 
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
      show({ message: '额外要求已保存', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `保存失败: ${error.message || '未知错误'}`, 
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
      show({ message: '风格描述已保存', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `保存失败: ${error.message || '未知错误'}`, 
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
        export_inpaint_method: exportInpaintMethod 
      });
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: '导出设置已保存', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `保存失败: ${error.message || '未知错误'}`, 
        type: 'error' 
      });
    } finally {
      setIsSavingExportSettings(false);
    }
  }, [currentProject, projectId, exportExtractorMethod, exportInpaintMethod, syncProject, show]);

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    if (!projectId) return;
    
    // 如果有templateId，按需加载File
    let file = templateFile;
    if (templateId && !file) {
      file = await getTemplateFile(templateId, userTemplates);
      if (!file) {
        show({ message: '加载模板失败', type: 'error' });
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
      show({ message: '模板更换成功', type: 'success' });
      
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
        message: `更换模板失败: ${error.message || '未知错误'}`, 
        type: 'error' 
      });
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  if (!currentProject) {
    return <Loading fullscreen message="加载项目中..." />;
  }

  if (isGlobalLoading) {
    // 根据任务进度显示不同的消息
    let loadingMessage = "处理中...";
    if (taskProgress && typeof taskProgress === 'object') {
      const progressData = taskProgress as any;
      if (progressData.current_step) {
        // 使用后端提供的当前步骤信息
        const stepMap: Record<string, string> = {
          'Generating clean backgrounds': '正在生成干净背景...',
          'Creating PDF': '正在创建PDF...',
          'Parsing with MinerU': '正在解析内容...',
          'Creating editable PPTX': '正在创建可编辑PPTX...',
          'Complete': '完成！'
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

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="h-14 md:h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate('/')}
            className="hidden sm:inline-flex flex-shrink-0"
          >
            <span className="hidden md:inline">主页</span>
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
            <span className="hidden sm:inline">返回</span>
          </Button>
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
            <span className="text-xl md:text-2xl">🍌</span>
            <span className="text-base md:text-xl font-bold truncate">蕉幻</span>
          </div>
          <span className="text-gray-400 hidden md:inline">|</span>
          <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">预览</span>
        </div>
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => setIsProjectSettingsOpen(true)}
            className="hidden lg:inline-flex"
          >
            <span className="hidden xl:inline">项目设置</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => setIsTemplateModalOpen(true)}
            className="hidden lg:inline-flex"
          >
            <span className="hidden xl:inline">更换模板</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => setIsMaterialModalOpen(true)}
            className="hidden lg:inline-flex"
          >
            <span className="hidden xl:inline">素材生成</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate(`/project/${projectId}/detail`)}
            className="hidden sm:inline-flex"
          >
            <span className="hidden md:inline">上一步</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={16} className={`md:w-[18px] md:h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="hidden md:inline-flex"
          >
            <span className="hidden lg:inline">刷新</span>
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
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">
                {isMultiSelectMode && selectedPageIds.size > 0 
                  ? `导出 (${selectedPageIds.size})` 
                  : '导出'}
              </span>
              <span className="sm:hidden">
                {isMultiSelectMode && selectedPageIds.size > 0 
                  ? `(${selectedPageIds.size})` 
                  : '导出'}
              </span>
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                {isMultiSelectMode && selectedPageIds.size > 0 && (
                  <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                    将导出选中的 {selectedPageIds.size} 页
                  </div>
                )}
                <button
                  onClick={() => handleExport('pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                >
                  导出为 PPTX
                </button>
                <button
                  onClick={() => handleExport('editable-pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                >
                  导出可编辑 PPTX（Beta）
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                >
                  导出为 PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 min-h-0">
        {/* 左侧：缩略图列表 */}
        <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 md:p-4 border-b border-gray-200 flex-shrink-0 space-y-2 md:space-y-3">
            <Button
              variant="primary"
              icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleGenerateAll}
              className="w-full text-sm md:text-base"
              disabled={isMultiSelectMode && selectedPageIds.size === 0}
            >
              {isMultiSelectMode && selectedPageIds.size > 0
                ? `生成选中页面 (${selectedPageIds.size})`
                : `批量生成图片 (${currentProject.pages.length})`}
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
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {isMultiSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{isMultiSelectMode ? '取消多选' : '多选'}</span>
              </button>
              {isMultiSelectMode && (
                <>
                  <button
                    onClick={selectedPageIds.size === pagesWithImages.length ? deselectAllPages : selectAllPages}
                    className="text-gray-500 hover:text-banana-600 transition-colors"
                  >
                    {selectedPageIds.size === pagesWithImages.length ? '取消全选' : '全选'}
                  </button>
                  {selectedPageIds.size > 0 && (
                    <span className="text-banana-600 font-medium">
                      ({selectedPageIds.size}页)
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
                          : 'border-gray-200'
                      } ${isMultiSelectMode && page.id && selectedPageIds.has(page.id) ? 'ring-2 ring-banana-400' : ''}`}
                    >
                      {page.generated_image_path ? (
                        <img
                          src={getImageUrl(page.generated_image_path, page.updated_at)}
                          alt={`Slide ${index + 1}`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
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
                            : 'bg-white border-2 border-gray-300'
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
                            : 'bg-white/90 border-2 border-gray-300 hover:border-banana-400'
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
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 右侧：大图预览 */}
        <main className="flex-1 flex flex-col bg-gradient-to-br from-banana-50 via-white to-gray-50 min-w-0 overflow-hidden">
          {currentProject.pages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center overflow-y-auto">
              <div className="text-center">
                <div className="text-4xl md:text-6xl mb-4">📊</div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">
                  还没有页面
                </h3>
                <p className="text-sm md:text-base text-gray-500 mb-6">
                  请先返回编辑页面添加内容
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/project/${projectId}/outline`)}
                  className="text-sm md:text-base"
                >
                  返回编辑
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 预览区 */}
              <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-4 md:p-8">
                <div className="max-w-5xl w-full">
                  <div className="relative aspect-video bg-white rounded-lg shadow-xl overflow-hidden touch-manipulation">
                    {selectedPage?.generated_image_path ? (
                      <img
                        src={imageUrl}
                        alt={`Slide ${selectedIndex + 1}`}
                        className="w-full h-full object-cover select-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                          <div className="text-6xl mb-4">🍌</div>
                          <p className="text-gray-500 mb-4">
                            {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                              ? '正在生成中...'
                              : selectedPage?.status === 'GENERATING'
                              ? '正在生成中...'
                              : '尚未生成图片'}
                          </p>
                          {(!selectedPage?.id || !pageGeneratingTasks[selectedPage.id]) && 
                           selectedPage?.status !== 'GENERATING' && (
                            <Button
                              variant="primary"
                              onClick={handleRegeneratePage}
                            >
                              生成此页
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 控制栏 */}
              <div className="bg-white border-t border-gray-200 px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
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
                      <span className="hidden sm:inline">上一页</span>
                      <span className="sm:hidden">上一页</span>
                    </Button>
                    <span className="px-2 md:px-4 text-xs md:text-sm text-gray-600 whitespace-nowrap">
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
                      <span className="hidden sm:inline">下一页</span>
                      <span className="sm:hidden">下一页</span>
                    </Button>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1.5 md:gap-2 w-full sm:w-auto justify-center">
                    {/* 手机端：模板更换按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Upload size={16} />}
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="lg:hidden text-xs"
                      title="更换模板"
                    />
                    {/* 手机端：素材生成按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ImagePlus size={16} />}
                      onClick={() => setIsMaterialModalOpen(true)}
                      className="lg:hidden text-xs"
                      title="素材生成"
                    />
                    {/* 手机端：刷新按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />}
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="md:hidden text-xs"
                      title="刷新"
                    />
                    {imageVersions.length > 1 && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowVersionMenu(!showVersionMenu)}
                          className="text-xs md:text-sm"
                        >
                          <span className="hidden md:inline">历史版本 ({imageVersions.length})</span>
                          <span className="md:hidden">版本</span>
                        </Button>
                        {showVersionMenu && (
                          <div className="absolute right-0 bottom-full mb-2 w-56 md:w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 max-h-96 overflow-y-auto">
                            {imageVersions.map((version) => (
                              <button
                                key={version.version_id}
                                onClick={() => handleSwitchVersion(version.version_id)}
                                className={`w-full px-3 md:px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between text-xs md:text-sm ${
                                  version.is_current ? 'bg-banana-50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>
                                    版本 {version.version_number}
                                  </span>
                                  {version.is_current && (
                                    <span className="text-xs text-banana-600 font-medium">
                                      (当前)
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
                      className="text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePage}
                      disabled={selectedPage?.id && pageGeneratingTasks[selectedPage.id] ? true : false}
                      className="text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                        ? '生成中...'
                        : '重新生成'}
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
        title="编辑页面"
        size="lg"
      >
        <div className="space-y-4">
          {/* 图片（支持矩形区域选择） */}
          <div
            className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative"
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
                  className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-white/80 text-[10px] text-gray-700 hover:bg-banana-50 shadow-sm flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  <span>{isRegionSelectionMode ? '结束区域选图' : '区域选图'}</span>
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
          <div className="bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700">页面大纲（可编辑）</h4>
              {isOutlineExpanded ? (
                <ChevronUp size={18} className="text-gray-500" />
              ) : (
                <ChevronDown size={18} className="text-gray-500" />
              )}
            </button>
            {isOutlineExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">标题</label>
                  <input
                    type="text"
                    value={editOutlineTitle}
                    onChange={(e) => setEditOutlineTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500"
                    placeholder="输入页面标题"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">要点（每行一个）</label>
                  <textarea
                    value={editOutlinePoints}
                    onChange={(e) => setEditOutlinePoints(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500 resize-none"
                    placeholder="每行输入一个要点"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 描述内容 - 可编辑 */}
          <div className="bg-blue-50 rounded-lg border border-blue-200">
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700">页面描述（可编辑）</h4>
              {isDescriptionExpanded ? (
                <ChevronUp size={18} className="text-gray-500" />
              ) : (
                <ChevronDown size={18} className="text-gray-500" />
              )}
            </button>
            {isDescriptionExpanded && (
              <div className="px-4 pb-4">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500 resize-none"
                  placeholder="输入页面的详细描述内容"
                />
              </div>
            )}
          </div>

          {/* 上下文图片选择 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">选择上下文图片（可选）</h4>
            
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
                  <ImageIcon size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700">使用模板图片</span>
                  {currentProject.template_image_path && (
                    <img
                      src={getImageUrl(currentProject.template_image_path, currentProject.updated_at)}
                      alt="Template"
                      className="w-16 h-10 object-cover rounded border border-gray-300"
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
                  <label className="text-sm font-medium text-gray-700">描述中的图片：</label>
                  <div className="grid grid-cols-3 gap-2">
                    {descImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Desc image ${idx + 1}`}
                          className="w-full h-20 object-cover rounded border-2 border-gray-300 cursor-pointer transition-all"
                          style={{
                            borderColor: selectedContextImages.descImageUrls.includes(url)
                              ? '#f59e0b'
                              : '#d1d5db',
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
                <label className="text-sm font-medium text-gray-700">上传图片：</label>
                {projectId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ImagePlus size={16} />}
                    onClick={() => setIsMaterialSelectorOpen(true)}
                  >
                    从素材库选择
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedContextImages.uploadedFiles.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Uploaded ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300"
                    />
                    <button
                      onClick={() => removeUploadedFile(idx)}
                      className="no-min-touch-target absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">上传</span>
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
            label="输入修改指令(将自动添加页面描述)"
            placeholder="例如：将框选区域内的素材移除、把背景改成蓝色、增大标题字号、更改文本框样式为虚线..."
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
              仅保存大纲/描述
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitEdit}
                disabled={!editPrompt.trim()}
              >
                生成图片
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
        title="更换模板"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            选择一个新的模板将应用到后续PPT页面生成（不影响已经生成的页面）。你可以选择预设模板、已有模板或上传新模板。
          </p>
          <TemplateSelector
            onSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplateId}
            selectedPresetTemplateId={selectedPresetTemplateId}
            showUpload={false} // 在预览页面上传的模板直接应用到项目，不上传到用户模板库
            projectId={projectId || null}
          />
          {isUploadingTemplate && (
            <div className="text-center py-2 text-sm text-gray-500">
              正在上传模板...
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isUploadingTemplate}
            >
              关闭
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
            onExportExtractorMethodChange={setExportExtractorMethod}
            onExportInpaintMethodChange={setExportInpaintMethod}
            onSaveExportSettings={handleSaveExportSettings}
            isSavingExportSettings={isSavingExportSettings}
          />
        </>
      )}
      
    </div>
  );
};

