import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { Button, Loading, useToast, useConfirm } from '@/components/shared';
import { DescriptionCard } from '@/components/preview/DescriptionCard';
import { useProjectStore } from '@/store';

export const DetailEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    generateDescriptions,
    generatePageDescription,
    pageDescriptionGeneratingTasks,
    deletePageById,
    addNewPage,
  } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    } else if (projectId && currentProject && currentProject.id === projectId) {
      // 如果项目已存在，也同步一次以确保数据是最新的（特别是从描述生成后）
      // 但只在首次加载时同步，避免频繁请求
      const shouldSync = !currentProject.pages.some(p => p.description_content);
      if (shouldSync) {
        syncProject(projectId);
      }
    }
  }, [projectId, currentProject?.id]); // 只在 projectId 或项目ID变化时更新


  const handleGenerateAll = async () => {
    const hasDescriptions = currentProject?.pages.some(
      (p) => p.description_content
    );
    
    const executeGenerate = async () => {
      await generateDescriptions();
    };
    
    if (hasDescriptions) {
      confirm(
        '部分页面已有描述，重新生成将覆盖，确定继续吗？',
        executeGenerate,
        { title: '确认重新生成', variant: 'warning' }
      );
    } else {
      await executeGenerate();
    }
  };

  const handleRegeneratePage = async (pageId: string) => {
    if (!currentProject) return;

    const page = currentProject.pages.find((p) => p.id === pageId);
    if (!page) return;

    // 如果已有描述，询问是否覆盖
    if (page.description_content) {
      confirm(
        '该页面已有描述，重新生成将覆盖现有内容，确定继续吗？',
        async () => {
          try {
            await generatePageDescription(pageId);
            show({ message: '生成成功', type: 'success' });
          } catch (error: any) {
            show({
              message: `生成失败: ${error.message || '未知错误'}`,
              type: 'error'
            });
          }
        },
        { title: '确认重新生成', variant: 'warning' }
      );
      return;
    }

    try {
      await generatePageDescription(pageId);
      show({ message: '生成成功', type: 'success' });
    } catch (error: any) {
      show({
        message: `生成失败: ${error.message || '未知错误'}`,
        type: 'error'
      });
    }
  };

  const handleDeletePage = (pageId: string, index: number) => {
    confirm(
      `确定要删除第 ${index + 1} 页吗？此操作无法撤销。`,
      async () => {
        try {
          await deletePageById(pageId);
          show({ message: '页面已删除', type: 'success' });
        } catch (error: any) {
          show({
            message: `删除失败: ${error.message || '未知错误'}`,
            type: 'error'
          });
        }
      },
      { title: '确认删除', variant: 'danger' }
    );
  };

  const handleAddPage = async () => {
    try {
      await addNewPage();
      show({ message: '页面已添加', type: 'success' });
    } catch (error: any) {
      show({
        message: `添加失败: ${error.message || '未知错误'}`,
        type: 'error'
      });
    }
  };

  const handleBatchDelete = () => {
    if (selectedPages.size === 0) return;

    const count = selectedPages.size;
    confirm(
      `确定要删除选中的 ${count} 个页面吗？此操作无法撤销。`,
      async () => {
        try {
          for (const pageId of selectedPages) {
            await deletePageById(pageId);
          }
          setSelectedPages(new Set());
          setIsBatchMode(false);
          show({ message: `已删除 ${count} 个页面`, type: 'success' });
        } catch (error: any) {
          show({
            message: `删除失败: ${error.message || '未知错误'}`,
            type: 'error'
          });
        }
      },
      { title: '确认批量删除', variant: 'danger' }
    );
  };

  const togglePageSelection = (pageId: string) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPages(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPages.size === currentProject.pages.length) {
      setSelectedPages(new Set());
    } else {
      const allPageIds = currentProject.pages.map(p => p.id || p.page_id);
      setSelectedPages(new Set(allPageIds));
    }
  };


  if (!currentProject) {
    return <Loading fullscreen message="加载项目中..." />;
  }

  const hasAllDescriptions = currentProject.pages.every(
    (p) => p.description_content
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶栏 */}
      <header className="h-14 md:h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => {
              if (fromHistory) {
                navigate('/history');
              } else {
                navigate(`/project/${projectId}/outline`);
              }
            }}
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">返回</span>
          </Button>
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
            <span className="text-xl md:text-2xl">🍌</span>
            <span className="text-base md:text-xl font-bold truncate">MaynorAI</span>
          </div>
          <span className="text-gray-400 hidden md:inline">|</span>
          <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">编辑页面描述</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate(`/project/${projectId}/outline`)}
            className="hidden sm:inline-flex"
          >
            <span className="hidden md:inline">上一步</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate(`/project/${projectId}/preview`)}
            disabled={!hasAllDescriptions}
            className="text-xs md:text-sm"
          >
            <span className="hidden sm:inline">生成图片</span>
            <span className="sm:hidden">生成</span>
          </Button>
        </div>
      </header>

      {/* 操作栏 */}
      <div className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            {isBatchMode && (
              <Button
                variant="ghost"
                size="sm"
                icon={selectedPages.size === currentProject.pages.length ? <CheckSquare size={16} /> : <Square size={16} />}
                onClick={toggleSelectAll}
                className="text-xs md:text-sm"
              >
                {selectedPages.size === currentProject.pages.length ? '取消全选' : '全选'}
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleGenerateAll}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              批量生成描述
            </Button>
            <Button
              variant="secondary"
              icon={<Plus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleAddPage}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              新增页面
            </Button>
            <Button
              variant={isBatchMode ? "primary" : "ghost"}
              icon={<CheckSquare size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedPages(new Set());
              }}
              className="text-sm md:text-base"
            >
              {isBatchMode ? '退出批量' : '批量管理'}
            </Button>
            {isBatchMode && selectedPages.size > 0 && (
              <Button
                variant="danger"
                icon={<Trash2 size={16} className="md:w-[18px] md:h-[18px]" />}
                onClick={handleBatchDelete}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                删除选中 ({selectedPages.size})
              </Button>
            )}
            <span className="text-xs md:text-sm text-gray-500 whitespace-nowrap">
              {currentProject.pages.filter((p) => p.description_content).length} /{' '}
              {currentProject.pages.length} 页已完成
            </span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto">
          {currentProject.pages.length === 0 ? (
            <div className="text-center py-12 md:py-20">
              <div className="text-4xl md:text-6xl mb-4">📝</div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">
                还没有页面
              </h3>
              <p className="text-sm md:text-base text-gray-500 mb-6">
                请先返回大纲编辑页添加页面
              </p>
              <Button
                variant="primary"
                onClick={() => navigate(`/project/${projectId}/outline`)}
                className="text-sm md:text-base"
              >
                返回大纲编辑
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {currentProject.pages.map((page, index) => {
                const pageId = page.id || page.page_id;
                const isSelected = selectedPages.has(pageId);
                return (
                  <DescriptionCard
                    key={pageId}
                    page={page}
                    index={index}
                    onUpdate={(data) => updatePageLocal(pageId, data)}
                    onRegenerate={() => handleRegeneratePage(pageId)}
                    onDelete={() => handleDeletePage(pageId, index)}
                    isGenerating={pageId ? !!pageDescriptionGeneratingTasks[pageId] : false}
                    isBatchMode={isBatchMode}
                    isSelected={isSelected}
                    onSelectChange={(selected) => {
                      if (selected) {
                        setSelectedPages(new Set([...selectedPages, pageId]));
                      } else {
                        const newSelected = new Set(selectedPages);
                        newSelected.delete(pageId);
                        setSelectedPages(newSelected);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
      <ToastContainer />
      {ConfirmDialog}
    </div>
  );
};

