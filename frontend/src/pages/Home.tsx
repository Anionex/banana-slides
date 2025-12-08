import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, FileEdit, ImagePlus, Paperclip, Palette, Lightbulb, Settings, LogIn, LogOut, UserCircle } from 'lucide-react';
import { Button, Textarea, Card, useToast, MaterialGeneratorModal, APISettingsModal, ReferenceFileCard, ReferenceFileSelector } from '@/components/shared';
import { OnboardingGuide } from '@/components/shared/OnboardingGuide';
import { TemplateSelector, getTemplateFile, PRESET_TEMPLATES } from '@/components/shared/TemplateSelector';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { listUserTemplates, type UserTemplate, uploadReferenceFile, type ReferenceFile, associateFileToProject } from '@/api/endpoints';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuthStore } from '@/store/useAuthStore';
import { logout as logoutApi } from '@/api/auth';

type CreationType = 'idea' | 'outline' | 'description';

export const Home: React.FC = () => {
  const { t } = useTranslation(['common', 'auth', 'project', 'errors']);
  const navigate = useNavigate();
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { isAuthenticated, user, logout: logoutStore, getAccessToken } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<CreationType>('idea');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查是否有当前项目 & 加载用户模板 & 检查首次访问
  useEffect(() => {
    const projectId = localStorage.getItem('currentProjectId');
    setCurrentProjectId(projectId);

    // 检查是否是首次访问
    const hasSeenOnboarding = localStorage.getItem('banana_onboarding_completed');
    if (!hasSeenOnboarding) {
      // 延迟500ms显示引导，让页面先加载
      setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 500);
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
  }, []);

  const handleOpenMaterialModal = () => {
    // 在主页始终生成全局素材，不关联任何项目
    setIsMaterialModalOpen(true);
  };

  // 检测粘贴事件，自动上传文件
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    console.log('Paste event triggered');
    const items = e.clipboardData?.items;
    if (!items) {
      console.log('No clipboard items');
      return;
    }

    console.log('Clipboard items:', items.length);
    
    // 检查是否有文件
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`Item ${i}:`, { kind: item.kind, type: item.type });
      
      if (item.kind === 'file') {
        const file = item.getAsFile();
        console.log('Got file:', file);
        
        if (file) {
          console.log('File details:', { name: file.name, type: file.type, size: file.size });
          
          // 检查文件类型
          const allowedExtensions = ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'xlsx', 'xls', 'csv', 'txt', 'md'];
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          
          console.log('File extension:', fileExt);
          
          if (fileExt && allowedExtensions.includes(fileExt)) {
            console.log('File type allowed, uploading...');
            e.preventDefault(); // 阻止默认粘贴行为
            await handleFileUpload(file);
          } else {
            console.log('File type not allowed');
            show({ message: `${t('errors:invalid_file_type')}: ${fileExt}`, type: 'info' });
          }
        }
      }
    }
  };

  // 上传文件
  // 在 Home 页面，文件始终上传为全局文件（不关联项目），因为此时还没有项目
  const handleFileUpload = async (file: File) => {
    if (isUploadingFile) return;

    setIsUploadingFile(true);
    try {
      // 在 Home 页面，始终上传为全局文件
      const response = await uploadReferenceFile(file, null);
      if (response.data?.file) {
        setReferenceFiles(prev => [...prev, response.data.file]);
        show({ message: t('status.success'), type: 'success' });
      }
    } catch (error: any) {
      console.error('文件上传失败:', error);
      show({
        message: `${t('errors:file_upload_error')}: ${error?.response?.data?.error?.message || error.message || t('errors:unknown_error')}`,
        type: 'error'
      });
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
    show({ message: `${t('status.success')} (${selectedFiles.length} 个文件)`, type: 'success' });
  };

  // 获取当前已选择的文件ID列表，传递给选择器（使用 useMemo 避免每次渲染都重新计算）
  const selectedFileIds = useMemo(() => {
    return referenceFiles.map(f => f.id);
  }, [referenceFiles]);

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
      label: t('project:creation.idea_tab'),
      placeholder: t('project:creation.idea_placeholder'),
      description: t('project:creation.idea_help'),
    },
    outline: {
      icon: <FileText size={20} />,
      label: t('project:creation.outline_tab'),
      placeholder: t('project:creation.outline_placeholder'),
      description: t('project:creation.outline_help'),
    },
    description: {
      icon: <FileEdit size={20} />,
      label: t('project:creation.description_tab'),
      placeholder: t('project:creation.description_placeholder'),
      description: t('project:creation.description_help'),
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

  // 处理退出登录
  const handleLogout = async () => {
    try {
      const accessToken = getAccessToken();
      if (accessToken) {
        await logoutApi(accessToken);
      }
      logoutStore();
      show({ message: t('auth:logout_success'), type: 'success' });
    } catch (error) {
      console.error('Logout error:', error);
      // 即使 API 调用失败也要清除本地状态
      logoutStore();
      show({ message: t('auth:logout_success'), type: 'success' });
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      show({ message: t('errors:validation_error'), type: 'error' });
      return;
    }

    // 检查是否有正在解析的文件
    const parsingFiles = referenceFiles.filter(f =>
      f.parse_status === 'pending' || f.parse_status === 'parsing'
    );
    if (parsingFiles.length > 0) {
      show({
        message: `${t('loading.processing')} ${parsingFiles.length} 个文件...`,
        type: 'info'
      });
      return;
    }

    try {
      // 如果有模板ID但没有File，按需加载
      let templateFile = selectedTemplate;
      if (!templateFile && (selectedTemplateId || selectedPresetTemplateId)) {
        const templateId = selectedTemplateId || selectedPresetTemplateId;
        if (templateId) {
          templateFile = await getTemplateFile(templateId, userTemplates, PRESET_TEMPLATES);
        }
      }
      
      await initializeProject(activeTab, content, templateFile || undefined);
      
      // 根据类型跳转到不同页面
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        show({ message: t('errors:server_error'), type: 'error' });
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden transition-colors duration-300">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-banana-500/10 dark:bg-banana-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-400/10 dark:bg-orange-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 dark:bg-yellow-400/3 rounded-full blur-3xl"></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative h-14 md:h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-gray-100/50 dark:border-gray-700/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo.jpg"
              alt="MaynorAI Banana Pro Slides Logo"
              className="w-8 h-8 md:w-12 md:h-12 rounded-lg object-cover object-center"
            />
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
              MaynorAI
            </span>
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleOpenMaterialModal}
              className="hidden sm:inline-flex hover:bg-banana-50/50"
            >
              <span className="hidden md:inline">{t('project:dashboard.new_project')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/history')}
              className="text-xs md:text-sm hover:bg-banana-50/50"
            >
              <span className="hidden sm:inline">{t('navigation.projects')}</span>
              <span className="sm:hidden">{t('navigation.projects')}</span>
            </Button>
            <LanguageSwitcher variant="toggle" className="hidden sm:flex" />
            <ThemeToggle variant="toggle" className="hidden sm:flex" />
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsSettingsModalOpen(true)}
              className="hover:bg-banana-50/50"
            >
              <span className="hidden md:inline">{t('navigation.settings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-banana-50/50 dark:hover:bg-gray-800"
              onClick={() => setIsOnboardingOpen(true)}
            >
              <span className="hidden md:inline">{t('navigation.help')}</span>
              <span className="md:hidden">帮助</span>
            </Button>

            {/* 登录/用户菜单 */}
            {isAuthenticated && user ? (
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<UserCircle size={18} />}
                  className="hover:bg-banana-50/50 dark:hover:bg-gray-800"
                >
                  <span className="hidden md:inline max-w-24 truncate">{user.username}</span>
                </Button>
                {/* 下拉菜单 */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-2">
                    <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      <p className="font-medium truncate">{user.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    >
                      <LogOut size={16} />
                      <span>{t('auth:logout')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<LogIn size={16} className="md:w-[18px] md:h-[18px]" />}
                onClick={() => navigate('/auth')}
                className="hover:bg-banana-50/50 dark:hover:bg-gray-800"
              >
                <span className="hidden md:inline">{t('auth:login')}</span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-8 md:py-12">
        {/* Hero 标题区 */}
        <div className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full border border-banana-200/50 dark:border-banana-400/30 shadow-sm mb-4">
            <span className="text-2xl animate-pulse"><Sparkles size={20} color="orange" /></span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">基于 nano banana pro🍌 的原生 AI PPT 生成器</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-pink-500 bg-clip-text text-transparent" style={{
              backgroundSize: '200% auto',
              animation: 'gradient 3s ease infinite',
            }}>
              MaynorAI Banana Pro Slides
            </span>
          </h1>
          
          <p className="text-lg md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-light">
            <span className="font-medium">Vibe your PPT  like vibing code</span>
            <br className="hidden md:block" />
            <span className="text-base md:text-lg text-gray-500 dark:text-gray-400 mt-2 block">
              降低 PPT 制作门槛，让每个人都能快速创作出美观专业的演示文稿
            </span>
          </p>

          {/* 特性标签 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-4">
            {[
              { icon: <Sparkles size={14} className="text-yellow-600" />, label: '一句话生成 PPT' },
              { icon: <FileText size={14} className="text-orange-500" />, label: '三种生成路径' },
              { icon: <FileEdit size={14} className="text-blue-500" />, label: '自然语言修改' },
              { icon: <Paperclip size={14} className="text-green-600" />, label: '一键导出 PPTX/PDF' },
            ].map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-full text-xs md:text-sm text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50 shadow-sm hover:shadow-md transition-all hover:scale-105 cursor-default"
              >
                {feature.icon}
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        {/* 创建卡片 */}
        <Card className="p-4 md:p-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border-0 hover:shadow-3xl transition-all duration-300">
          {/* 选项卡 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 md:mb-8">
            {(Object.keys(tabConfig) as CreationType[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base touch-manipulation ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-banana-500 to-banana-600 text-black shadow-yellow'
                      : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-banana-50 dark:hover:bg-gray-600 active:bg-banana-100'
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
              <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Lightbulb size={16} className="text-banana-600 dark:text-banana-400 flex-shrink-0" />
                <span className="font-semibold">
                  {tabConfig[activeTab].description}
                </span>
              </span>
            </p>
          </div>

          {/* 输入区 - 带按钮 */}
          <div className="relative mb-2 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-banana-400 to-orange-400 rounded-lg opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
            <Textarea
              placeholder={tabConfig[activeTab].placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              rows={activeTab === 'idea' ? 4 : 8}
              className="relative pr-20 md:pr-28 pb-12 md:pb-14 text-sm md:text-base border-2 border-gray-200 focus:border-banana-400 transition-colors duration-200" // 为右下角按钮留空间
            />

            {/* 左下角：上传文件按钮（回形针图标） */}
            <button
              type="button"
              onClick={handlePaperclipClick}
              className="absolute left-2 md:left-3 bottom-2 md:bottom-3 z-10 p-1.5 md:p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95 touch-manipulation"
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
                className="shadow-sm text-xs md:text-sm px-3 md:px-4"
              >
                {referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                  ? t('loading.processing')
                  : t('buttons.next')}
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

          {referenceFiles.length > 0 && (
            <div className="mb-4">
              <div className="space-y-2">
                {referenceFiles.map(file => (
                  <ReferenceFileCard
                    key={file.id}
                    file={file}
                    onDelete={handleFileRemove}
                    onStatusChange={handleFileStatusChange}
                    deleteMode="remove"
                  />
                ))}
              </div>
            </div>
          )}

          {/* 模板选择 */}
          <div className="mb-6 md:mb-8 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  选择风格模板
                </h3>
              </div>
            </div>
            <TemplateSelector
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplateId}
              selectedPresetTemplateId={selectedPresetTemplateId}
              showUpload={true} // 在主页上传的模板保存到用户模板库
              projectId={currentProjectId}
            />
          </div>

        </Card>
      </main>

      {/* 页脚 */}
      <footer className="relative py-6 mt-8 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-3 md:px-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>© 2024 MaynorAI Banana Pro Slides</span>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://link3.cc/maynorai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 hover:underline transition-colors"
            >
              🔗 友情链接
            </a>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://github.com/xianyu110/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:underline transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      <ToastContainer />
      {/* 素材生成模态 - 在主页始终生成全局素材 */}
      <MaterialGeneratorModal
        projectId={null}
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
      />
      {/* API 设置模态 */}
      <APISettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      {/* 新用户引导 */}
      <OnboardingGuide
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
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
    </div>
  );
};

