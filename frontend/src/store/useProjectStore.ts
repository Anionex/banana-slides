import { create } from 'zustand';
import type { Project, Task } from '@/types';
import * as api from '@/api/endpoints';
import { debounce, normalizeProject, normalizeErrorMessage } from '@/utils';

interface ProjectState {
  // 状态
  currentProject: Project | null;
  isGlobalLoading: boolean;
  activeTaskId: string | null;
  taskProgress: { total: number; completed: number } | null;
  error: string | null;
  // 每个页面的生成任务ID映射 (pageId -> taskId)
  pageGeneratingTasks: Record<string, string>;
  // 每个页面的描述生成状态 (pageId -> boolean)
  pageDescriptionGeneratingTasks: Record<string, boolean>;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setGlobalLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 项目操作
  initializeProject: (type: 'idea' | 'outline' | 'description', content: string, templateImage?: File) => Promise<void>;
  syncProject: (projectId?: string) => Promise<void>;
  
  // 页面操作
  updatePageLocal: (pageId: string, data: any) => void;
  saveAllPages: () => Promise<void>;
  reorderPages: (newOrder: string[]) => Promise<void>;
  addNewPage: () => Promise<void>;
  deletePageById: (pageId: string) => Promise<void>;
  
  // 异步任务
  startAsyncTask: (apiCall: () => Promise<any>) => Promise<void>;
  pollTask: (taskId: string) => Promise<void>;
  
  // 生成操作
  generateOutline: () => Promise<void>;
  generateFromDescription: () => Promise<void>;
  generateDescriptions: () => Promise<void>;
  generatePageDescription: (pageId: string) => Promise<void>;
  generateImages: () => Promise<void>;
  generatePageImage: (pageId: string, forceRegenerate?: boolean) => Promise<void>;
  editPageImage: (
    pageId: string,
    editPrompt: string,
    contextImages?: {
      useTemplate?: boolean;
      descImageUrls?: string[];
      uploadedFiles?: File[];
    }
  ) => Promise<void>;
  
  // 导出
  exportPPTX: () => Promise<void>;
  exportPDF: () => Promise<void>;
  exportEditablePPTX: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  // 防抖的API更新函数（在store内部定义，以便访问syncProject）
const debouncedUpdatePage = debounce(
  async (projectId: string, pageId: string, data: any) => {
      try {
    // 如果更新的是 description_content，使用专门的端点
    if (data.description_content) {
      await api.updatePageDescription(projectId, pageId, data.description_content);
    } else if (data.outline_content) {
      // 如果更新的是 outline_content，使用专门的端点
      await api.updatePageOutline(projectId, pageId, data.outline_content);
    } else {
      await api.updatePage(projectId, pageId, data);
        }
        
        // API调用成功后，同步项目状态以更新updated_at
        // 这样可以确保历史记录页面显示最新的更新时间
        const { syncProject } = get();
        await syncProject(projectId);
      } catch (error: any) {
        console.error('保存页面失败:', error);
        // 可以在这里添加错误提示，但为了避免频繁提示，暂时只记录日志
        // 如果需要，可以通过事件系统或toast通知用户
    }
  },
  1000
);

  return {
  // 初始状态
  currentProject: null,
  isGlobalLoading: false,
  activeTaskId: null,
  taskProgress: null,
  error: null,
  pageGeneratingTasks: {},
  pageDescriptionGeneratingTasks: {},

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
  setError: (error) => set({ error }),

  // 初始化项目
  initializeProject: async (type, content, templateImage) => {
    set({ isGlobalLoading: true, error: null });
    try {
      const request: any = {};
      
      if (type === 'idea') {
        request.idea_prompt = content;
      } else if (type === 'outline') {
        request.outline_text = content;
      } else if (type === 'description') {
        request.description_text = content;
      }
      
      // 1. 创建项目
      const response = await api.createProject(request);
      const projectId = response.data?.project_id;
      
      if (!projectId) {
        throw new Error('项目创建失败：未返回项目ID');
      }
      
      // 2. 如果有模板图片，上传模板
      if (templateImage) {
        try {
          await api.uploadTemplate(projectId, templateImage);
        } catch (error) {
          console.warn('模板上传失败:', error);
          // 模板上传失败不影响项目创建，继续执行
        }
      }
      
      // 3. 如果是 description 类型，自动生成大纲和页面描述
      if (type === 'description') {
        try {
          await api.generateFromDescription(projectId, content);
          console.log('[初始化项目] 从描述生成大纲和页面描述完成');
        } catch (error) {
          console.error('[初始化项目] 从描述生成失败:', error);
          // 继续执行，让用户可以手动操作
        }
      }
      
      // 4. 获取完整项目信息
      const projectResponse = await api.getProject(projectId);
      const project = normalizeProject(projectResponse.data);
      
      if (project) {
        set({ currentProject: project });
        // 保存到 localStorage
        localStorage.setItem('currentProjectId', project.id!);
      }
    } catch (error: any) {
      set({ error: normalizeErrorMessage(error.message || '创建项目失败') });
      throw error;
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 同步项目数据
  syncProject: async (projectId?: string) => {
    const { currentProject } = get();
    
    // 如果没有提供 projectId，尝试从 currentProject 或 localStorage 获取
    let targetProjectId = projectId;
    if (!targetProjectId) {
      if (currentProject?.id) {
        targetProjectId = currentProject.id;
      } else {
        targetProjectId = localStorage.getItem('currentProjectId') || undefined;
      }
    }
    
    if (!targetProjectId) {
      console.warn('syncProject: 没有可用的项目ID');
      return;
    }

    try {
      const response = await api.getProject(targetProjectId);
      if (response.data) {
        const project = normalizeProject(response.data);
        console.log('[syncProject] 同步项目数据:', {
          projectId: project.id,
          pagesCount: project.pages?.length || 0,
          status: project.status
        });
        set({ currentProject: project });
        // 确保 localStorage 中保存了项目ID
        localStorage.setItem('currentProjectId', project.id!);
      }
    } catch (error: any) {
      // 提取更详细的错误信息
      let errorMessage = '同步项目失败';
      let shouldClearStorage = false;
      
      if (error.response) {
        // 服务器返回了错误响应
        const errorData = error.response.data;
        if (error.response.status === 404) {
          // 404错误：项目不存在，清除localStorage
          errorMessage = errorData?.error?.message || '项目不存在，可能已被删除';
          shouldClearStorage = true;
        } else if (errorData?.error?.message) {
          // 从后端错误格式中提取消息
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.error) {
          errorMessage = typeof errorData.error === 'string' ? errorData.error : errorData.error.message || '请求失败';
        } else {
          errorMessage = `请求失败: ${error.response.status}`;
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorMessage = '网络错误，请检查后端服务是否启动';
      } else if (error.message) {
        // 其他错误
        errorMessage = error.message;
      }
      
      // 如果项目不存在，清除localStorage并重置当前项目
      if (shouldClearStorage) {
        console.warn('[syncProject] 项目不存在，清除localStorage');
        localStorage.removeItem('currentProjectId');
        set({ currentProject: null, error: normalizeErrorMessage(errorMessage) });
      } else {
        set({ error: normalizeErrorMessage(errorMessage) });
      }
    }
  },

  // 本地更新页面（乐观更新）
  updatePageLocal: (pageId, data) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedPages = currentProject.pages.map((page) =>
      page.id === pageId ? { ...page, ...data } : page
    );

    set({
      currentProject: {
        ...currentProject,
        pages: updatedPages,
      },
    });

    // 防抖后调用API
    debouncedUpdatePage(currentProject.id, pageId, data);
  },

  // 立即保存所有页面的更改（用于保存按钮）
  // 等待防抖完成，然后同步项目状态以确保updated_at更新
  saveAllPages: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    // 等待防抖延迟时间（1秒）+ 额外时间确保API调用完成
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 同步项目状态，这会从后端获取最新的updated_at
    await get().syncProject(currentProject.id);
  },

  // 重新排序页面
  reorderPages: async (newOrder) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // 乐观更新
    const reorderedPages = newOrder
      .map((id) => currentProject.pages.find((p) => p.id === id))
      .filter(Boolean) as any[];

    set({
      currentProject: {
        ...currentProject,
        pages: reorderedPages,
      },
    });

    try {
      await api.updatePagesOrder(currentProject.id, newOrder);
    } catch (error: any) {
      set({ error: error.message || '更新顺序失败' });
      // 失败后重新同步
      await get().syncProject();
    }
  },

  // 添加新页面
  addNewPage: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      const newPage = {
        outline_content: { title: '新页面', points: [] },
        order_index: currentProject.pages.length,
      };
      
      const response = await api.addPage(currentProject.id, newPage);
      if (response.data) {
        await get().syncProject();
      }
    } catch (error: any) {
      set({ error: error.message || '添加页面失败' });
    }
  },

  // 删除页面
  deletePageById: async (pageId) => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      await api.deletePage(currentProject.id, pageId);
      await get().syncProject();
    } catch (error: any) {
      set({ error: error.message || '删除页面失败' });
    }
  },

  // 启动异步任务
  startAsyncTask: async (apiCall) => {
    console.log('[异步任务] 启动异步任务...');
    set({ isGlobalLoading: true, error: null });
    try {
      const response = await apiCall();
      console.log('[异步任务] API响应:', response);
      
      // task_id 在 response.data 中
      const taskId = response.data?.task_id;
      if (taskId) {
        console.log('[异步任务] 收到task_id:', taskId, '开始轮询...');
        set({ activeTaskId: taskId });
        await get().pollTask(taskId);
      } else {
        console.warn('[异步任务] 响应中没有task_id，可能是同步操作:', response);
        // 同步操作完成后，刷新项目数据
        await get().syncProject();
        set({ isGlobalLoading: false });
      }
    } catch (error: any) {
      console.error('[异步任务] 启动失败:', error);
      set({ error: error.message || '任务启动失败', isGlobalLoading: false });
      throw error;
    }
  },

  // 轮询任务状态
  pollTask: async (taskId) => {
    console.log(`[轮询] 开始轮询任务: ${taskId}`);
    const { currentProject } = get();
    if (!currentProject) {
      console.warn('[轮询] 没有当前项目，停止轮询');
      return;
    }

    const poll = async () => {
      try {
        console.log(`[轮询] 查询任务状态: ${taskId}`);
        const response = await api.getTaskStatus(currentProject.id!, taskId);
        const task = response.data;
        
        if (!task) {
          console.warn('[轮询] 响应中没有任务数据');
          return;
        }

        // 更新进度
        if (task.progress) {
          set({ taskProgress: task.progress });
        }

        console.log(`[轮询] Task ${taskId} 状态: ${task.status}`, task);

        // 检查任务状态
        if (task.status === 'COMPLETED') {
          console.log(`[轮询] Task ${taskId} 已完成，刷新项目数据`);
          set({ 
            activeTaskId: null, 
            taskProgress: null, 
            isGlobalLoading: false 
          });
          // 刷新项目数据
          await get().syncProject();
        } else if (task.status === 'FAILED') {
          console.error(`[轮询] Task ${taskId} 失败:`, task.error_message || task.error);
          set({ 
            error: normalizeErrorMessage(task.error_message || task.error || '任务失败'),
            activeTaskId: null,
            taskProgress: null,
            isGlobalLoading: false
          });
        } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
          // 继续轮询（PENDING 或 PROCESSING）
          console.log(`[轮询] Task ${taskId} 处理中，2秒后继续轮询...`);
          setTimeout(poll, 2000);
        } else {
          // 未知状态，停止轮询
          console.warn(`[轮询] Task ${taskId} 未知状态: ${task.status}，停止轮询`);
          set({ 
            error: `未知任务状态: ${task.status}`,
            activeTaskId: null,
            taskProgress: null,
            isGlobalLoading: false
          });
        }
      } catch (error: any) {
        console.error('任务轮询错误:', error);
        set({ 
          error: normalizeErrorMessage(error.message || '任务查询失败'),
          activeTaskId: null,
          isGlobalLoading: false
        });
      }
    };

    await poll();
  },

  // 生成大纲（同步操作，不需要轮询）
  generateOutline: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.generateOutline(currentProject.id!);
      console.log('[生成大纲] API响应:', response);
      
      // 刷新项目数据，确保获取最新的大纲页面
      await get().syncProject();
      
      // 再次确认数据已更新
      const { currentProject: updatedProject } = get();
      console.log('[生成大纲] 刷新后的项目:', updatedProject?.pages.length, '个页面');
    } catch (error: any) {
      console.error('[生成大纲] 错误:', error);
      set({ error: error.message || '生成大纲失败' });
      throw error;
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 从描述生成大纲和页面描述（同步操作）
  generateFromDescription: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.generateFromDescription(currentProject.id!);
      console.log('[从描述生成] API响应:', response);
      
      // 刷新项目数据，确保获取最新的大纲和描述
      await get().syncProject();
      
      // 再次确认数据已更新
      const { currentProject: updatedProject } = get();
      console.log('[从描述生成] 刷新后的项目:', updatedProject?.pages.length, '个页面');
    } catch (error: any) {
      console.error('[从描述生成] 错误:', error);
      set({ error: error.message || '从描述生成失败' });
      throw error;
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 生成描述（使用异步任务，实时显示进度）
  generateDescriptions: async () => {
    const { currentProject } = get();
    if (!currentProject || !currentProject.id) return;

    const pages = currentProject.pages.filter((p) => p.id);
    if (pages.length === 0) return;

    set({ error: null });
    
    // 标记所有页面为生成中
    const initialTasks: Record<string, boolean> = {};
    pages.forEach((page) => {
      if (page.id) {
        initialTasks[page.id] = true;
      }
    });
    set({ pageDescriptionGeneratingTasks: initialTasks });
    
    try {
      // 调用批量生成接口，返回 task_id
      const projectId = currentProject.id;
      if (!projectId) {
        throw new Error('项目ID不存在');
      }
      
      const response = await api.generateDescriptions(projectId);
      const taskId = response.data?.task_id;
      
      if (!taskId) {
        throw new Error('未收到任务ID');
      }
      
      // 启动轮询任务状态和定期同步项目数据
      const pollAndSync = async () => {
        try {
          // 轮询任务状态
          const taskResponse = await api.getTaskStatus(projectId, taskId);
          const task = taskResponse.data;
          
          if (task) {
            // 更新进度
            if (task.progress) {
              set({ taskProgress: task.progress });
            }
            
            // 同步项目数据以获取最新的页面状态
            await get().syncProject();
            
            // 根据项目数据更新每个页面的生成状态
            const { currentProject: updatedProject } = get();
            if (updatedProject) {
              const updatedTasks: Record<string, boolean> = {};
              updatedProject.pages.forEach((page) => {
                if (page.id) {
                  // 如果页面已有描述，说明已完成
                  const hasDescription = !!page.description_content;
                  // 如果状态是 GENERATING 或还没有描述，说明还在生成中
                  const isGenerating = page.status === 'GENERATING' || 
                                      (!hasDescription && initialTasks[page.id]);
                  if (isGenerating) {
                    updatedTasks[page.id] = true;
                  }
                }
              });
              set({ pageDescriptionGeneratingTasks: updatedTasks });
            }
            
            // 检查任务是否完成
            if (task.status === 'COMPLETED') {
              // 清除所有生成状态
              set({ 
                pageDescriptionGeneratingTasks: {},
                taskProgress: null,
                activeTaskId: null
              });
              // 最后同步一次确保数据最新
              await get().syncProject();
            } else if (task.status === 'FAILED') {
              // 任务失败
              set({ 
                pageDescriptionGeneratingTasks: {},
                taskProgress: null,
                activeTaskId: null,
                error: normalizeErrorMessage(task.error_message || task.error || '生成描述失败')
              });
            } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
              // 继续轮询
              setTimeout(pollAndSync, 2000);
            }
          }
        } catch (error: any) {
          console.error('[生成描述] 轮询错误:', error);
          // 即使轮询出错，也继续尝试同步项目数据
          await get().syncProject();
          setTimeout(pollAndSync, 2000);
        }
      };
      
      // 开始轮询
      setTimeout(pollAndSync, 2000);
      
    } catch (error: any) {
      console.error('[生成描述] 启动任务失败:', error);
      set({ 
        pageDescriptionGeneratingTasks: {},
        error: normalizeErrorMessage(error.message || '启动生成任务失败')
      });
      throw error;
    }
  },

  // 生成单页描述
  generatePageDescription: async (pageId: string) => {
    const { currentProject, pageDescriptionGeneratingTasks } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    if (pageDescriptionGeneratingTasks[pageId]) {
      console.log(`[生成描述] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null });
    
    // 标记为生成中
    set({
      pageDescriptionGeneratingTasks: {
        ...pageDescriptionGeneratingTasks,
        [pageId]: true,
      },
    });

    try {
      // 立即同步一次项目数据，以更新页面状态
      await get().syncProject();
      
      // 传递 force_regenerate=true 以允许重新生成已有描述
      await api.generatePageDescription(currentProject.id, pageId, true);
      
      // 刷新项目数据
      await get().syncProject();
    } catch (error: any) {
      set({ error: normalizeErrorMessage(error.message || '生成描述失败') });
      throw error;
    } finally {
      // 清除生成状态
      const { pageDescriptionGeneratingTasks: currentTasks } = get();
      const newTasks = { ...currentTasks };
      delete newTasks[pageId];
      set({ pageDescriptionGeneratingTasks: newTasks });
    }
  },

  // 生成图片
  generateImages: async () => {
    const { currentProject, startAsyncTask } = get();
    if (!currentProject) return;

    await startAsyncTask(() => api.generateImages(currentProject.id));
  },

  // 生成单页图片（异步）
  generatePageImage: async (pageId, forceRegenerate = false) => {
    const { currentProject, pageGeneratingTasks } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[pageId]) {
      console.log(`[生成] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null });
    try {
      const response = await api.generatePageImage(currentProject.id, pageId, forceRegenerate);
      const taskId = response.data?.task_id;
      
      if (taskId) {
        // 记录该页面的任务ID
        set({ 
          pageGeneratingTasks: { ...pageGeneratingTasks, [pageId]: taskId }
        });
        
        // 立即同步一次项目数据，以获取后端设置的'GENERATING'状态
        await get().syncProject();
        
        // 开始轮询该页面的任务状态
        await get().pollPageTask(pageId, taskId);
      } else {
        // 如果没有返回task_id，可能是同步接口，直接刷新
        await get().syncProject();
      }
    } catch (error: any) {
      // 清除该页面的任务记录
      const { pageGeneratingTasks } = get();
      const newTasks = { ...pageGeneratingTasks };
      delete newTasks[pageId];
      set({ pageGeneratingTasks: newTasks, error: normalizeErrorMessage(error.message || '生成图片失败') });
      throw error;
    }
  },

  // 轮询单个页面的任务状态
  pollPageTask: async (pageId: string, taskId: string) => {
    const { currentProject } = get();
    if (!currentProject) {
      console.warn('[轮询] 没有当前项目，停止轮询');
      return;
    }

    const poll = async () => {
      try {
        const response = await api.getTaskStatus(currentProject.id!, taskId);
        const task = response.data;
        
        if (!task) {
          console.warn('[轮询] 响应中没有任务数据');
          return;
        }

        console.log(`[轮询] Page ${pageId} Task ${taskId} 状态: ${task.status}`);

        // 检查任务状态
        if (task.status === 'COMPLETED') {
          console.log(`[轮询] Page ${pageId} 任务已完成，刷新项目数据`);
          // 清除该页面的任务记录
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          delete newTasks[pageId];
          set({ pageGeneratingTasks: newTasks });
          // 刷新项目数据
          await get().syncProject();
        } else if (task.status === 'FAILED') {
          console.error(`[轮询] Page ${pageId} 任务失败:`, task.error_message || task.error);
          // 清除该页面的任务记录
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          delete newTasks[pageId];
          set({ 
            pageGeneratingTasks: newTasks,
            error: normalizeErrorMessage(task.error_message || task.error || '生成失败')
          });
          // 刷新项目数据以更新页面状态
          await get().syncProject();
        } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
          // 继续轮询，同时同步项目数据以更新页面状态
          console.log(`[轮询] Page ${pageId} 处理中，同步项目数据...`);
          await get().syncProject();
          console.log(`[轮询] Page ${pageId} 处理中，2秒后继续轮询...`);
          setTimeout(poll, 2000);
        } else {
          // 未知状态，停止轮询
          console.warn(`[轮询] Page ${pageId} 未知状态: ${task.status}，停止轮询`);
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          delete newTasks[pageId];
          set({ pageGeneratingTasks: newTasks });
        }
      } catch (error: any) {
        console.error('页面任务轮询错误:', error);
        // 清除该页面的任务记录
        const { pageGeneratingTasks } = get();
        const newTasks = { ...pageGeneratingTasks };
        delete newTasks[pageId];
        set({ pageGeneratingTasks: newTasks });
      }
    };

    await poll();
  },

  // 编辑页面图片（异步）
  editPageImage: async (pageId, editPrompt, contextImages) => {
    const { currentProject, pageGeneratingTasks } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[pageId]) {
      console.log(`[编辑] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null });
    try {
      const response = await api.editPageImage(currentProject.id, pageId, editPrompt, contextImages);
      const taskId = response.data?.task_id;
      
      if (taskId) {
        // 记录该页面的任务ID
        set({ 
          pageGeneratingTasks: { ...pageGeneratingTasks, [pageId]: taskId }
        });
        
        // 立即同步一次项目数据，以获取后端设置的'GENERATING'状态
        await get().syncProject();
        
        // 开始轮询该页面的任务状态
        await get().pollPageTask(pageId, taskId);
      } else {
        // 如果没有返回task_id，可能是同步接口，直接刷新
        await get().syncProject();
      }
    } catch (error: any) {
      // 清除该页面的任务记录
      const { pageGeneratingTasks } = get();
      const newTasks = { ...pageGeneratingTasks };
      delete newTasks[pageId];
      set({ pageGeneratingTasks: newTasks, error: normalizeErrorMessage(error.message || '编辑图片失败') });
      throw error;
    }
  },

  // 导出PPTX
  exportPPTX: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.exportPPTX(currentProject.id);
      // 优先使用相对路径，避免 Docker 环境下的端口问题
      const downloadUrl =
        response.data?.download_url || response.data?.download_url_absolute;

      if (!downloadUrl) {
        throw new Error('导出链接获取失败');
      }

      // 使用浏览器直接下载链接，避免 axios 受带宽和超时影响
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      set({ error: error.message || '导出失败' });
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 导出PDF
  exportPDF: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.exportPDF(currentProject.id);
      // 优先使用相对路径，避免 Docker 环境下的端口问题
      const downloadUrl =
        response.data?.download_url || response.data?.download_url_absolute;

      if (!downloadUrl) {
        throw new Error('导出链接获取失败');
      }

      // 使用浏览器直接下载链接，避免 axios 受带宽和超时影响
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      set({ error: error.message || '导出失败' });
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 导出可编辑PPTX
  exportEditablePPTX: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.exportEditablePPTX(currentProject.id);
      // 优先使用相对路径，避免 Docker 环境下的端口问题
      const downloadUrl =
        response.data?.download_url || response.data?.download_url_absolute;

      if (!downloadUrl) {
        throw new Error('导出链接获取失败');
      }

      // 使用浏览器直接下载链接，避免 axios 受带宽和超时影响
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      set({ error: error.message || '导出可编辑PPTX失败' });
    } finally {
      set({ isGlobalLoading: false });
    }
  },
};});