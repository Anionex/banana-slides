import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Trash2, LogIn, Info, Shield } from 'lucide-react';
import { Button, Loading, Card, useToast, useConfirm } from '@/components/shared';
import { ProjectCard } from '@/components/history/ProjectCard';
import { useProjectStore, useAuthStore } from '@/store';
import * as api from '@/api/endpoints';
import { normalizeProject } from '@/utils';
import { getProjectTitle, getProjectRoute } from '@/utils/projectUtils';
import { getUserProjectIds, getAllAssociatedProjectIds } from '@/utils/userProjects';
import type { Project } from '@/types';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { syncProject, setCurrentProject } = useProjectStore();
  const { isAuthenticated, user, isUsingSupabase } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]); // 保存所有原始数据
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
        setAllProjects(normalizedProjects);

        // 根据用户登录状态过滤项目
        if (isAuthenticated && user?.id && isUsingSupabase()) {
          // 获取用户的项目 IDs
          const userProjectIds = getUserProjectIds(user.id);
          const filteredProjects = normalizedProjects.filter(p => {
            const projectId = p.id || p.project_id;
            return projectId && userProjectIds.includes(projectId);
          });
          setProjects(filteredProjects);
        } else {
          // 未登录时，显示未被任何用户关联的项目
          const associatedIds = getAllAssociatedProjectIds();
          const unassociatedProjects = normalizedProjects.filter(p => {
            const projectId = p.id || p.project_id;
            return projectId && !associatedIds.has(projectId);
          });
          setProjects(unassociatedProjects);
        }
      }
    } catch (err: any) {
      console.error('加载历史项目失败:', err);
      setError(err.message || '加载历史项目失败');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, isUsingSupabase]);

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
        message: '打开项目失败: ' + (err.message || '未知错误'), 
        type: 'error' 
      });
    }
  }, [selectedProjects, editingProjectId, setCurrentProject, syncProject, navigate, getProjectRoute, show]);

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
          message: '已删除项目，包括当前打开的项目', 
          type: 'info' 
        });
      } else {
        show({ 
          message: `成功删除 ${projectIds.length} 个项目`, 
          type: 'success' 
        });
      }
    } catch (err: any) {
      console.error('删除项目失败:', err);
      show({ 
        message: '删除项目失败: ' + (err.message || '未知错误'), 
        type: 'error' 
      });
    } finally {
      setIsDeleting(false);
    }
  }, [setCurrentProject, show]);

  const handleDeleteProject = useCallback(async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发项目选择
    
    const projectId = project.id || project.project_id;
    if (!projectId) return;

    const projectTitle = getProjectTitle(project);
    confirm(
      `确定要删除项目"${projectTitle}"吗？此操作不可恢复。`,
      async () => {
        await deleteProjects([projectId]);
      },
      { title: '确认删除', variant: 'danger' }
    );
  }, [confirm, deleteProjects]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedProjects.size === 0) return;

    const count = selectedProjects.size;
    confirm(
      `确定要删除选中的 ${count} 个项目吗？此操作不可恢复。`,
      async () => {
        const projectIds = Array.from(selectedProjects);
        await deleteProjects(projectIds);
      },
      { title: '确认批量删除', variant: 'danger' }
    );
  }, [selectedProjects, confirm, deleteProjects]);

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
      show({ message: '项目名称不能为空', type: 'error' });
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
      show({ message: '项目名称已更新', type: 'success' });
    } catch (err: any) {
      console.error('更新项目名称失败:', err);
      show({ 
        message: '更新项目名称失败: ' + (err.message || '未知错误'), 
        type: 'error' 
      });
    }
  }, [editingTitle, show]);

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
    <div className="min-h-screen bg-gradient-to-br from-banana-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* 导航栏 */}
      <nav className="h-14 md:h-16 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-banana-500 to-banana-600 rounded-lg flex items-center justify-center text-xl md:text-2xl">
              🍌
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">MaynorAI</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/')}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">主页</span>
              <span className="sm:hidden">主页</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-3 md:px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">历史项目</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              {isAuthenticated && isUsingSupabase() ? '查看和管理你的所有项目' : '查看和管理未关联的项目'}
            </p>
            {isAuthenticated && isUsingSupabase() && allProjects.length > projects.length && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                共发现 {allProjects.length} 个项目，显示 {projects.length} 个你的项目
              </p>
            )}
          </div>
          {projects.length > 0 && selectedProjects.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                已选择 {selectedProjects.size} 项
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedProjects(new Set())}
                disabled={isDeleting}
              >
                取消选择
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 size={16} />}
                onClick={handleBatchDelete}
                disabled={isDeleting}
                loading={isDeleting}
              >
                批量删除
              </Button>
            </div>
          )}
        </div>

        {/* 未登录提示 */}
        {!isAuthenticated && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
            <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                💡 <strong>提示：</strong>您当前未登录，只能查看未被其他用户关联的项目。
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                登录后，您的项目历史将保存到云端，可在任何设备访问。
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<LogIn size={16} />}
                onClick={() => navigate('/auth')}
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                立即登录
              </Button>
            </div>
          </div>
        )}

        {/* 用户隔离提示 */}
        {isAuthenticated && isUsingSupabase() && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <Shield size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✅ <strong>数据隔离保护：</strong>您只能查看和访问自己创建的项目。
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading message="加载中..." />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button variant="primary" onClick={loadProjects}>
              重试
            </Button>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              暂无历史项目
            </h3>
            <p className="text-gray-500 mb-6">
              创建你的第一个项目开始使用吧
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              创建新项目
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 全选工具栏 */}
            {projects.length > 0 && (
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === projects.length && projects.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-banana-600 border-gray-300 rounded focus:ring-banana-500"
                  />
                  <span className="text-sm text-gray-700">
                    {selectedProjects.size === projects.length ? '取消全选' : '全选'}
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

