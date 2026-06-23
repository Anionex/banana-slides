import { create } from 'zustand';
import type { Project, TemplateAsset, Task } from '@/types';
import * as api from '@/api/endpoints';
import {
  debounce,
  downloadFromUrl,
  normalizeProject,
  normalizeErrorMessage,
} from '@/utils';
import { devLog } from '@/utils/logger';
import { getT } from '@/utils/i18nHelper';

const storeI18n = {
  zh: {
    store: {
      createFailed: '创建项目失败',
      createNoId: '项目创建失败：未返回项目ID',
      syncFailed: '同步项目失败',
      projectNotFound: '项目不存在，可能已被删除',
      requestFailed: '请求失败',
      requestFailedStatus: '请求失败: {{status}}',
      networkError: '网络错误，请检查后端服务是否启动',
      updateOrderFailed: '更新顺序失败',
      newPage: '新页面',
      addPageFailed: '添加页面失败',
      deletePageFailed: '删除页面失败',
      taskStartFailed: '任务启动失败',
      taskFailed: '任务失败',
      unknownTaskStatus: '未知任务状态: {{status}}',
      taskQueryFailed: '任务查询失败',
      generateOutlineFailed: '生成大纲失败',
      generateFromDescFailed: '从描述生成失败',
      projectIdMissing: '项目ID不存在',
      noTaskId: '未收到任务ID',
      generateDescFailed: '生成描述失败',
      generateDescTimeout: '生成描述失败：轮询超时',
      startGenerationFailed: '启动生成任务失败',
      regenerateFailed: '重新生成失败',
      batchGenerateFailed: '批量生成失败',
      editImageFailed: '编辑图片失败',
      exportLinkFailed: '导出链接获取失败',
      exportFailed: '导出失败',
      exportEditableFailed: '导出可编辑PPTX失败',
    }
  },
  en: {
    store: {
      createFailed: 'Failed to create project',
      createNoId: 'Project creation failed: no project ID returned',
      syncFailed: 'Failed to sync project',
      projectNotFound: 'Project not found, it may have been deleted',
      requestFailed: 'Request failed',
      requestFailedStatus: 'Request failed: {{status}}',
      networkError: 'Network error, please check if the backend service is running',
      updateOrderFailed: 'Failed to update page order',
      newPage: 'New Page',
      addPageFailed: 'Failed to add page',
      deletePageFailed: 'Failed to delete page',
      taskStartFailed: 'Failed to start task',
      taskFailed: 'Task failed',
      unknownTaskStatus: 'Unknown task status: {{status}}',
      taskQueryFailed: 'Failed to query task',
      generateOutlineFailed: 'Failed to generate outline',
      generateFromDescFailed: 'Failed to generate from description',
      projectIdMissing: 'Project ID not found',
      noTaskId: 'No task ID received',
      generateDescFailed: 'Failed to generate description',
      generateDescTimeout: 'Failed to generate description: polling timeout',
      startGenerationFailed: 'Failed to start generation task',
      regenerateFailed: 'Failed to regenerate',
      batchGenerateFailed: 'Batch generation failed',
      editImageFailed: 'Failed to edit image',
      exportLinkFailed: 'Failed to get export link',
      exportFailed: 'Export failed',
      exportEditableFailed: 'Failed to export editable PPTX',
    }
  }
};
const t = getT(storeI18n);

// 清理旧原型遗留的 per-project localStorage key（交接文档 §3：旧 demo 数据不迁移）。
// 模块加载时执行一次，把废弃的模板相关 key 直接删除。
(function cleanupLegacyTemplateLocalStorageKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const legacyPrefixes = ['template_mode_', 'template_assets_', 'page_template_assign_'];
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && legacyPrefixes.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage 不可用时静默跳过
  }
})();

interface ProjectState {
  // 状态
  currentProject: Project | null;
  isGlobalLoading: boolean;
  activeTaskId: string | null;
  taskProgress: { total: number; completed: number } | null;
  error: string | null;
  // 每个页面的生成任务ID映射 (pageId -> taskId)
  pageGeneratingTasks: Record<string, string>;
  // 警告消息
  warningMessage: string | null;
  // 流式大纲生成中
  isOutlineStreaming: boolean;
  // 流式描述生成中
  isDescriptionStreaming: boolean;
  // 项目模板库（per-page template）
  templateAssets: TemplateAsset[];

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setGlobalLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 项目操作
  initializeProject: (type: 'idea' | 'outline' | 'description', content: string, templateImage?: File, templateStyle?: string, referenceFileIds?: string[], aspectRatio?: string) => Promise<void>;
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
  pollImageTask: (taskId: string, pageIds: string[]) => void;

  // 生成操作
  generateOutline: () => Promise<void>;
  generateOutlineStream: () => Promise<{ complete: boolean } | undefined>;
  generateFromDescription: () => Promise<void>;
  generateDescriptions: (detailLevel?: string) => Promise<void>;
  generatePageDescription: (pageId: string, detailLevel?: string) => Promise<void>;
  regenerateRenovationPage: (pageId: string, keepLayout?: boolean) => Promise<void>;
  generatePageImage: (pageId: string, forceRegenerate?: boolean) => Promise<void>;
  generateImages: (pageIds?: string[]) => Promise<void>;
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
  exportPPTX: (pageIds?: string[]) => Promise<void>;
  exportPDF: (pageIds?: string[]) => Promise<void>;
  exportEditablePPTX: (filename?: string, pageIds?: string[]) => Promise<void>;

  // 每页模板（per-page template）
  loadTemplateAssets: (projectId: string) => Promise<TemplateAsset[]>;
  uploadTemplateAsset: (projectId: string, file: File, opts?: { userLabel?: string; bindToPageId?: string }) => Promise<TemplateAsset>;
  uploadTemplatePdf: (projectId: string, file: File) => Promise<string>;
  updateTemplateAsset: (projectId: string, assetId: string, patch: { user_label?: string | null; analysis_json?: TemplateAsset['analysis_json']; analysis_notes?: string | null; sort_order?: number }) => Promise<TemplateAsset>;
  deleteTemplateAsset: (projectId: string, assetId: string) => Promise<string[]>;
  reanalyzeTemplateAsset: (projectId: string, assetId: string) => Promise<string>;
  updatePageTemplate: (projectId: string, pageId: string, patch: { template_asset_id?: string | null; template_style_text?: string | null; selection_source?: 'manual' | 'auto' | 'batch_apply' }) => Promise<void>;
  switchTemplateMode: (projectId: string, payload: { mode: 'multi' } | { mode: 'single'; unified_asset_id?: string | null; unified_style_text?: string | null }) => Promise<void>;
  switchTemplateModeWithUpload: (projectId: string, file: File, unifiedStyleText?: string) => Promise<void>;
  autoMatchAll: (projectId: string, opts?: { overwrite_existing?: boolean; preserve_non_empty?: boolean }) => Promise<string>;
  autoMatchPage: (projectId: string, pageId: string) => Promise<string>;
  pollTemplateTask: (taskId: string, projectId: string, onProgress?: (task: Task) => void) => Promise<Task>;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  // 防抖的API更新函数（在store内部定义，以便访问syncProject）
const debouncedUpdatePage = debounce(
  async (projectId: string, pageId: string, data: any) => {
      try {
    const promises: Promise<any>[] = [];

    // 如果更新的是 description_content，使用专门的端点
    if (data.description_content) {
      promises.push(api.updatePageDescription(projectId, pageId, data.description_content));
    }

    // 如果更新的是 outline_content，使用专门的端点
    if (data.outline_content) {
      promises.push(api.updatePageOutline(projectId, pageId, data.outline_content));
    }

    // 如果更新的是 part 字段，使用通用端点
    if ('part' in data) {
      promises.push(api.updatePage(projectId, pageId, { part: data.part }));
    }

    // 如果没有特定的内容更新，使用通用端点
    if (promises.length === 0) {
      await api.updatePage(projectId, pageId, data);
    } else {
      // 并行执行所有更新请求
      await Promise.all(promises);
    }
        
        // API调用成功后，同步项目状态以更新updated_at
        // 图片生成期间 poll 已在 2s 同步，跳过以避免并发竞态
        const { syncProject, pageGeneratingTasks } = get();
        if (Object.keys(pageGeneratingTasks).length === 0) {
          await syncProject(projectId);
        }
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
  warningMessage: null,
  isOutlineStreaming: false,
  isDescriptionStreaming: false,
  templateAssets: [],

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
  setError: (error) => set({ error }),

  // 初始化项目
  initializeProject: async (type, content, templateImage, templateStyle, referenceFileIds, aspectRatio) => {
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

      // 添加风格描述（如果有）
      if (templateStyle && templateStyle.trim()) {
        request.template_style = templateStyle.trim();
      }

      // 添加画面比例（如果有）
      if (aspectRatio) {
        request.image_aspect_ratio = aspectRatio;
      }

      // 1. 创建项目
      const response = await api.createProject(request);
      const projectId = response.data?.project_id;

      if (!projectId) {
        throw new Error(t('store.createNoId'));
      }

      // 2. 关联参考文件到项目（在生成之前，确保 AI 能读取参考文件）
      if (referenceFileIds && referenceFileIds.length > 0) {
        try {
          await Promise.all(
            referenceFileIds.map(fileId => api.associateFileToProject(fileId, projectId))
          );
          devLog(`[初始化项目] 已关联 ${referenceFileIds.length} 个参考文件`);
        } catch (error) {
          console.warn('[初始化项目] 关联参考文件失败:', error);
        }
      }

      // 3. 如果有模板图片，上传模板
      if (templateImage) {
        try {
          await api.uploadTemplate(projectId, templateImage);
        } catch (error) {
          console.warn('模板上传失败:', error);
          // 模板上传失败不影响项目创建，继续执行
        }
      }

      // 4. 获取完整项目信息。大纲/描述入口的 AI 生成由大纲页的 SSE 流程接管。
      const projectResponse = await api.getProject(projectId);
      const project = normalizeProject(projectResponse.data);

      if (project) {
        set({ currentProject: project });
        // 保存到 localStorage
        localStorage.setItem('currentProjectId', project.id!);
      }
    } catch (error: any) {
      set({ error: normalizeErrorMessage(error.message || t('store.createFailed')) });
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
        devLog('[syncProject] 同步项目数据:', {
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
      let errorMessage = t('store.syncFailed');
      let shouldClearStorage = false;
      
      if (error.response) {
        // 服务器返回了错误响应
        const errorData = error.response.data;
        if (error.response.status === 404) {
          // 404错误：项目不存在，清除localStorage
          errorMessage = errorData?.error?.message || t('store.projectNotFound');
          shouldClearStorage = true;
        } else if (errorData?.error?.message) {
          // 从后端错误格式中提取消息
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.error) {
          errorMessage = typeof errorData.error === 'string' ? errorData.error : errorData.error.message || t('store.requestFailed');
        } else {
          errorMessage = t('store.requestFailedStatus', { status: error.response.status });
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorMessage = t('store.networkError');
      } else if (error.message) {
        // 其他错误
        errorMessage = error.message;
      }
      
      // 如果项目不存在，清除localStorage并重置当前项目
      // 不显示错误toast，因为这通常是自动同步时发现的过期项目ID
      if (shouldClearStorage) {
        console.warn('[syncProject] 项目不存在，清除localStorage');
        localStorage.removeItem('currentProjectId');
        set({ currentProject: null });
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
      set({ error: error.message || t('store.updateOrderFailed') });
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
        outline_content: { title: t('store.newPage'), points: [] },
        order_index: currentProject.pages.length,
      };

      const response = await api.addPage(currentProject.id, newPage);
      if (response.data) {
        await get().syncProject();
      }
    } catch (error: any) {
      set({ error: error.message || t('store.addPageFailed') });
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
      set({ error: error.message || t('store.deletePageFailed') });
    }
  },

  // 启动异步任务
  startAsyncTask: async (apiCall) => {
    devLog('[异步任务] 启动异步任务...');
    set({ isGlobalLoading: true, error: null });
    try {
      const response = await apiCall();
      devLog('[异步任务] API响应:', response);
      
      // task_id 在 response.data 中
      const taskId = response.data?.task_id;
      if (taskId) {
        devLog('[异步任务] 收到task_id:', taskId, '开始轮询...');
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
      set({ error: error.message || t('store.taskStartFailed'), isGlobalLoading: false });
      throw error;
    }
  },

  // 轮询任务状态
  pollTask: async (taskId) => {
    devLog(`[轮询] 开始轮询任务: ${taskId}`);
    const { currentProject } = get();
    if (!currentProject) {
      console.warn('[轮询] 没有当前项目，停止轮询');
      return;
    }
    const projectId = currentProject.id!;

    const poll = async () => {
      try {
        devLog(`[轮询] 查询任务状态: ${taskId}`);
        const response = await api.getTaskStatus(projectId, taskId);
        const task = response.data;
        
        if (!task) {
          console.warn('[轮询] 响应中没有任务数据');
          return;
        }

        // 更新进度
        if (task.progress) {
          set({ taskProgress: task.progress });
        }

        devLog(`[轮询] Task ${taskId} 状态: ${task.status}`, task);

        // 检查任务状态
        if (task.status === 'COMPLETED') {
          devLog(`[轮询] Task ${taskId} 已完成，刷新项目数据`);
          
          // 如果是导出可编辑PPTX任务，检查是否有下载链接
          if (task.task_type === 'EXPORT_EDITABLE_PPTX' && task.progress) {
            const progress = typeof task.progress === 'string' 
              ? JSON.parse(task.progress) 
              : task.progress;
            
            const downloadUrl = progress?.download_url;
            if (downloadUrl) {
              devLog('[导出可编辑PPTX] 从任务响应中获取下载链接:', downloadUrl);
              // 延迟一下，确保状态更新完成后再打开下载链接
              setTimeout(() => {
                window.open(downloadUrl, '_blank');
              }, 500);
            } else {
              console.warn('[导出可编辑PPTX] 任务完成但没有下载链接');
            }
          }
          
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
            error: normalizeErrorMessage(task.error_message || task.error || t('store.taskFailed')),
            activeTaskId: null,
            taskProgress: null,
            isGlobalLoading: false
          });
        } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
          // 继续轮询（PENDING 或 PROCESSING）
          devLog(`[轮询] Task ${taskId} 处理中，2秒后继续轮询...`);
          setTimeout(poll, 2000);
        } else {
          // 未知状态，停止轮询
          console.warn(`[轮询] Task ${taskId} 未知状态: ${task.status}，停止轮询`);
          set({ 
            error: `${t('store.unknownTaskStatus', { status: task.status })}`,
            activeTaskId: null,
            taskProgress: null,
            isGlobalLoading: false
          });
        }
      } catch (error: any) {
        console.error('任务轮询错误:', error);
        set({ 
          error: normalizeErrorMessage(error.message || t('store.taskQueryFailed')),
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
      devLog('[生成大纲] API响应:', response);
      
      // 刷新项目数据，确保获取最新的大纲页面
      await get().syncProject();
      
      // 再次确认数据已更新
      const { currentProject: updatedProject } = get();
      devLog('[生成大纲] 刷新后的项目:', updatedProject?.pages.length, '个页面');
    } catch (error: any) {
      console.error('[生成大纲] 错误:', error);
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        t('store.generateOutlineFailed');
      set({ error: normalizeErrorMessage(message) });
      throw error;
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 流式生成大纲（SSE，逐页渲染）
  generateOutlineStream: async (lockPageCount?: boolean) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isOutlineStreaming: true, error: null });

    // Clear existing pages for fresh streaming display
    set({
      currentProject: { ...currentProject, pages: [] },
    });

    // Concurrent queue: pages are pushed by SSE callbacks, drained by a timer loop
    const pageQueue: any[] = [];
    let streamDone = false;
    let doneData: { total: number; pages: any[]; complete?: boolean } | null = null;
    const STAGGER_MS = 150;

    // Start the render loop — runs concurrently with the SSE stream
    const renderPromise = new Promise<void>((resolve) => {
      const tick = () => {
        if (pageQueue.length > 0) {
          const page = pageQueue.shift()!;
          const { currentProject: proj } = get();
          if (proj) {
            const tempPage: any = {
              id: `streaming-${page.index}`,
              order_index: page.index,
              outline_content: { title: page.title, points: page.points },
              description_content: page.description_text
                ? { text: page.description_text, ...(page.extra_fields ? { extra_fields: page.extra_fields } : {}) }
                : undefined,
              part: page.part,
              status: page.description_text ? 'DESCRIPTION_GENERATED' : 'DRAFT',
            };
            set({
              currentProject: { ...proj, pages: [...proj.pages, tempPage] },
            });
          }
          setTimeout(tick, STAGGER_MS);
        } else if (streamDone) {
          resolve();
        } else {
          // Queue empty but stream still going — poll quickly
          setTimeout(tick, 30);
        }
      };
      tick();
    });

    try {
      await api.generateOutlineStream(currentProject.id!, {
        onPage: (page) => { pageQueue.push(page); },
        onDone: (data) => { doneData = data; },
        onError: (message) => {
          console.error('[流式大纲] 错误:', message);
          set({ error: normalizeErrorMessage(message), isOutlineStreaming: false });
          streamDone = true;
        },
      }, undefined /* language */, lockPageCount);

      streamDone = true;
      await renderPromise;

      // Replace temp pages with real persisted pages
      if (doneData) {
        const { currentProject: proj } = get();
        if (proj) {
          const normalized = normalizeProject({ ...proj, pages: doneData.pages });
          set({ currentProject: normalized, isOutlineStreaming: false });
        }
        devLog('[流式大纲] 完成:', doneData.total, '个页面');
        return { complete: doneData.complete ?? false };
      } else {
        set({ isOutlineStreaming: false });
        return { complete: false };
      }
    } catch (error: any) {
      console.error('[流式大纲] 错误:', error);
      streamDone = true;
      set({
        error: normalizeErrorMessage(error.message || t('store.generateOutlineFailed')),
        isOutlineStreaming: false,
      });
      throw error;
    }
  },

  // 从描述生成大纲和页面描述（同步操作）
  generateFromDescription: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.generateFromDescription(currentProject.id!);
      devLog('[从描述生成] API响应:', response);
      
      // 刷新项目数据，确保获取最新的大纲和描述
      await get().syncProject();
      
      // 再次确认数据已更新
      const { currentProject: updatedProject } = get();
      devLog('[从描述生成] 刷新后的项目:', updatedProject?.pages.length, '个页面');
    } catch (error: any) {
      console.error('[从描述生成] 错误:', error);
      set({ error: error.message || t('store.generateFromDescFailed') });
      throw error;
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 生成描述（根据设置选择流式或并行模式）
  generateDescriptions: async (detailLevel?: string) => {
    const { currentProject } = get();
    if (!currentProject || !currentProject.id) return;

    const pages = currentProject.pages.filter((p) => p.id);
    if (pages.length === 0) return;

    // 检查描述生成模式，优先从 sessionStorage 缓存读取以避免额外 API 调用
    let mode: string = 'streaming';
    try {
      const cached = sessionStorage.getItem('banana-settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.description_generation_mode) {
          mode = parsed.description_generation_mode;
        }
      }
    } catch { /* ignore */ }

    if (mode === 'streaming') {
      // 流式模式
      set({ isDescriptionStreaming: true, error: null });

      const updatedPages = currentProject.pages.map((page) =>
        page.id ? { ...page, status: 'GENERATING_DESCRIPTION' as const } : page
      );
      set({ currentProject: { ...currentProject, pages: updatedPages } });

      // Concurrent queue + render loop (like outline streaming)
      const descQueue: api.DescriptionStreamEvent[] = [];
      let streamDone = false;
      let doneData: { total: number; pages: any[]; warning?: string } | null = null;
      const STAGGER_MS = 100;

      const renderPromise = new Promise<void>((resolve) => {
        const tick = () => {
          if (descQueue.length > 0) {
            const desc = descQueue.shift()!;
            const { currentProject: proj } = get();
            if (proj) {
              const updatedPages = proj.pages.map((page) => {
                if (page.id === desc.page_id) {
                  return {
                    ...page,
                    status: 'DESCRIPTION_GENERATED' as const,
                    description_content: {
                      text: desc.text,
                      ...(desc.extra_fields ? { extra_fields: desc.extra_fields } : {}),
                    },
                  };
                }
                return page;
              });
              set({ currentProject: { ...proj, pages: updatedPages } });
            }
            setTimeout(tick, STAGGER_MS);
          } else if (streamDone) {
            resolve();
          } else {
            setTimeout(tick, 30);
          }
        };
        tick();
      });

      try {
        await api.generateDescriptionsStream(currentProject.id, {
          onDescription: (data) => { descQueue.push(data); },
          onDone: (data) => { doneData = data; },
          onError: (message) => {
            console.error('[流式描述] 错误:', message);
            set({ error: normalizeErrorMessage(message) });
            streamDone = true;
          },
        }, undefined, detailLevel);

        streamDone = true;
        await renderPromise;

        if (doneData) {
          const { currentProject: proj } = get();
          if (proj) {
            const normalized = normalizeProject({ ...proj, pages: doneData.pages });
            set({
              currentProject: normalized,
              isDescriptionStreaming: false,
              ...(doneData.warning ? { error: doneData.warning } : {}),
            });
          }
          devLog('[流式描述] 完成:', doneData.total, '个页面');
        } else {
          // 无 doneData（SSE error 或连接中断）→ 从后端恢复真实状态
          await get().syncProject();
          set({ isDescriptionStreaming: false });
        }
      } catch (error: any) {
        console.error('[流式描述] 错误:', error);
        streamDone = true;
        await get().syncProject();
        set({
          error: normalizeErrorMessage(error.message || t('store.generateDescFailed')),
          isDescriptionStreaming: false,
        });
        throw error;
      }
    } else {
      // 并行模式（原有逻辑）
      set({ error: null });

      const updatedPages = currentProject.pages.map((page) =>
        page.id ? { ...page, status: 'GENERATING_DESCRIPTION' as const } : page
      );
      set({ currentProject: { ...currentProject, pages: updatedPages } });

      try {
        const projectId = currentProject.id;
        if (!projectId) {
          throw new Error(t('store.projectIdMissing'));
        }

        const response = await api.generateDescriptions(projectId, undefined, detailLevel);
        const taskId = response.data?.task_id;

        if (!taskId) {
          throw new Error(t('store.noTaskId'));
        }

        let pollErrors = 0;
        const pollAndSync = async () => {
          try {
            const taskResponse = await api.getTaskStatus(projectId, taskId);
            const task = taskResponse.data;

            if (task) {
              if (task.progress) {
                set({ taskProgress: task.progress });
              }

              await get().syncProject();

              if (task.status === 'COMPLETED') {
                set({ taskProgress: null, activeTaskId: null });
                await get().syncProject();
              } else if (task.status === 'FAILED') {
                set({
                  taskProgress: null,
                  activeTaskId: null,
                  error: normalizeErrorMessage(task.error_message || task.error || t('store.generateDescFailed'))
                });
                await get().syncProject();
              } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
                setTimeout(pollAndSync, 2000);
              }
            }
          } catch (error: any) {
            console.error('[生成描述] 轮询错误:', error);
            pollErrors++;
            if (pollErrors >= 10) {
              console.error('[生成描述] 轮询错误次数过多，停止轮询');
              set({
                taskProgress: null,
                activeTaskId: null,
                error: normalizeErrorMessage(error.message || t('store.generateDescTimeout'))
              });
              await get().syncProject();
              return;
            }
            await get().syncProject();
            setTimeout(pollAndSync, 2000);
          }
        };

        setTimeout(pollAndSync, 2000);

      } catch (error: any) {
        console.error('[生成描述] 启动任务失败:', error);
        await get().syncProject();
        set({ error: normalizeErrorMessage(error.message || t('store.startGenerationFailed')) });
        throw error;
      }
    }
  },

  // 生成单页描述
  generatePageDescription: async (pageId: string, detailLevel?: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    const targetPage = currentProject.pages.find((p) => p.id === pageId);
    if (targetPage?.status === 'GENERATING_DESCRIPTION') {
      devLog(`[生成描述] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null });

    // 乐观更新：设置页面状态为 GENERATING_DESCRIPTION
    const updatedPages = currentProject.pages.map((page) =>
      page.id === pageId ? { ...page, status: 'GENERATING_DESCRIPTION' as const } : page
    );
    set({ currentProject: { ...currentProject, pages: updatedPages } });

    try {
      const response = await api.generatePageDescription(currentProject.id, pageId, true, undefined, detailLevel);

      if (response.data) {
        const updatedPageData = response.data;
        const { currentProject: latestProject } = get();
        if (latestProject) {
          const newPages = latestProject.pages.map((page) =>
            page.id === pageId ? { ...page, ...updatedPageData } : page
          );
          set({ currentProject: { ...latestProject, pages: newPages } });
          devLog(`[生成描述] 页面 ${pageId} 描述已更新，数据来自 API 响应`);
        }
      }
    } catch (error: any) {
      // 恢复页面状态
      await get().syncProject();
      set({ error: normalizeErrorMessage(error.message || t('store.generateDescFailed')) });
      throw error;
    }
  },

  // 重新生成 PPT 翻新项目的单页（重新解析原 PDF 并提取内容）
  regenerateRenovationPage: async (pageId: string, keepLayout: boolean = false) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    const targetPage = currentProject.pages.find((p) => p.id === pageId);
    if (targetPage?.status === 'GENERATING_DESCRIPTION') {
      devLog(`[PPT翻新] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null });

    // 乐观更新：设置页面状态为 GENERATING_DESCRIPTION
    const updatedPages = currentProject.pages.map((page) =>
      page.id === pageId ? { ...page, status: 'GENERATING_DESCRIPTION' as const } : page
    );
    set({ currentProject: { ...currentProject, pages: updatedPages } });

    try {
      const response = await api.regenerateRenovationPage(currentProject.id, pageId, keepLayout);

      if (response.data) {
        const updatedPageData = response.data;
        const { currentProject: latestProject } = get();
        if (latestProject) {
          const newPages = latestProject.pages.map((page) =>
            page.id === pageId ? { ...page, ...updatedPageData } : page
          );
          set({ currentProject: { ...latestProject, pages: newPages } });
          devLog(`[PPT翻新] 页面 ${pageId} 大纲和描述已更新`);
        }
      }
    } catch (error: any) {
      await get().syncProject();
      set({ error: normalizeErrorMessage(error.message || t('store.regenerateFailed')) });
      throw error;
    }
  },

  // 生成单页图片（用于预览页的手动重新生成）
  generatePageImage: async (pageId: string, forceRegenerate: boolean = false) => {
    const { currentProject } = get();
    if (!currentProject) return;

    if (get().pageGeneratingTasks[pageId]) {
      devLog(`[单页生成] 页面 ${pageId} 正在生成中，跳过重复请求`);
      return;
    }

    set({ error: null, warningMessage: null });

    try {
      const response = await api.generatePageImage(currentProject.id, pageId, forceRegenerate);
      const taskId = response.data?.task_id;

      if (taskId) {
        devLog(`[单页生成] 收到 task_id: ${taskId}，开始轮询页面 ${pageId}`);
        set((state) => ({
          pageGeneratingTasks: {
            ...state.pageGeneratingTasks,
            [pageId]: taskId,
          },
        }));

        await get().syncProject();
        get().pollImageTask(taskId, [pageId]);
      } else {
        await get().syncProject();
      }
    } catch (error: any) {
      console.error('[单页生成] 启动失败:', error);
      await get().syncProject();
      throw error;
    }
  },

  // 生成图片（非阻塞，每个页面显示生成状态）
  generateImages: async (pageIds?: string[]) => {
    const { currentProject, pageGeneratingTasks } = get();
    if (!currentProject) return;

    // 确定要生成的页面ID列表
    const targetPageIds = pageIds || currentProject.pages.map(p => p.id).filter((id): id is string => !!id);
    
    // 检查是否有页面正在生成
    const alreadyGenerating = targetPageIds.filter(id => pageGeneratingTasks[id]);
    if (alreadyGenerating.length > 0) {
      devLog(`[批量生成] ${alreadyGenerating.length} 个页面正在生成中，跳过`);
      // 过滤掉已经在生成的页面
      const newPageIds = targetPageIds.filter(id => !pageGeneratingTasks[id]);
      if (newPageIds.length === 0) {
        devLog('[批量生成] 所有页面都在生成中，跳过请求');
        return;
      }
    }

    set({ error: null, warningMessage: null });
    
    try {
      // 调用批量生成 API
      const response = await api.generateImages(currentProject.id, undefined, pageIds);
      const taskId = response.data?.task_id;
      
      if (taskId) {
        devLog(`[批量生成] 收到 task_id: ${taskId}，标记 ${targetPageIds.length} 个页面为生成中`);
        
        // 为所有目标页面设置任务ID
        const newPageGeneratingTasks = { ...pageGeneratingTasks };
        targetPageIds.forEach(id => {
          newPageGeneratingTasks[id] = taskId;
        });
        set({ pageGeneratingTasks: newPageGeneratingTasks });
        
        // 立即同步一次项目数据，以获取后端设置的 'QUEUED' 状态
        await get().syncProject();

        // 开始轮询批量任务状态（非阻塞）
        get().pollImageTask(taskId, targetPageIds);
      } else {
        // 如果没有返回 task_id，可能是同步接口，直接刷新
        await get().syncProject();
      }
    } catch (error: any) {
      console.error('[批量生成] 启动失败:', error);
      throw error;
    }
  },

  // 轮询图片生成任务（非阻塞，支持单页和批量）
  pollImageTask: async (taskId: string, pageIds: string[]) => {
    const { currentProject } = get();
    if (!currentProject) {
      console.warn('[批量轮询] 没有当前项目，停止轮询');
      return;
    }
    const projectId = currentProject.id!;

    const poll = async () => {
      try {
        const response = await api.getTaskStatus(projectId, taskId);
        const task = response.data;
        
        if (!task) {
          console.warn('[批量轮询] 响应中没有任务数据');
          return;
        }

        devLog(`[批量轮询] Task ${taskId} 状态: ${task.status}`, task.progress);

        // 检查任务状态
        if (task.status === 'COMPLETED') {
          devLog(`[批量轮询] Task ${taskId} 已完成，清除任务记录`);
          // 清除所有相关页面的任务记录
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          pageIds.forEach(id => {
            if (newTasks[id] === taskId) {
              delete newTasks[id];
            }
          });
          
          // 提取警告消息（如果有）
          const warningMessage = task.progress?.warning_message || null;
          
          set({ pageGeneratingTasks: newTasks, warningMessage });

          // 刷新项目数据，并验证图片路径已更新
          // 使用重试机制确保数据同步完成
          let retryCount = 0;
          const maxRetries = 5;
          const retryDelay = 1000; // 1秒

          const syncWithRetry = async (): Promise<void> => {
            await get().syncProject();

            // 验证所有页面的图片路径是否已更新
            const { currentProject: updatedProject } = get();
            if (updatedProject) {
              const allImagesReady = pageIds.every(pageId => {
                const page = updatedProject.pages.find(p => p.id === pageId);
                return page?.generated_image_path;
              });

              if (allImagesReady) {
                devLog(`[批量轮询] 所有图片路径已同步`);
                return;
              }

              if (retryCount < maxRetries) {
                retryCount++;
                devLog(`[批量轮询] 图片路径尚未完全同步，${retryDelay}ms 后重试 (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return syncWithRetry();
              } else {
                console.warn(`[批量轮询] 达到最大重试次数，部分图片路径可能未同步`);
              }
            }
          };

          await syncWithRetry();
        } else if (task.status === 'FAILED') {
          console.error(`[批量轮询] Task ${taskId} 失败:`, task.error_message || task.error);
          // 清除所有相关页面的任务记录
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          pageIds.forEach(id => {
            if (newTasks[id] === taskId) {
              delete newTasks[id];
            }
          });
          set({ 
            pageGeneratingTasks: newTasks,
            error: normalizeErrorMessage(task.error_message || task.error || t('store.batchGenerateFailed'))
          });
          // 刷新项目数据以更新页面状态
          await get().syncProject();
        } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
          // 检查警告消息
          const newWarning = task.progress?.warning_message;
          if (newWarning && get().warningMessage !== newWarning) {
            set({ warningMessage: newWarning });
          }
          // 继续轮询，同时同步项目数据以更新页面状态
          devLog(`[批量轮询] Task ${taskId} 处理中，同步项目数据...`);
          await get().syncProject();

          // 逐个释放已完成的页面，让缩略图立刻显示
          const { currentProject: proj, pageGeneratingTasks: pgt } = get();
          if (proj) {
            const updated = { ...pgt };
            let changed = false;
            pageIds.forEach(id => {
              if (updated[id] === taskId) {
                const page = proj.pages.find(p => p.id === id);
                // 只释放已完成或失败的页面，避免误释放尚未被线程池拾取的页面
                // （未拾取的页面仍为 DESCRIPTION_GENERATED，不应提前释放）
                if (page && (page.status === 'COMPLETED' || page.status === 'FAILED')) {
                  delete updated[id];
                  changed = true;
                }
              }
            });
            if (changed) set({ pageGeneratingTasks: updated });
          }

          devLog(`[批量轮询] Task ${taskId} 处理中，2秒后继续轮询...`);
          setTimeout(poll, 2000);
        } else {
          // 未知状态，停止轮询
          console.warn(`[批量轮询] Task ${taskId} 未知状态: ${task.status}，停止轮询`);
          const { pageGeneratingTasks } = get();
          const newTasks = { ...pageGeneratingTasks };
          pageIds.forEach(id => {
            if (newTasks[id] === taskId) {
              delete newTasks[id];
            }
          });
          set({ pageGeneratingTasks: newTasks });
        }
      } catch (error: any) {
        console.error('[批量轮询] 轮询错误:', error);
        // 清除所有相关页面的任务记录
        const { pageGeneratingTasks } = get();
        const newTasks = { ...pageGeneratingTasks };
        pageIds.forEach(id => {
          if (newTasks[id] === taskId) {
            delete newTasks[id];
          }
        });
        set({ pageGeneratingTasks: newTasks });
      }
    };

    // 开始轮询（不 await，立即返回让 UI 继续响应）
    poll();
  },

  // 编辑页面图片（异步）
  editPageImage: async (pageId, editPrompt, contextImages) => {
    const { currentProject, pageGeneratingTasks } = get();
    if (!currentProject) return;

    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[pageId]) {
      devLog(`[编辑] 页面 ${pageId} 正在生成中，跳过重复请求`);
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
        
        // 开始轮询（使用统一的轮询函数）
        get().pollImageTask(taskId, [pageId]);
      } else {
        // 如果没有返回task_id，可能是同步接口，直接刷新
        await get().syncProject();
      }
    } catch (error: any) {
      // 清除该页面的任务记录
      const { pageGeneratingTasks } = get();
      const newTasks = { ...pageGeneratingTasks };
      delete newTasks[pageId];
      set({ pageGeneratingTasks: newTasks, error: normalizeErrorMessage(error.message || t('store.editImageFailed')) });
      throw error;
    }
  },

  // 导出PPTX
  exportPPTX: async (pageIds?: string[]) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.exportPPTX(currentProject.id, pageIds);
      // 优先使用相对路径，避免 Docker 环境下的端口问题
      const downloadUrl =
        response.data?.download_url || response.data?.download_url_absolute;

      if (!downloadUrl) {
        throw new Error(t('store.exportLinkFailed'));
      }

      const filename = downloadUrl.split('/').pop()?.split('?')[0] || 'presentation.pptx';
      downloadFromUrl(downloadUrl, filename);
    } catch (error: any) {
      set({ error: error.message || t('store.exportFailed') });
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 导出PDF
  exportPDF: async (pageIds?: string[]) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isGlobalLoading: true, error: null });
    try {
      const response = await api.exportPDF(currentProject.id, pageIds);
      // 优先使用相对路径，避免 Docker 环境下的端口问题
      const downloadUrl =
        response.data?.download_url || response.data?.download_url_absolute;

      if (!downloadUrl) {
        throw new Error(t('store.exportLinkFailed'));
      }

      const filename = downloadUrl.split('/').pop()?.split('?')[0] || 'presentation.pdf';
      downloadFromUrl(downloadUrl, filename);
    } catch (error: any) {
      set({ error: error.message || t('store.exportFailed') });
    } finally {
      set({ isGlobalLoading: false });
    }
  },

  // 导出可编辑PPTX（异步任务）
  exportEditablePPTX: async (filename?: string, pageIds?: string[]) => {
    const { currentProject, startAsyncTask } = get();
    if (!currentProject) return;

    try {
      devLog('[导出可编辑PPTX] 启动异步导出任务...');
      // startAsyncTask 中的 pollTask 会在任务完成时自动处理下载
      await startAsyncTask(() => api.exportEditablePPTX(currentProject.id, filename, pageIds));
      devLog('[导出可编辑PPTX] 异步任务完成');
    } catch (error: any) {
      console.error('[导出可编辑PPTX] 导出失败:', error);
      set({ error: error.message || t('store.exportEditableFailed') });
    }
  },

  // ===== 每页模板（per-page template）=====

  loadTemplateAssets: async (projectId) => {
    const response = await api.listTemplateAssets(projectId);
    const assets = response.data?.assets || [];
    set({ templateAssets: assets });
    return assets;
  },

  uploadTemplateAsset: async (projectId, file, opts) => {
    const response = await api.uploadTemplateAsset(projectId, file, opts);
    const asset = response.data!.asset;
    set((state) => ({ templateAssets: [...state.templateAssets, asset] }));
    // 绑定到页面时同步本地 page 字段
    if (opts?.bindToPageId) {
      const { currentProject } = get();
      if (currentProject) {
        set({
          currentProject: {
            ...currentProject,
            pages: currentProject.pages.map((p) =>
              p.id === opts.bindToPageId
                ? { ...p, template_asset_id: asset.id, template_selection_source: 'manual' }
                : p
            ),
          },
        });
      }
    }
    return asset;
  },

  uploadTemplatePdf: async (projectId, file) => {
    const response = await api.uploadTemplatePdf(projectId, file);
    return response.data!.task_id;
  },

  updateTemplateAsset: async (projectId, assetId, patch) => {
    const response = await api.updateTemplateAsset(projectId, assetId, patch);
    const updated = response.data!.asset;
    set((state) => ({
      templateAssets: state.templateAssets.map((a) => (a.id === assetId ? updated : a)),
    }));
    return updated;
  },

  deleteTemplateAsset: async (projectId, assetId) => {
    const response = await api.deleteTemplateAsset(projectId, assetId);
    const clearedPageIds = response.data?.cleared_page_ids || [];
    set((state) => ({
      templateAssets: state.templateAssets.filter((a) => a.id !== assetId),
    }));
    // 乐观更新：把被清空的页面字段置空
    if (clearedPageIds.length > 0) {
      const { currentProject } = get();
      if (currentProject) {
        const cleared = new Set(clearedPageIds);
        set({
          currentProject: {
            ...currentProject,
            pages: currentProject.pages.map((p) =>
              p.id && cleared.has(p.id)
                ? { ...p, template_asset_id: null, template_selection_source: null }
                : p
            ),
          },
        });
      }
    }
    return clearedPageIds;
  },

  reanalyzeTemplateAsset: async (projectId, assetId) => {
    const response = await api.reanalyzeTemplateAsset(projectId, assetId);
    // 乐观更新：把该 asset 状态置 pending
    set((state) => ({
      templateAssets: state.templateAssets.map((a) =>
        a.id === assetId ? { ...a, analysis_status: 'pending', analysis_error: null } : a
      ),
    }));
    return response.data!.analyze_task_id;
  },

  updatePageTemplate: async (projectId, pageId, patch) => {
    const response = await api.updatePageTemplate(projectId, pageId, patch);
    const updatedPage = response.data?.page;
    const { currentProject } = get();
    if (currentProject && updatedPage) {
      set({
        currentProject: {
          ...currentProject,
          pages: currentProject.pages.map((p) =>
            (p.id === pageId || p.page_id === pageId)
              ? { ...p, ...updatedPage, id: p.id, page_id: p.page_id }
              : p
          ),
        },
      });
    }
  },

  switchTemplateMode: async (projectId, payload) => {
    await api.switchTemplateMode(projectId, payload);
    // 模式切换可能批量改写所有页，刷新整个项目
    await get().syncProject(projectId);
  },

  switchTemplateModeWithUpload: async (projectId, file, unifiedStyleText) => {
    const response = await api.switchTemplateModeSingleWithUpload(projectId, file, unifiedStyleText);
    const asset = response.data?.asset;
    if (asset) {
      set((state) => ({ templateAssets: [...state.templateAssets, asset] }));
    }
    await get().syncProject(projectId);
  },

  autoMatchAll: async (projectId, opts) => {
    const response = await api.autoMatchAllTemplates(projectId, opts);
    return response.data!.task_id;
  },

  autoMatchPage: async (projectId, pageId) => {
    const response = await api.autoMatchPageTemplate(projectId, pageId);
    return response.data!.task_id;
  },

  // 轮询模板相关任务（解析 / PDF 拆页 / 自动匹配），完成或失败时 resolve。
  // 不污染全局 activeTaskId/taskProgress，便于多任务并发。
  pollTemplateTask: async (taskId, projectId, onProgress) => {
    // Cap the loop so a stuck/dead worker can't poll forever (~15 min).
    const MAX_ATTEMPTS = 450;
    return new Promise<Task>((resolve, reject) => {
      let attempts = 0;
      const poll = async () => {
        if (attempts++ >= MAX_ATTEMPTS) {
          reject(new Error(t('store.taskFailed')));
          return;
        }
        try {
          const response = await api.getTaskStatus(projectId, taskId);
          const task = response.data;
          if (!task) {
            setTimeout(poll, 2000);
            return;
          }
          if (onProgress) onProgress(task);
          if (task.status === 'COMPLETED') {
            resolve(task);
          } else if (task.status === 'FAILED') {
            reject(new Error(task.error_message || task.error || t('store.taskFailed')));
          } else {
            setTimeout(poll, 2000);
          }
        } catch (error: any) {
          reject(error);
        }
      };
      poll();
    });
  },
};});
