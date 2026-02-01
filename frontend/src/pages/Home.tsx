import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, FileEdit, ImagePlus, Paperclip, Palette, Lightbulb, Search, Settings, FolderOpen, HelpCircle, Sun, Moon, Globe, Monitor, ChevronDown } from 'lucide-react';
import { Button, Textarea, Card, useToast, MaterialGeneratorModal, MaterialCenterModal, ReferenceFileList, ReferenceFileSelector, FilePreviewModal, ImagePreviewList, HelpModal, Footer, GithubRepoCard } from '@/components/shared';
import UserMenu from '@/components/auth/UserMenu';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate, uploadReferenceFile, type ReferenceFile, associateFileToProject, triggerFileParse, uploadMaterial, associateMaterialsToProject, listProjects } from '@/api/endpoints';
import { useProjectStore } from '@/store/useProjectStore';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/hooks/useT';
import { PRESET_STYLES } from '@/config/presetStyles';

type CreationType = 'idea' | 'outline' | 'description';

// 页面特有翻译 - AI 可以直接看到所有文案，保留原始 key 结构
const homeI18n = {
  zh: {
    nav: {
      materialGenerate: '素材生成', materialCenter: '素材中心',
      history: '历史项目', settings: '设置', help: '帮助'
    },
    settings: {
      language: { label: '界面语言' },
      theme: { label: '主题模式', light: '浅色', dark: '深色', system: '跟随系统' }
    },
    home: {
      title: '蕉幻',
      subtitle: 'Vibe your PPT like vibing code',
      tagline: '基于 nano banana pro🍌 的原生 AI PPT 生成器',
      features: {
        oneClick: '一句话生成 PPT',
        naturalEdit: '自然语言修改',
        regionEdit: '指定区域编辑',
        export: '一键导出 PPTX/PDF',
      },
      tabs: {
        idea: '一句话生成',
        outline: '从大纲生成',
        description: '从描述生成',
      },
      tabDescriptions: {
        idea: '输入你的想法，AI 将为你生成完整的 PPT',
        outline: '已有大纲？直接粘贴即可快速生成，AI 将自动切分为结构化大纲',
        description: '已有完整描述？AI 将自动解析出大纲并切分为每页描述，直接生成图片',
      },
      placeholders: {
        idea: '例如：生成一份关于 AI 发展史的演讲 PPT',
        outline: '粘贴你的 PPT 大纲...',
        description: '粘贴你的完整页面描述...',
      },
      template: {
        title: '选择风格模板',
        useTextStyle: '使用文字描述风格',
        stylePlaceholder: '描述您想要的 PPT 风格，例如：简约商务风格，使用蓝色和白色配色，字体清晰大方...',
        presetStyles: '快速选择预设风格：',
        styleTip: '提示：点击预设风格快速填充，或自定义描述风格、配色、布局等要求',
      },
      actions: {
        selectFile: '选择参考文件',
        parsing: '解析中...',
        createProject: '创建新项目',
      },
      messages: {
        enterContent: '请输入内容',
        filesParsing: '还有 {{count}} 个参考文件正在解析中，请等待解析完成',
        projectCreateFailed: '项目创建失败',
        uploadingImage: '正在上传图片...',
        imageUploadSuccess: '图片上传成功！已插入到光标位置',
        imageUploadFailed: '图片上传失败',
        fileUploadSuccess: '文件上传成功',
        fileUploadFailed: '文件上传失败',
        fileTooLarge: '文件过大：{{size}}MB，最大支持 200MB',
        unsupportedFileType: '不支持的文件类型: {{type}}',
        pptTip: '提示：建议将PPT转换为PDF格式上传，可获得更好的解析效果',
        filesAdded: '已添加 {{count}} 个参考文件',
        imageRemoved: '已移除图片',
        serviceTestTip: '建议先到设置页底部进行服务测试，避免后续功能异常',
      },
    },
  },
  en: {
    nav: {
      materialGenerate: 'Generate Material', materialCenter: 'Material Center',
      history: 'History', settings: 'Settings', help: 'Help'
    },
    settings: {
      language: { label: 'Interface Language' },
      theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' }
    },
    home: {
      title: 'Banana Slides',
      subtitle: 'Vibe your PPT like vibing code',
      tagline: 'AI-native PPT generator powered by nano banana pro🍌',
      features: {
        oneClick: 'One-click PPT generation',
        naturalEdit: 'Natural language editing',
        regionEdit: 'Region-specific editing',
        export: 'Export to PPTX/PDF',
      },
      tabs: {
        idea: 'From Idea',
        outline: 'From Outline',
        description: 'From Description',
      },
      tabDescriptions: {
        idea: 'Enter your idea, AI will generate a complete PPT for you',
        outline: 'Have an outline? Paste it directly, AI will split it into structured outline',
        description: 'Have descriptions? AI will parse and generate images directly',
      },
      placeholders: {
        idea: 'e.g., Generate a presentation about the history of AI',
        outline: 'Paste your PPT outline...',
        description: 'Paste your complete page descriptions...',
      },
      template: {
        title: 'Select Style Template',
        useTextStyle: 'Use text description for style',
        stylePlaceholder: 'Describe your desired PPT style, e.g., minimalist business style...',
        presetStyles: 'Quick select preset styles:',
        styleTip: 'Tip: Click preset styles to quick fill, or customize',
      },
      actions: {
        selectFile: 'Select reference file',
        parsing: 'Parsing...',
        createProject: 'Create New Project',
      },
      messages: {
        enterContent: 'Please enter content',
        filesParsing: '{{count}} reference file(s) are still parsing, please wait',
        projectCreateFailed: 'Failed to create project',
        uploadingImage: 'Uploading image...',
        imageUploadSuccess: 'Image uploaded! Inserted at cursor position',
        imageUploadFailed: 'Failed to upload image',
        fileUploadSuccess: 'File uploaded successfully',
        fileUploadFailed: 'Failed to upload file',
        fileTooLarge: 'File too large: {{size}}MB, maximum 200MB',
        unsupportedFileType: 'Unsupported file type: {{type}}',
        pptTip: 'Tip: Convert PPT to PDF for better parsing results',
        filesAdded: 'Added {{count}} reference file(s)',
        imageRemoved: 'Image removed',
        serviceTestTip: 'Test services in Settings first to avoid issues',
      },
    },
  },
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(homeI18n); // 组件内翻译 + 自动 fallback 到全局
  const { theme, isDark, setTheme } = useTheme();
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const { show, ToastContainer } = useToast();
  
  const [activeTab, setActiveTab] = useState<CreationType>('idea');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isMaterialCenterOpen, setIsMaterialCenterOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [useTemplateStyle, setUseTemplateStyle] = useState(false);
  const [templateStyle, setTemplateStyle] = useState('');
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // 检查是否有当前项目 & 加载用户模板
  useEffect(() => {
    const projectId = localStorage.getItem('currentProjectId');
    setCurrentProjectId(projectId);

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
  }, []);

  // 首次访问自动弹出帮助模态框
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('hasSeenHelpModal');
    if (!hasSeenHelp) {
      // 延迟500ms打开，让页面先渲染完成
      const timer = setTimeout(() => {
        setIsHelpModalOpen(true);
        localStorage.setItem('hasSeenHelpModal', 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOpenMaterialModal = () => {
    // 在主页始终生成全局素材，不关联任何项目
    setIsMaterialModalOpen(true);
  };

  // 检测粘贴事件，自动上传文件和图片
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    console.log('Paste event triggered');
    const items = e.clipboardData?.items;
    if (!items) {
      console.log('No clipboard items');
      return;
    }

    console.log('Clipboard items:', items.length);
    
    // 检查是否有文件或图片
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`Item ${i}:`, { kind: item.kind, type: item.type });
      
      if (item.kind === 'file') {
        const file = item.getAsFile();
        console.log('Got file:', file);
        
        if (file) {
          console.log('File details:', { name: file.name, type: file.type, size: file.size });
          
          // 检查是否是图片
          if (file.type.startsWith('image/')) {
            console.log('Image detected, uploading...');
            e.preventDefault(); // 阻止默认粘贴行为
            await handleImageUpload(file);
            return;
          }
          
          // 检查文件类型（参考文件）
          const allowedExtensions = ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'xlsx', 'xls', 'csv', 'txt', 'md'];
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          
          console.log('File extension:', fileExt);
          
          if (fileExt && allowedExtensions.includes(fileExt)) {
            console.log('File type allowed, uploading...');
            e.preventDefault(); // 阻止默认粘贴行为
            await handleFileUpload(file);
          } else {
            console.log('File type not allowed');
            show({ message: t('home.messages.unsupportedFileType', { type: fileExt || '' }), type: 'info' });
          }
        }
      }
    }
  };

  // 上传图片
  // 在 Home 页面，图片始终上传为全局素材（不关联项目），因为此时还没有项目
  const handleImageUpload = async (file: File) => {
    if (isUploadingFile) return;

    setIsUploadingFile(true);
    try {
      // 显示上传中提示
      show({ message: t('home.messages.uploadingImage'), type: 'info' });
      
      // 保存当前光标位置
      const cursorPosition = textareaRef.current?.selectionStart || content.length;
      
      // 上传图片到素材库（全局素材）
      const response = await uploadMaterial(file, null);
      
      if (response?.data?.url) {
        const imageUrl = response.data.url;
        
        // 生成markdown图片链接
        const markdownImage = `![image](${imageUrl})`;
        
        // 在光标位置插入图片链接
        setContent(prev => {
          const before = prev.slice(0, cursorPosition);
          const after = prev.slice(cursorPosition);
          
          // 如果光标前有内容且不以换行结尾，添加换行
          const prefix = before && !before.endsWith('\n') ? '\n' : '';
          // 如果光标后有内容且不以换行开头，添加换行
          const suffix = after && !after.startsWith('\n') ? '\n' : '';
          
          return before + prefix + markdownImage + suffix + after;
        });
        
        // 恢复光标位置（移动到插入内容之后）
        setTimeout(() => {
          if (textareaRef.current) {
            const newPosition = cursorPosition + (content.slice(0, cursorPosition) && !content.slice(0, cursorPosition).endsWith('\n') ? 1 : 0) + markdownImage.length;
            textareaRef.current.selectionStart = newPosition;
            textareaRef.current.selectionEnd = newPosition;
            textareaRef.current.focus();
          }
        }, 0);
        
        show({ message: t('home.messages.imageUploadSuccess'), type: 'success' });
      } else {
        show({ message: t('home.messages.imageUploadFailed'), type: 'error' });
      }
    } catch (error: any) {
      console.error('Image upload failed:', error);
      show({ 
        message: `${t('home.messages.imageUploadFailed')}: ${error?.response?.data?.error?.message || error.message || t('common.unknownError')}`, 
        type: 'error' 
      });
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 上传文件
  // 在 Home 页面，文件始终上传为全局文件（不关联项目），因为此时还没有项目
  const handleFileUpload = async (file: File) => {
    if (isUploadingFile) return;

    // 检查文件大小（前端预检查）
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      show({ 
        message: t('home.messages.fileTooLarge', { size: (file.size / 1024 / 1024).toFixed(1) }), 
        type: 'error' 
      });
      return;
    }

    // 检查是否是PPT文件，提示建议使用PDF
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'ppt' || fileExt === 'pptx') 
      show({ message: `💡 ${t('home.messages.pptTip')}`, type: 'info' });
    
    setIsUploadingFile(true);
    try {
      // 在 Home 页面，始终上传为全局文件
      const response = await uploadReferenceFile(file, null);
      if (response?.data?.file) {
        const uploadedFile = response.data.file;
        setReferenceFiles(prev => [...prev, uploadedFile]);
        show({ message: t('home.messages.fileUploadSuccess'), type: 'success' });
        
        // 如果文件状态为 pending，自动触发解析
        if (uploadedFile.parse_status === 'pending') {
          try {
            const parseResponse = await triggerFileParse(uploadedFile.id);
            // 使用解析接口返回的文件对象更新状态
            if (parseResponse?.data?.file) {
              const parsedFile = parseResponse.data.file;
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? parsedFile : f)
              );
            } else {
              // 如果没有返回文件对象，手动更新状态为 parsing（异步线程会稍后更新）
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? { ...f, parse_status: 'parsing' as const } : f)
              );
            }
          } catch (parseError: any) {
            console.error('触发文件解析失败:', parseError);
            // 解析触发失败不影响上传成功提示
          }
        }
      } else {
        show({ message: t('home.messages.fileUploadFailed'), type: 'error' });
      }
    } catch (error: any) {
      console.error('文件上传失败:', error);
      
      // 特殊处理413错误
      if (error?.response?.status === 413) {
        show({ 
          message: `文件过大：${(file.size / 1024 / 1024).toFixed(1)}MB，最大支持 200MB`, 
          type: 'error' 
        });
      } else {
        show({ 
          message: `文件上传失败: ${error?.response?.data?.error?.message || error.message || '未知错误'}`, 
          type: 'error' 
        });
      }
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 从当前项目移除文件引用（不删除文件本身）
  const handleFileRemove = (fileId: string) => {
    setReferenceFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 文件状态变化回调
  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    setReferenceFiles(prev => 
      prev.map(f => f.id === updatedFile.id ? updatedFile : f)
    );
  };

  // 点击回形针按钮 - 打开文件选择器
  const handlePaperclipClick = () => {
    setIsFileSelectorOpen(true);
  };

  // 从选择器选择文件后的回调
  const handleFilesSelected = (selectedFiles: ReferenceFile[]) => {
    // 合并新选择的文件到列表（去重）
    setReferenceFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const newFiles = selectedFiles.filter(f => !existingIds.has(f.id));
      // 合并时，如果文件已存在，更新其状态（可能解析状态已改变）
      const updated = prev.map(f => {
        const updatedFile = selectedFiles.find(sf => sf.id === f.id);
        return updatedFile || f;
      });
      return [...updated, ...newFiles];
    });
    show({ message: t('home.messages.filesAdded', { count: selectedFiles.length }), type: 'success' });
  };

  // 获取当前已选择的文件ID列表，传递给选择器（使用 useMemo 避免每次渲染都重新计算）
  const selectedFileIds = useMemo(() => {
    return referenceFiles.map(f => f.id);
  }, [referenceFiles]);

  // 从编辑框内容中移除指定的图片markdown链接
  const handleRemoveImage = (imageUrl: string) => {
    setContent(prev => {
      // 移除所有匹配该URL的markdown图片链接
      const imageRegex = new RegExp(`!\\[[^\\]]*\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      let newContent = prev.replace(imageRegex, '');
      
      // 清理多余的空行（最多保留一个空行）
      newContent = newContent.replace(/\n{3,}/g, '\n\n');
      
      return newContent.trim();
    });
    
    show({ message: t('home.messages.imageRemoved'), type: 'success' });
  };

  // 文件选择变化
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await handleFileUpload(files[i]);
    }

    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  const tabConfig = {
    idea: {
      icon: <Sparkles size={20} />,
      label: t('home.tabs.idea'),
      placeholder: t('home.placeholders.idea'),
      description: t('home.tabDescriptions.idea'),
    },
    outline: {
      icon: <FileText size={20} />,
      label: t('home.tabs.outline'),
      placeholder: t('home.placeholders.outline'),
      description: t('home.tabDescriptions.outline'),
    },
    description: {
      icon: <FileEdit size={20} />,
      label: t('home.tabs.description'),
      placeholder: t('home.placeholders.description'),
      description: t('home.tabDescriptions.description'),
    },
  };

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    // 总是设置文件（如果提供）
    if (templateFile) {
      setSelectedTemplate(templateFile);
    }
    
    // 处理模板 ID
    if (templateId) {
      // 判断是用户模板还是预设模板
      // 预设模板 ID 通常是 '1', '2', '3' 等短字符串
      // 用户模板 ID 通常较长（UUID 格式）
      if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
        // 预设模板
        setSelectedPresetTemplateId(templateId);
        setSelectedTemplateId(null);
      } else {
        // 用户模板
        setSelectedTemplateId(templateId);
        setSelectedPresetTemplateId(null);
      }
    } else {
      // 如果没有 templateId，可能是直接上传的文件
      // 清空所有选择状态
      setSelectedTemplateId(null);
      setSelectedPresetTemplateId(null);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      show({ message: t('home.messages.enterContent'), type: 'error' });
      return;
    }

    // 检查是否有正在解析的文件
    const parsingFiles = referenceFiles.filter(f =>
      f.parse_status === 'pending' || f.parse_status === 'parsing'
    );
    if (parsingFiles.length > 0) {
      show({
        message: t('home.messages.filesParsing', { count: parsingFiles.length }),
        type: 'info'
      });
      return;
    }

    try {
      try {
        const historyResponse = await listProjects(1, 0);
        if ((historyResponse.data?.projects || []).length === 0) {
          show({
            message: t('home.messages.serviceTestTip'),
            type: 'info'
          });
        }
      } catch (error) {
        console.warn('检查历史项目失败，跳过提示:', error);
      }

      // 如果有模板ID但没有File，按需加载
      let templateFile = selectedTemplate;
      if (!templateFile && (selectedTemplateId || selectedPresetTemplateId)) {
        const templateId = selectedTemplateId || selectedPresetTemplateId;
        if (templateId) {
          templateFile = await getTemplateFile(templateId, userTemplates);
        }
      }
      
      // 传递风格描述（只要有内容就传递，不管开关状态）
      const styleDesc = templateStyle.trim() ? templateStyle.trim() : undefined;
      
      await initializeProject(activeTab, content, templateFile || undefined, styleDesc);
      
      // 根据类型跳转到不同页面
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        show({ message: t('home.messages.projectCreateFailed'), type: 'error' });
        return;
      }
      
      // 关联参考文件到项目
      if (referenceFiles.length > 0) {
        console.log(`Associating ${referenceFiles.length} reference files to project ${projectId}:`, referenceFiles);
        try {
          // 批量更新文件的 project_id
          const results = await Promise.all(
            referenceFiles.map(async file => {
              const response = await associateFileToProject(file.id, projectId);
              console.log(`Associated file ${file.id}:`, response);
              return response;
            })
          );
          console.log('Reference files associated successfully:', results);
        } catch (error) {
          console.error('Failed to associate reference files:', error);
          // 不影响主流程，继续执行
        }
      } else {
        console.log('No reference files to associate');
      }
      
      // 关联图片素材到项目（解析content中的markdown图片链接）
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const materialUrls: string[] = [];
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        materialUrls.push(match[2]); // match[2] 是 URL
      }
      
      if (materialUrls.length > 0) {
        console.log(`Associating ${materialUrls.length} materials to project ${projectId}:`, materialUrls);
        try {
          const response = await associateMaterialsToProject(projectId, materialUrls);
          console.log('Materials associated successfully:', response);
        } catch (error) {
          console.error('Failed to associate materials:', error);
          // 不影响主流程，继续执行
        }
      } else {
        console.log('No materials to associate');
      }
      
      if (activeTab === 'idea' || activeTab === 'outline') {
        navigate(`/project/${projectId}/outline`);
      } else if (activeTab === 'description') {
        // 从描述生成：直接跳到描述生成页（因为已经自动生成了大纲和描述）
        navigate(`/project/${projectId}/detail`);
      }
    } catch (error: any) {
      console.error('创建项目失败:', error);
      // 错误已经在 store 中处理并显示
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary relative overflow-hidden">
      {/* 背景装饰元素 - 仅在亮色模式显示 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-banana-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative z-50 h-16 md:h-18 bg-white/40 dark:bg-background-primary backdrop-blur-2xl dark:backdrop-blur-none dark:border-b dark:border-border-primary">

        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="蕉幻 Banana Slides Logo"
                className="h-10 md:h-12 w-auto rounded-lg object-contain"
              />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-banana-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">
              蕉幻
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* 桌面端：带文字的素材生成按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleOpenMaterialModal}
              className="hidden sm:inline-flex hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.materialGenerate')}</span>
            </Button>
            {/* 手机端：仅图标的素材生成按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={handleOpenMaterialModal}
              className="sm:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.materialGenerate')}
            />
            {/* 桌面端：带文字的素材中心按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsMaterialCenterOpen(true)}
              className="hidden sm:inline-flex hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.materialCenter')}</span>
            </Button>
            {/* 手机端：仅图标的素材中心按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} />}
              onClick={() => setIsMaterialCenterOpen(true)}
              className="sm:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.materialCenter')}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/history')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden sm:inline">{t('nav.history')}</span>
              <span className="sm:hidden">{t('nav.history')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/settings')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.settings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHelpModalOpen(true)}
              className="hidden md:inline-flex hover:bg-banana-50/50"
            >
              {t('nav.help')}
            </Button>
            {/* 移动端帮助按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<HelpCircle size={16} />}
              onClick={() => setIsHelpModalOpen(true)}
              className="md:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.help')}
            />
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* 语言切换按钮 */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={t('settings.language.label')}
            >
              <Globe size={14} />
              <span>{i18n.language?.startsWith('zh') ? 'EN' : '中'}</span>
            </button>
            {/* 主题切换按钮 */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex items-center gap-1 p-1.5 text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
                title={t('settings.theme.label')}
              >
                {theme === 'system' ? <Monitor size={16} /> : isDark ? <Moon size={16} /> : <Sun size={16} />}
                <ChevronDown size={12} className={`transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* 主题下拉菜单 */}
              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary rounded-lg shadow-lg dark:shadow-none py-1 min-w-[120px]">
                    <button
                      onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'light' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Sun size={14} />
                      <span>{t('settings.theme.light')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'dark' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Moon size={14} />
                      <span>{t('settings.theme.dark')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'system' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Monitor size={14} />
                      <span>{t('settings.theme.system')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* GitHub 仓库卡片 */}
            <GithubRepoCard />
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* 用户菜单 - 最右侧 */}
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-8 md:py-12">
        {/* Hero 标题区 */}
        <div className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-background-secondary backdrop-blur-sm rounded-full border border-banana-200/50 dark:border-border-primary shadow-sm dark:shadow-none mb-4">
            <span className="text-2xl animate-pulse"><Sparkles size={20} className="text-orange-500 dark:text-banana" /></span>
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('home.tagline')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-pink-500 dark:from-banana-dark dark:via-banana dark:to-banana-light bg-clip-text text-transparent dark:italic" style={{
              backgroundSize: '200% auto',
              animation: 'gradient 3s ease infinite',
            }}>
              {i18n.language?.startsWith('zh') ? `${t('home.title')} · Banana Slides` : 'Banana Slides'}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-foreground-secondary max-w-2xl mx-auto font-light">
            {t('home.subtitle')}
          </p>

          {/* 特性标签 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-4">
            {[
              { icon: <Sparkles size={14} className="text-yellow-600 dark:text-banana" />, label: t('home.features.oneClick') },
              { icon: <FileEdit size={14} className="text-blue-500 dark:text-blue-400" />, label: t('home.features.naturalEdit') },
              { icon: <Search size={14} className="text-orange-500 dark:text-orange-400" />, label: t('home.features.regionEdit') },

              { icon: <Paperclip size={14} className="text-green-600 dark:text-green-400" />, label: t('home.features.export') },
            ].map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 dark:bg-background-secondary backdrop-blur-sm rounded-full text-xs md:text-sm text-gray-700 dark:text-foreground-secondary border border-gray-200/50 dark:border-border-primary shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-border-hover transition-all hover:scale-105 cursor-default"
              >
                {feature.icon}
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        {/* 创建卡片 */}
        <Card className="p-4 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary hover:shadow-3xl dark:hover:shadow-none transition-all duration-300 dark:rounded-2xl">
          {/* 选项卡 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 md:mb-8">
            {(Object.keys(tabConfig) as CreationType[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg dark:rounded-xl font-medium transition-all text-sm md:text-base touch-manipulation ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-banana-500 to-banana-600 dark:from-banana dark:to-banana text-black shadow-yellow dark:shadow-lg dark:shadow-banana/20'
                      : 'bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-banana-50 dark:hover:bg-background-hover active:bg-banana-100'
                  }`}
                >
                  <span className="scale-90 md:scale-100">{config.icon}</span>
                  <span className="truncate">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* 描述 */}
          <div className="relative">
            <p className="text-sm md:text-base mb-4 md:mb-6 leading-relaxed">
              <span className="inline-flex items-center gap-2 text-gray-600 dark:text-foreground-tertiary">
                <Lightbulb size={16} className="text-banana-600 dark:text-banana flex-shrink-0" />
                <span className="font-semibold">
                  {tabConfig[activeTab].description}
                </span>
              </span>
            </p>
          </div>

          {/* 输入区 - 带按钮 */}
          <div className="relative mb-2 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-banana-400 to-orange-400 rounded-lg opacity-0 group-hover:opacity-20 dark:group-hover:opacity-10 blur transition-opacity duration-300"></div>
            <Textarea
              ref={textareaRef}
              placeholder={tabConfig[activeTab].placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              rows={activeTab === 'idea' ? 4 : 8}
              className="relative pr-20 md:pr-28 pb-12 md:pb-14 text-sm md:text-base border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary focus:border-banana-400 dark:focus:border-banana transition-colors duration-200" // 为右下角按钮留空间
            />

            {/* 左下角：上传文件按钮（回形针图标） */}
            <button
              type="button"
              onClick={handlePaperclipClick}
              className="absolute left-2 md:left-3 bottom-2 md:bottom-3 z-10 p-1.5 md:p-2 text-gray-400 dark:text-foreground-tertiary hover:text-gray-600 dark:hover:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover rounded-lg transition-colors active:scale-95 touch-manipulation"
              title="选择参考文件"
            >
              <Paperclip size={18} className="md:w-5 md:h-5" />
            </button>

            {/* 右下角：开始生成按钮 */}
            <div className="absolute right-2 md:right-3 bottom-2 md:bottom-3 z-10">
              <Button
                size="sm"
                onClick={handleSubmit}
                loading={isGlobalLoading}
                disabled={
                  !content.trim() ||
                  referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                }
                className="shadow-sm dark:shadow-background-primary/30 text-xs md:text-sm px-3 md:px-4"
              >
                {referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                  ? t('home.actions.parsing')
                  : t('common.next')}
              </Button>
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 图片预览列表 */}
          <ImagePreviewList
            content={content}
            onRemoveImage={handleRemoveImage}
            className="mb-4"
          />

          <ReferenceFileList
            files={referenceFiles}
            onFileClick={setPreviewFileId}
            onFileDelete={handleFileRemove}
            onFileStatusChange={handleFileStatusChange}
            deleteMode="remove"
            className="mb-4"
          />

          {/* 模板选择 */}
          <div className="mb-6 md:mb-8 pt-4 border-t border-gray-100 dark:border-border-primary">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-orange-600 dark:text-banana flex-shrink-0" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  {t('home.template.title')}
                </h3>
              </div>
              {/* 无模板图模式开关 */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {t('home.template.useTextStyle')}
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useTemplateStyle}
                    onChange={(e) => {
                      setUseTemplateStyle(e.target.checked);
                      // 切换到无模板图模式时，清空模板选择
                      if (e.target.checked) {
                        setSelectedTemplate(null);
                        setSelectedTemplateId(null);
                        setSelectedPresetTemplateId(null);
                      }
                      // 不再清空风格描述，允许用户保留已输入的内容
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-banana-300 dark:peer-focus:ring-banana/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-banana"></div>
                </div>
              </label>
            </div>
            
            {/* 根据模式显示不同的内容 */}
            {useTemplateStyle ? (
              <div className="space-y-3">
                <Textarea
                  placeholder={t('home.template.stylePlaceholder')}
                  value={templateStyle}
                  onChange={(e) => setTemplateStyle(e.target.value)}
                  rows={3}
                  className="text-sm border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary focus:border-banana-400 dark:focus:border-banana transition-colors duration-200"
                />

                {/* 预设风格按钮 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary">
                    {t('home.template.presetStyles')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_STYLES.map((preset) => (
                      <div key={preset.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setTemplateStyle(t(preset.descriptionKey))}
                          onMouseEnter={() => setHoveredPresetId(preset.id)}
                          onMouseLeave={() => setHoveredPresetId(null)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border-2 border-gray-200 dark:border-border-primary dark:text-foreground-secondary hover:border-banana-400 dark:hover:border-banana hover:bg-banana-50 dark:hover:bg-background-hover transition-all duration-200 hover:shadow-sm dark:hover:shadow-none"
                        >
                          {t(preset.nameKey)}
                        </button>
                        
                        {/* 悬停时显示预览图片 */}
                        {hoveredPresetId === preset.id && preset.previewImage && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="bg-white dark:bg-background-secondary rounded-lg shadow-2xl dark:shadow-none border-2 border-banana-400 dark:border-banana p-2.5 w-72">
                              <img
                                src={preset.previewImage}
                                alt={t(preset.nameKey)}
                                className="w-full h-40 object-cover rounded"
                                onError={(e) => {
                                  // 如果图片加载失败，隐藏预览
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <p className="text-xs text-gray-600 dark:text-foreground-tertiary mt-2 px-1 line-clamp-3">
                                {t(preset.descriptionKey)}
                              </p>
                            </div>
                            {/* 小三角形指示器 */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="w-3 h-3 bg-white dark:bg-background-secondary border-r-2 border-b-2 border-banana-400 dark:border-banana transform rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-foreground-tertiary">
                  💡 {t('home.template.styleTip')}
                </p>
              </div>
            ) : (
              <TemplateSelector
                onSelect={handleTemplateSelect}
                selectedTemplateId={selectedTemplateId}
                selectedPresetTemplateId={selectedPresetTemplateId}
                showUpload={true} // 在主页上传的模板保存到用户模板库
                projectId={currentProjectId}
              />
            )}
          </div>

        </Card>
      </main>
      <ToastContainer />
      {/* 素材生成模态 - 在主页始终生成全局素材 */}
      <MaterialGeneratorModal
        projectId={null}
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
      />
      {/* 素材中心模态 */}
      <MaterialCenterModal
        isOpen={isMaterialCenterOpen}
        onClose={() => setIsMaterialCenterOpen(false)}
      />
      {/* 参考文件选择器 */}
      {/* 在 Home 页面，始终查询全局文件，因为此时还没有项目 */}
      <ReferenceFileSelector
        projectId={null}
        isOpen={isFileSelectorOpen}
        onClose={() => setIsFileSelectorOpen(false)}
        onSelect={handleFilesSelected}
        multiple={true}
        initialSelectedIds={selectedFileIds}
      />
      
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
      {/* 帮助模态框 */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      {/* Footer */}
      <Footer />
    </div>
  );
};
