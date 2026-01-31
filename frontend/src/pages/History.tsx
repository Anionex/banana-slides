import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Trash2, Sun, Moon } from 'lucide-react';
import { Button, Loading, Card, useToast, useConfirm } from '@/components/shared';
import { ProjectCard } from '@/components/history/ProjectCard';
import { useProjectStore } from '@/store/useProjectStore';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/api/endpoints';
import { normalizeProject } from '@/utils';
import { getProjectTitle, getProjectRoute } from '@/utils/projectUtils';
import type { Project } from '@/types';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isDark, setTheme } = useTheme();
  const { syncProject, setCurrentProject } = useProjectStore();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadProjects();
  }, []);

  // ===== 数据加载 =====

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listProjects(50, 0);
      if (response.data?.projects) {
        const normalizedProjects = response.data.projects.map(normalizeProject);
        setProjects(normalizedProjects);
      }
    } catch (err: any) {
      console.error('加载历史项目失败:', err);
      setError(err.message || t('history.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // ===== 项目选择与导航 =====

  const handleSelectProject = useCallback(async (project: Project) => {
    const projectId = project.id || project.project_id;
    if (!projectId) return;

    // 如果正在批量选择模式，不跳转
    if (selectedProjects.size > 0) {
      return;
    }

    // 如果正在编辑该项目，不跳转
    if (editingProjectId === projectId) {
      return;
    }

    try {
      // 设置当前项目
      setCurrentProject(project);
      localStorage.setItem('currentProjectId', projectId);
      
      // 同步项目数据
      await syncProject(projectId);
      
      // 根据项目状态跳转到不同页面
      const route = getProjectRoute(project);
      navigate(route, { state: { from: 'history' } });
    } catch (err: any) {
      console.error('打开项目失败:', err);
      show({
        message: t('history.openFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    }
  }, [selectedProjects, editingProjectId, setCurrentProject, syncProject, navigate, getProjectRoute, show, t]);

  // ===== 批量选择操作 =====

  const handleToggleSelect = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(projectId)) {
        newSelected.delete(projectId);
      } else {
        newSelected.add(projectId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProjects(prev => {
      if (prev.size === projects.length) {
        return new Set();
      } else {
        const allIds = projects.map(p => p.id || p.project_id).filter(Boolean) as string[];
        return new Set(allIds);
      }
    });
  }, [projects]);

  // ===== 删除操作 =====

  const deleteProjects = useCallback(async (projectIds: string[]) => {
    setIsDeleting(true);
    const currentProjectId = localStorage.getItem('currentProjectId');
    let deletedCurrentProject = false;

    try {
      // 批量删除
      const deletePromises = projectIds.map(projectId => api.deleteProject(projectId));
      await Promise.all(deletePromises);

      // 检查是否删除了当前项目
      if (currentProjectId && projectIds.includes(currentProjectId)) {
        localStorage.removeItem('currentProjectId');
        setCurrentProject(null);
        deletedCurrentProject = true;
      }

      // 从列表中移除已删除的项目
      setProjects(prev => prev.filter(p => {
        const id = p.id || p.project_id;
        return id && !projectIds.includes(id);
      }));

      // 清空选择
      setSelectedProjects(new Set());

      if (deletedCurrentProject) {
        show({
          message: t('history.deleteCurrentProject'),
          type: 'info'
        });
      } else {
        show({
          message: t('history.deleteSuccess', { count: projectIds.length }),
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('删除项目失败:', err);
      show({
        message: t('history.deleteFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  }, [setCurrentProject, show, t]);

  const handleDeleteProject = useCallback(async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发项目选择
    
    const projectId = project.id || project.project_id;
    if (!projectId) return;

    const projectTitle = getProjectTitle(project);
    confirm(
      t('history.confirmDelete', { title: projectTitle }),
      async () => {
        await deleteProjects([projectId]);
      },
      { title: t('history.deleteTitle'), variant: 'danger' }
    );
  }, [confirm, deleteProjects, t]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedProjects.size === 0) return;

    const count = selectedProjects.size;
    confirm(
      t('history.confirmBatchDelete', { count }),
      async () => {
        const projectIds = Array.from(selectedProjects);
        await deleteProjects(projectIds);
      },
      { title: t('history.batchDeleteTitle'), variant: 'danger' }
    );
  }, [selectedProjects, confirm, deleteProjects, t]);

  // ===== 编辑操作 =====

  const handleStartEdit = useCallback((e: React.MouseEvent, project: Project) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发项目选择
    
    // 如果正在批量选择模式，不允许编辑
    if (selectedProjects.size > 0) {
      return;
    }
    
    const projectId = project.id || project.project_id;
    if (!projectId) return;
    
    const currentTitle = getProjectTitle(project);
    setEditingProjectId(projectId);
    setEditingTitle(currentTitle);
  }, [selectedProjects]);

  const handleCancelEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditingTitle('');
  }, []);

  const handleSaveEdit = useCallback(async (projectId: string) => {
    if (!editingTitle.trim()) {
      show({ message: t('history.titleEmpty'), type: 'error' });
      return;
    }

    try {
      // 调用API更新项目名称
      await api.updateProject(projectId, { idea_prompt: editingTitle.trim() });

      // 更新本地状态
      setProjects(prev => prev.map(p => {
        const id = p.id || p.project_id;
        if (id === projectId) {
          return { ...p, idea_prompt: editingTitle.trim() };
        }
        return p;
      }));

      setEditingProjectId(null);
      setEditingTitle('');
      show({ message: t('history.titleUpdated'), type: 'success' });
    } catch (err: any) {
      console.error('更新项目名称失败:', err);
      show({
        message: t('history.titleUpdateFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    }
  }, [editingTitle, show, t]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(projectId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary">
      {/* 导航栏 */}
      <nav className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-100 dark:border-border-primary">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-banana-500 to-banana-600 rounded-lg flex items-center justify-center text-xl md:text-2xl">
              🍌
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('home.title')}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/')}
              className="text-xs md:text-sm"
            >
              {t('nav.home')}
            </Button>
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary" />
            {/* 语言切换按钮 */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={t('settings.language.label')}
            >
              {i18n.language?.startsWith('zh') ? 'EN' : '中'}
            </button>
            {/* 主题切换按钮 */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-1.5 text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={isDark ? t('settings.theme.light') : t('settings.theme.dark')}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-3 md:px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-foreground-primary mb-1 md:mb-2">{t('history.title')}</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-foreground-tertiary">{t('history.subtitle')}</p>
          </div>
          {projects.length > 0 && selectedProjects.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-foreground-tertiary">
                {t('history.selectedCount', { count: selectedProjects.size })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedProjects(new Set())}
                disabled={isDeleting}
              >
                {t('history.cancelSelect')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 size={16} />}
                onClick={handleBatchDelete}
                disabled={isDeleting}
                loading={isDeleting}
              >
                {t('history.batchDelete')}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading message={t('common.loading')} />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-gray-600 dark:text-foreground-tertiary mb-4">{error}</p>
            <Button variant="primary" onClick={loadProjects}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
              {t('history.noProjects')}
            </h3>
            <p className="text-gray-500 dark:text-foreground-tertiary mb-6">
              {t('history.createFirst')}
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              {t('home.actions.createProject')}
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 全选工具栏 */}
            {projects.length > 0 && (
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-border-primary">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === projects.length && projects.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-banana-600 border-gray-300 dark:border-border-primary rounded focus:ring-banana-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {selectedProjects.size === projects.length ? t('common.deselectAll') : t('common.selectAll')}
                  </span>
                </label>
              </div>
            )}
            
            {projects.map((project) => {
              const projectId = project.id || project.project_id;
              if (!projectId) return null;
              
              return (
                <ProjectCard
                  key={projectId}
                  project={project}
                  isSelected={selectedProjects.has(projectId)}
                  isEditing={editingProjectId === projectId}
                  editingTitle={editingTitle}
                  onSelect={handleSelectProject}
                  onToggleSelect={handleToggleSelect}
                  onDelete={handleDeleteProject}
                  onStartEdit={handleStartEdit}
                  onTitleChange={setEditingTitle}
                  onTitleKeyDown={handleTitleKeyDown}
                  onSaveEdit={handleSaveEdit}
                  isBatchMode={selectedProjects.size > 0}
                />
              );
            })}
          </div>
        )}
      </main>
      <ToastContainer />
      {ConfirmDialog}
    </div>
  );
};

