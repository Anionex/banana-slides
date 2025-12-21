// TODO: split components
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Button, Loading, Modal, Textarea, useToast, useConfirm, MaterialSelector, Markdown } from '@/components/shared';
import { MaterialGeneratorModal } from '@/components/shared/MaterialGeneratorModal';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate, replacePageImage } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { SlideCard } from '@/components/preview/SlideCard';
import { useProjectStore } from '@/store/useProjectStore';
import { getImageUrl } from '@/api/client';
import { getPageImageVersions, setCurrentImageVersion, updateProject, uploadTemplate } from '@/api/endpoints';
import type { ImageVersion, DescriptionContent } from '@/types';
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
    generatePageImage,
    editPageImage,
    deletePageById,
    reorderPages,
    addNewPage,
    exportPPTX,
    exportPDF,
    isGlobalLoading,
    taskProgress,
    pageGeneratingTasks,
    updatePageLocal,
  } = useProjectStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
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
  const [isExtraRequirementsExpanded, setIsExtraRequirementsExpanded] = useState(false);
  const [pageDescriptionDraft, setPageDescriptionDraft] = useState<string>('');
  const [outlineTitleDraft, setOutlineTitleDraft] = useState<string>('');
  const [outlinePointsDraft, setOutlinePointsDraft] = useState<string>('');
  const isEditingRequirements = useRef(false); // 跟踪用户是否正在编辑额外要求
  const lastProjectId = useRef<string | null>(null); // 跟踪上一次的项目ID
  // 素材生成模态开关（模块本身可复用，这里只是示例入口）
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  // 素材选择器模态开关
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
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
  // 快速替换图片的文件选择器
  const quickReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [isRegionSelectionMode, setIsRegionSelectionMode] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

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

  // 当项目加载后，初始化额外要求
  // 只在项目首次加载或项目ID变化时初始化，避免覆盖用户正在输入的内容
  useEffect(() => {
    if (currentProject) {
      // 检查是否是新项目
      const isNewProject = lastProjectId.current !== currentProject.id;
      
      if (isNewProject) {
        // 新项目，初始化额外要求
        setExtraRequirements(currentProject.extra_requirements || '');
        lastProjectId.current = currentProject.id || null;
        isEditingRequirements.current = false;
      } else if (!isEditingRequirements.current) {
        // 同一项目且用户未在编辑，可以更新（比如从服务器保存后同步回来）
        setExtraRequirements(currentProject.extra_requirements || '');
      }
      // 如果用户正在编辑（isEditingRequirements.current === true），则不更新本地状态
    }
  }, [currentProject?.id, currentProject?.extra_requirements]);

  // 初始化当前页的提示词草稿
  useEffect(() => {
    if (!currentProject || currentProject.pages.length === 0) {
      setPageDescriptionDraft('');
      setOutlineTitleDraft('');
      setOutlinePointsDraft('');
      return;
    }
    const page = currentProject.pages[selectedIndex];
    if (!page) {
      setPageDescriptionDraft('');
      setOutlineTitleDraft('');
      setOutlinePointsDraft('');
      return;
    }
    setPageDescriptionDraft(getDescriptionText(page.description_content));
    setOutlineTitleDraft(page.outline_content?.title || '');
    setOutlinePointsDraft(page.outline_content?.points?.join('\n') || '');
  }, [currentProject, selectedIndex]);

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
    const hasImages = currentProject?.pages.some(
      (p) => p.generated_image_path
    );
    
    const executeGenerate = async () => {
      await generateImages();
    };
    
    if (hasImages) {
      confirm(
        '部分页面已有图片，重新生成将覆盖，确定继续吗？',
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
    
    // 如果已有图片，需要传递 force_regenerate=true
    const hasImage = !!page.generated_image_path;
    
    try {
      await generatePageImage(page.id, hasImage);
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
  }, [currentProject, selectedIndex, pageGeneratingTasks, generatePageImage, show]);

  // 调整当前页面顺序，并保持与大纲 / 描述页一致
  const handleMovePage = useCallback(
    async (direction: 'up' | 'down') => {
      if (!currentProject) return;
      const pages = currentProject.pages;
      const fromIndex = selectedIndex;
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

      if (toIndex < 0 || toIndex >= pages.length) return;

      const reordered = [...pages];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const newOrderIds = reordered
        .map((p) => p.id)
        .filter((id): id is string => !!id);

      await reorderPages(newOrderIds);
      setSelectedIndex(toIndex);
    },
    [currentProject, selectedIndex, reorderPages]
  );

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

  // 从 description_content 提取纯文本，供预览区展示
  const getDescriptionText = (descriptionContent: DescriptionContent | undefined): string => {
    if (!descriptionContent) return '';
    if ('text' in descriptionContent) {
      return descriptionContent.text || '';
    }
    if ('text_content' in descriptionContent && Array.isArray(descriptionContent.text_content)) {
      return descriptionContent.text_content.join('\n');
    }
    return '';
  };

  const handleSubmitEdit = useCallback(async () => {
    if (!currentProject || !editPrompt.trim()) return;
    
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;

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
  }, [currentProject, selectedIndex, editPrompt, selectedContextImages, editPageImage]);

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

  // 快速替换当前页图片：点击大图后从本地选择一张图片，直接覆盖为最终图片（不走AI任务）
  const handlePreviewImageClick = () => {
    if (!selectedPage?.generated_image_path) return;
    if (quickReplaceInputRef.current) {
      quickReplaceInputRef.current.click();
    }
  };

  const handleQuickReplaceInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 允许多次选择同一文件
    e.target.value = '';

    if (!file || !currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;

    try {
      // 直接上传并替换当前页图片，不创建任务、不进入生成中状态
      await replacePageImage(currentProject.id, page.id, file);
      await syncProject(currentProject.id);
      show({ message: '图片已替换', type: 'success' });
    } catch (error: any) {
      show({
        message: '替换图片失败: ' + (error.message || '未知错误'),
        type: 'error',
      });
    }
  };

  // 实时把输入与图片选择写入缓存（前端会话内）
  useEffect(() => {
    if (!currentProject) return;
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
  }, [currentProject, selectedIndex, editPrompt, selectedContextImages]);

  // 当切换页面时，恢复对应的编辑上下文（指令 + 上下文图片）
  useEffect(() => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    const pageId = page?.id;
    if (!pageId) return;

    const cached = editContextByPage[pageId];
    if (cached) {
      setEditPrompt(cached.prompt);
      setSelectedContextImages({
        useTemplate: cached.contextImages.useTemplate,
        descImageUrls: [...cached.contextImages.descImageUrls],
        uploadedFiles: [...cached.contextImages.uploadedFiles],
      });
    } else {
      setEditPrompt('');
      setSelectedContextImages({
        useTemplate: false,
        descImageUrls: [],
        uploadedFiles: [],
      });
    }

    // 仅在切换页面时清空区域选图状态
    setIsRegionSelectionMode(false);
    setSelectionStart(null);
    setSelectionRect(null);
    setIsSelectingRegion(false);
  }, [currentProject?.id, selectedIndex]);

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

  const handleExport = async (type: 'pptx' | 'pdf') => {
    setShowExportMenu(false);
    if (type === 'pptx') {
      await exportPPTX();
    } else {
      await exportPDF();
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

  // 保存当前页描述 / 提示词
  const handleSavePageDescription = useCallback(() => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page?.id) return;

    updatePageLocal(page.id, {
      description_content: {
        text: pageDescriptionDraft || '',
      } as DescriptionContent,
    });

    show({ message: '当前页描述已保存', type: 'success' });
  }, [currentProject, selectedIndex, pageDescriptionDraft, updatePageLocal, show]);

  // 保存当前页大纲
  const handleSavePageOutline = useCallback(() => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page?.id) return;

    const points =
      outlinePointsDraft
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0) || [];

    updatePageLocal(page.id, {
      outline_content: {
        title: outlineTitleDraft || '未命名页面',
        points,
      },
    });

    show({ message: '页面大纲已保存', type: 'success' });
  }, [currentProject, selectedIndex, outlineTitleDraft, outlinePointsDraft, updatePageLocal, show]);

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
    return (
      <Loading
        fullscreen
        message="生成图片中..."
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
            <span className="text-base md:text-xl font-bold truncate">Vibe方案</span>
          </div>
          <span className="text-gray-400 hidden md:inline">|</span>
          <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">预览</span>
        </div>
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
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
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasAllImages}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">导出</span>
              <span className="sm:hidden">导出</span>
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                <button
                  onClick={() => handleExport('pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                >
                  导出为 PPTX
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
            >
              批量生成图片 ({currentProject.pages.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await addNewPage();
                // 新页会追加在末尾，自动选中最后一页
                const total = currentProject.pages.length + 1;
                setSelectedIndex(total - 1);
              }}
              className="w-full text-xs md:text-sm"
            >
              新增页面（与大纲一致）
            </Button>
            
            {/* 额外要求 */}
            <div className="border-t border-gray-200 pt-2 md:pt-3">
              <button
                onClick={() => setIsExtraRequirementsExpanded(!isExtraRequirementsExpanded)}
                className="w-full flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>额外要求</span>
                {isExtraRequirementsExpanded ? (
                  <ChevronUp size={14} className="md:w-4 md:h-4" />
                ) : (
                  <ChevronDown size={14} className="md:w-4 md:h-4" />
                )}
              </button>
              
              {isExtraRequirementsExpanded && (
                <div className="mt-2 md:mt-3 space-y-2">
                  <Textarea
                    value={extraRequirements}
                    onChange={(e) => {
                      // 标记用户正在编辑，防止同步时覆盖
                      isEditingRequirements.current = true;
                      setExtraRequirements(e.target.value);
                    }}
                    placeholder="例如：使用紧凑的布局，顶部展示一级大纲标题，加入更丰富的PPT插图..."
                    rows={2}
                    className="text-xs md:text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveExtraRequirements}
                    disabled={isSavingRequirements}
                    className="w-full text-xs md:text-sm"
                  >
                    {isSavingRequirements ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* 缩略图列表：桌面端垂直，移动端横向滚动 */}
          <div className="flex-1 overflow-y-auto md:overflow-y-auto overflow-x-auto md:overflow-x-visible p-3 md:p-4 min-h-0">
            <div className="flex md:flex-col gap-2 md:gap-4 min-w-max md:min-w-0">
              {currentProject.pages.map((page, index) => (
                <div key={page.id} className="md:w-full flex-shrink-0">
                  {/* 移动端：简化缩略图 */}
                  <button
                    onClick={() => setSelectedIndex(index)}
                    className={`md:hidden w-20 h-14 rounded border-2 transition-all ${
                      selectedIndex === index
                        ? 'border-banana-500 shadow-md'
                        : 'border-gray-200'
                    }`}
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
                  {/* 桌面端：完整卡片 */}
                  <div className="hidden md:block">
                    <SlideCard
                      page={page}
                      index={index}
                      isSelected={selectedIndex === index}
                      onClick={() => setSelectedIndex(index)}
                      onEdit={() => {
                        // 直接切换到对应页面，右侧编辑栏会自动加载上下文
                        setSelectedIndex(index);
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
              {/* 预览区 + 右侧编辑栏 */}
              <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-4 md:p-8">
                <div className="max-w-6xl w-full flex flex-col xl:flex-row gap-4 items-start">
                  {/* 中间：大图 + 文本上下文 */}
                  <div className="flex-1 space-y-4">
                    <div
                      className="relative aspect-video bg-white rounded-lg shadow-xl overflow-hidden touch-manipulation"
                      onMouseDown={handleSelectionMouseDown}
                      onMouseMove={handleSelectionMouseMove}
                      onMouseUp={handleSelectionMouseUp}
                      onMouseLeave={handleSelectionMouseUp}
                    >
                      {selectedPage?.generated_image_path ? (
                        <>
                          <img
                            ref={imageRef}
                            src={imageUrl}
                            alt={`Slide ${selectedIndex + 1}`}
                            className="w-full h-full object-contain select-none"
                            draggable={false}
                            crossOrigin="anonymous"
                            onClick={() => {
                              // 区域选图模式下仅用于框选，不触发上传替换
                              if (isRegionSelectionMode) return;
                              handlePreviewImageClick();
                            }}
                          />
                          {isRegionSelectionMode && (
                            <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-white/85 text-[10px] text-gray-700 shadow-sm">
                              区域选图模式中
                            </div>
                          )}
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
                          {!isRegionSelectionMode && (
                            <div className="pointer-events-none absolute bottom-3 right-3 bg-black/45 text-white text-[11px] md:text-xs px-2 py-1 rounded-md hidden sm:block">
                              点击图片，可上传本地替换
                            </div>
                          )}
                        </>
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
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                              {(!selectedPage?.id || !pageGeneratingTasks[selectedPage.id]) &&
                                selectedPage?.status !== 'GENERATING' && (
                                  <Button variant="primary" onClick={handleRegeneratePage}>
                                    生成此页
                                  </Button>
                                )}
                              <Button
                                variant="secondary"
                                onClick={() => quickReplaceInputRef.current?.click()}
                              >
                                上传本地图片作为此页
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 当前页的文字上下文（大纲 + 描述，可编辑） */}
                    {selectedPage && (
                      <div className="bg-white/90 rounded-lg shadow border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              第 {selectedIndex + 1} 页
                            </span>
                            {selectedPage.part && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                {selectedPage.part}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            文本修改后记得点击保存
                          </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {/* 左侧：大纲编辑 */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-gray-500">页面大纲</h4>
                            <input
                              type="text"
                              value={outlineTitleDraft}
                              onChange={(e) => setOutlineTitleDraft(e.target.value)}
                              placeholder="页面标题"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-banana-500"
                            />
                            <Textarea
                              value={outlinePointsDraft}
                              onChange={(e) => setOutlinePointsDraft(e.target.value)}
                              rows={4}
                              className="text-xs md:text-sm"
                              placeholder="一行一个要点，将作为该页的大纲内容"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleSavePageOutline}
                              className="w-full text-xs md:text-sm"
                            >
                              保存页面大纲
                            </Button>
                          </div>

                          {/* 右侧：描述提示词编辑 */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-gray-500">页面描述 / 提示词</h4>
                            <Textarea
                              value={pageDescriptionDraft}
                              onChange={(e) => setPageDescriptionDraft(e.target.value)}
                              rows={6}
                              className="text-xs md:text-sm h-full"
                              placeholder="这里是这一页的完整提示词，会作为生成或编辑图片的主要文字依据。"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleSavePageDescription}
                              className="w-full text-xs md:text-sm"
                            >
                              保存页面描述
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 右侧：侧边聊天框（编辑栏） */}
                  <div className="w-full xl:w-96 bg-white/95 rounded-lg shadow border border-gray-200 p-4 space-y-4">
                    {/* 上下文图片选择 */}
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">上下文图片（可选）</h3>
                        <Button
                          variant={isRegionSelectionMode ? 'secondary' : 'ghost'}
                          size="sm"
                          icon={<Sparkles size={14} />}
                          onClick={() => {
                            setIsRegionSelectionMode((prev) => !prev);
                            setSelectionStart(null);
                            setSelectionRect(null);
                            setIsSelectingRegion(false);
                          }}
                          className="text-xs"
                        >
                          {isRegionSelectionMode ? '结束区域选图' : '区域选图'}
                        </Button>
                      </div>

                      {/* Template 图片 */}
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
                          <label
                            htmlFor="use-template"
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <ImageIcon size={16} className="text-gray-500" />
                            <span className="text-sm text-gray-700">使用模板图片</span>
                            <img
                              src={getImageUrl(
                                currentProject.template_image_path,
                                currentProject.updated_at
                              )}
                              alt="Template"
                              className="w-16 h-10 object-cover rounded border border-gray-300"
                            />
                          </label>
                        </div>
                      )}

                      {/* 描述中的图片 */}
                      {selectedPage?.description_content && (() => {
                        const descImageUrls = extractImageUrlsFromDescription(
                          selectedPage.description_content
                        );
                        return descImageUrls.length > 0 ? (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              描述中的图片：
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {descImageUrls.map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Desc image ${idx + 1}`}
                                    className="w-full h-20 object-cover rounded border-2 cursor-pointer transition-all"
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
                              className="text-xs"
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

                    {/* 修改指令输入框 */}
                    <div className="space-y-2 border-t border-gray-100 pt-3">
                      <Textarea
                        label="输入修改指令（将自动添加页面描述）"
                        placeholder="例如：将框选区域内的素材移除、把背景改成蓝色、增大标题字号、更改文本框样式为虚线..."
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRegeneratePage}
                          disabled={
                            selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                              ? true
                              : false
                          }
                          className="text-xs md:text-sm"
                        >
                          {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                            ? '生成中...'
                            : '重新生成'}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSubmitEdit}
                          disabled={!editPrompt.trim()}
                          className="text-xs md:text-sm"
                        >
                          根据指令生成
                        </Button>
                      </div>
                    </div>
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
                      onClick={() => handleMovePage('up')}
                      disabled={selectedIndex === 0}
                      className="text-[11px] md:text-xs"
                    >
                      上移
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMovePage('down')}
                      disabled={selectedIndex === currentProject.pages.length - 1}
                      className="text-[11px] md:text-xs"
                    >
                      下移
                    </Button>
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

                  {/* 操作（导航相关） */}
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
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {/* 快速替换图片的隐藏文件选择器 */}
      <input
        ref={quickReplaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickReplaceInputChange}
      />
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
        </>
      )}
    </div>
  );
};
