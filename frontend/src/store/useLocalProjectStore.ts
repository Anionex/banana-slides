/**
 * 本地项目状态管理
 * 使用 localStorage 和前端 AI 服务
 */

import { create } from 'zustand';
import type { Project, Page } from '@/types';
import { LocalStorageService } from '@/services/localStorageService';
import { GeminiService } from '@/services/geminiService';
import { MinerUService } from '@/services/mineruService';
import { useSettingsStore } from './useSettingsStore';
import { v4 as uuidv4 } from 'uuid';

interface LocalProjectState {
  // 状态
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  progress: { current: number; total: number } | null;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 项目操作
  createProject: (type: 'idea' | 'outline' | 'description', content: string) => Promise<void>;
  loadProject: (projectId: string) => void;
  saveProject: () => void;
  deleteProject: (projectId: string) => void;
  getAllProjects: () => Project[];

  // 页面操作
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  addPage: () => void;
  deletePage: (pageId: string) => void;
  reorderPages: (pageIds: string[]) => void;

  // AI 生成操作
  generateOutline: () => Promise<void>;
  generatePageDescription: (pageId: string) => Promise<void>;
  generateAllDescriptions: () => Promise<void>;
  generatePageImage: (pageId: string) => Promise<void>;
  generateAllImages: () => Promise<void>;

  // 文件解析
  parseFile: (file: File) => Promise<void>;
}

export const useLocalProjectStore = create<LocalProjectState>((set, get) => ({
  // 初始状态
  currentProject: null,
  isLoading: false,
  error: null,
  progress: null,

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // 创建项目
  createProject: async (type, content) => {
    set({ isLoading: true, error: null });

    try {
      const project: Project = {
        id: uuidv4(),
        creation_type: type,
        idea_prompt: type === 'idea' ? content : undefined,
        outline_text: type === 'outline' ? content : undefined,
        description_text: type === 'description' ? content : undefined,
        status: 'DRAFT',
        pages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      LocalStorageService.saveProject(project);
      LocalStorageService.setCurrentProjectId(project.id!);
      set({ currentProject: project });

      // 根据类型自动生成大纲
      if (type === 'idea') {
        await get().generateOutline();
      } else if (type === 'outline') {
        await get().generateOutline();
      } else if (type === 'description') {
        // 从描述生成大纲
        await get().generateOutline();
      }
    } catch (error: any) {
      set({ error: error.message || '创建项目失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 加载项目
  loadProject: (projectId) => {
    const project = LocalStorageService.getProject(projectId);
    if (project) {
      LocalStorageService.setCurrentProjectId(projectId);
      set({ currentProject: project });
    } else {
      set({ error: '项目不存在' });
    }
  },

  // 保存项目
  saveProject: () => {
    const { currentProject } = get();
    if (currentProject) {
      LocalStorageService.saveProject(currentProject);
    }
  },

  // 删除项目
  deleteProject: (projectId) => {
    LocalStorageService.deleteProject(projectId);
    const { currentProject } = get();
    if (currentProject?.id === projectId) {
      set({ currentProject: null });
    }
  },

  // 获取所有项目
  getAllProjects: () => {
    return LocalStorageService.getAllProjects();
  },

  // 更新页面
  updatePage: (pageId, updates) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedPages = currentProject.pages.map(page =>
      page.id === pageId ? { ...page, ...updates } : page
    );

    const updatedProject = {
      ...currentProject,
      pages: updatedPages,
      updated_at: new Date().toISOString()
    };

    set({ currentProject: updatedProject });
    LocalStorageService.saveProject(updatedProject);
  },

  // 添加页面
  addPage: () => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newPage: Page = {
      id: uuidv4(),
      order_index: currentProject.pages.length,
      outline_content: { title: '新页面', points: [] },
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedProject = {
      ...currentProject,
      pages: [...currentProject.pages, newPage],
      updated_at: new Date().toISOString()
    };

    set({ currentProject: updatedProject });
    LocalStorageService.saveProject(updatedProject);
  },

  // 删除页面
  deletePage: (pageId) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedPages = currentProject.pages.filter(p => p.id !== pageId);
    const updatedProject = {
      ...currentProject,
      pages: updatedPages,
      updated_at: new Date().toISOString()
    };

    set({ currentProject: updatedProject });
    LocalStorageService.saveProject(updatedProject);
  },

  // 重新排序页面
  reorderPages: (pageIds) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const reorderedPages = pageIds
      .map(id => currentProject.pages.find(p => p.id === id))
      .filter(Boolean) as Page[];

    const updatedProject = {
      ...currentProject,
      pages: reorderedPages.map((page, index) => ({
        ...page,
        order_index: index
      })),
      updated_at: new Date().toISOString()
    };

    set({ currentProject: updatedProject });
    LocalStorageService.saveProject(updatedProject);
  },

  // 生成大纲
  generateOutline: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    const settings = useSettingsStore.getState();
    if (!settings.isGeminiConfigured()) {
      set({ error: '请先配置 Gemini API Key' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const gemini = new GeminiService({
        apiKey: settings.geminiApiKey,
        textModel: settings.geminiTextModel,
        imageModel: settings.geminiImageModel
      });

      let outline;

      if (currentProject.creation_type === 'idea') {
        outline = await gemini.generateOutline(
          currentProject.idea_prompt || '',
          settings.language
        );
      } else if (currentProject.creation_type === 'outline') {
        outline = await gemini.parseOutlineText(
          currentProject.outline_text || '',
          settings.language
        );
      } else if (currentProject.creation_type === 'description') {
        // 从描述生成大纲
        outline = await gemini.generateOutline(
          currentProject.description_text || '',
          settings.language
        );
      }

      if (!outline) {
        throw new Error('生成大纲失败');
      }

      // 扁平化大纲为页面列表
      const pages = gemini.flattenOutline(outline);

      // 转换为 Page 对象
      const projectPages: Page[] = pages.map((item, index) => ({
        id: uuidv4(),
        order_index: index,
        part: item.part,
        outline_content: {
          title: item.title || '',
          points: item.points || []
        },
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const updatedProject = {
        ...currentProject,
        pages: projectPages,
        status: 'OUTLINE_GENERATED',
        updated_at: new Date().toISOString()
      };

      set({ currentProject: updatedProject });
      LocalStorageService.saveProject(updatedProject);
    } catch (error: any) {
      set({ error: error.message || '生成大纲失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 生成单页描述
  generatePageDescription: async (pageId) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const settings = useSettingsStore.getState();
    if (!settings.isGeminiConfigured()) {
      set({ error: '请先配置 Gemini API Key' });
      return;
    }

    const page = currentProject.pages.find(p => p.id === pageId);
    if (!page) return;

    set({ isLoading: true, error: null });

    try {
      const gemini = new GeminiService({
        apiKey: settings.geminiApiKey,
        textModel: settings.geminiTextModel
      });

      // 重建大纲结构
      const outline = currentProject.pages.map(p => ({
        title: p.outline_content?.title || '',
        points: p.outline_content?.points || [],
        part: p.part
      }));

      const description = await gemini.generatePageDescription(
        currentProject.idea_prompt || currentProject.outline_text || '',
        outline,
        {
          title: page.outline_content?.title || '',
          points: page.outline_content?.points || []
        },
        page.order_index + 1,
        settings.language
      );

      get().updatePage(pageId, {
        description_content: { text: description },
        status: 'DESCRIPTION_GENERATED'
      });
    } catch (error: any) {
      set({ error: error.message || '生成描述失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 生成所有页面描述
  generateAllDescriptions: async () => {
    const { currentProject } = get();
    if (!currentProject || currentProject.pages.length === 0) return;

    set({ isLoading: true, error: null, progress: { current: 0, total: currentProject.pages.length } });

    try {
      for (let i = 0; i < currentProject.pages.length; i++) {
        const page = currentProject.pages[i];
        set({ progress: { current: i, total: currentProject.pages.length } });
        await get().generatePageDescription(page.id!);
      }

      set({ progress: { current: currentProject.pages.length, total: currentProject.pages.length } });
    } catch (error: any) {
      set({ error: error.message || '生成描述失败' });
      throw error;
    } finally {
      set({ isLoading: false, progress: null });
    }
  },

  // 生成单页图片
  generatePageImage: async (pageId) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const settings = useSettingsStore.getState();
    if (!settings.isGeminiConfigured()) {
      set({ error: '请先配置 Gemini API Key' });
      return;
    }

    const page = currentProject.pages.find(p => p.id === pageId);
    if (!page || !page.description_content) {
      set({ error: '请先生成页面描述' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const gemini = new GeminiService({
        apiKey: settings.geminiApiKey,
        textModel: settings.geminiTextModel,
        imageModel: settings.geminiImageModel
      });

      // 生成图片提示词
      const outline = currentProject.pages.map(p => ({
        title: p.outline_content?.title || '',
        points: p.outline_content?.points || []
      }));

      const imagePrompt = await gemini.generateImagePrompt(
        page.description_content.text || '',
        outline,
        page.order_index + 1
      );

      // 生成图片
      const imageUrl = await gemini.generateImage(imagePrompt);

      // 更新页面
      get().updatePage(pageId, {
        generated_image_url: imageUrl,
        status: 'IMAGE_GENERATED'
      });
    } catch (error: any) {
      set({ error: error.message || '生成图片失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 生成所有页面图片
  generateAllImages: async () => {
    const { currentProject } = get();
    if (!currentProject || currentProject.pages.length === 0) return;

    set({ isLoading: true, error: null, progress: { current: 0, total: currentProject.pages.length } });

    try {
      for (let i = 0; i < currentProject.pages.length; i++) {
        const page = currentProject.pages[i];
        if (page.description_content) {
          set({ progress: { current: i, total: currentProject.pages.length } });
          await get().generatePageImage(page.id!);
        }
      }

      set({ progress: { current: currentProject.pages.length, total: currentProject.pages.length } });
    } catch (error: any) {
      set({ error: error.message || '生成图片失败' });
      throw error;
    } finally {
      set({ isLoading: false, progress: null });
    }
  },

  // 解析文件
  parseFile: async (file) => {
    const settings = useSettingsStore.getState();
    if (!settings.isMinerUConfigured()) {
      set({ error: '请先配置 MinerU Token' });
      return;
    }

    set({ isLoading: true, error: null, progress: { current: 0, total: 100 } });

    try {
      const mineru = new MinerUService({
        token: settings.mineruToken,
        apiBase: settings.mineruApiBase
      });

      // 添加进度回调
      const onProgress = (progress: { extractedPages: number; totalPages: number; startTime: string }) => {
        set({ 
          progress: { 
            current: progress.extractedPages, 
            total: progress.totalPages 
          } 
        });
        console.log(`解析进度: ${progress.extractedPages}/${progress.totalPages} 页`);
      };

      const result = await mineru.parseLocalFile(file, {
        modelVersion: 'vlm'
      }, onProgress);

      if (result.state === 'done' && result.fullZipUrl) {
        set({ progress: { current: 100, total: 100 } });
        
        // 下载解析结果
        const blob = await mineru.downloadResult(result.fullZipUrl);
        
        // TODO: 解压并处理解析结果
        console.log('文件解析完成:', blob);
        
        set({ error: '文件解析完成，但结果处理功能还在开发中' });
      }
    } catch (error: any) {
      set({ error: error.message || '文件解析失败' });
      throw error;
    } finally {
      set({ isLoading: false, progress: null });
    }
  }
}));
