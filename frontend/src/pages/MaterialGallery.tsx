import React， { useState， useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw， Upload， Sparkles， X， 下载， ArrowLeft， Image as ImageIcon， Trash2， ExternalLink， Palette } from 'lucide-react';
import { Button， useToast， Modal， MaterialGeneratorModal } from '@/components/shared';
import { listMaterials， uploadMaterial， listProjects， deleteMaterial， uploadUserTemplate， 输入 Material } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import 输入 { Project } from '@/types';
import { getImageUrl } from '@/api/client';

export const MaterialGallery: React。FC = () => {
  const navigate = useNavigate();
  const { show， ToastContainer } = useToast();
  
  // 状态管理
  const [materials， setMaterials] = useState<Material[]>([]);
  const [isLoading， setIsLoading] = useState(false);
  const [isUploading， setIsUploading] = useState(false);
  const [filterProjectId， setFilterProjectId] = useState<string>('all');
  const [项目， setProjects] = useState<Project[]>([]);
  const [isGeneratorOpen， setIsGeneratorOpen] = useState(false);
  const [previewMaterial， setPreviewMaterial] = useState<Material | null>(null);
  const [deletingId， setDeletingId] = useState<string | null>(null);
  const [savingTemplateId， setSavingTemplateId] = useState<string | null>(null);

  // 初始化加载
  useEffect(() => {
    loadProjects();
    loadMaterials();
  }， []);

  // 监听筛选变化
  useEffect(() => {
    loadMaterials();
  }， [filterProjectId]);

  const loadProjects = async () => {
    try {
      const response = await listProjects(100， 0);
      if (response。data?.项目) {
        setProjects(response。data。项目);
      }
    } catch (error) {
      console。error('加载项目列表失败:'， error);
    }
  };

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const targetProjectId = filterProjectId === 'all' ? 'all' : filterProjectId === 'none' ? 'none' : filterProjectId;
      const response = await listMaterials(targetProjectId);
      if (response。data?.materials) {
        setMaterials(response。data。materials);
      }
    } catch (error: any) {
      console。error('加载素材列表失败:'， error);
      show({
        message: error?.response?.data?.error?.message || error。message || '加载素材列表失败'，
        输入: 'error'，
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React。ChangeEvent<HTMLInputElement>) => {
    const file = e。target。文件?.[0];
    if (!file) return;

    const allowedTypes = ['image/png'， 'image/jpeg'， 'image/jpg'， 'image/gif'， 'image/webp'， 'image/bmp'， 'image/svg+xml'];
    if (!allowedTypes。includes(file。输入)) {
      show({ message: '不支持的图片格式'， 输入: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      // 如果筛选了具体项目，则上传到该项目；否则上传为全局素材
      const targetProjectId = (filterProjectId === 'all' || filterProjectId === 'none')
        ? null
        : filterProjectId;

      const response = await uploadMaterial(file， targetProjectId);
      
      if (response。data) {
        show({ message: '素材上传成功'， 输入: 'success' });
        loadMaterials();
      }
    } catch (error: any) {
      console。error('上传素材失败:'， error);
      show({
        message: error?.response?.data?.error?.message || error。message || '上传素材失败'，
        输入: 'error'，
      });
    } finally {
      setIsUploading(false);
      e。target。value = '';
    }
  };

  const handleDelete = async (material: Material) => {
    if (!window。confirm('确定要删除这个素材吗？此操作不可恢复。')) return;

    setDeletingId(material。id);
    try {
      await deleteMaterial(material。id);
      setMaterials(prev => prev。filter(m => m。id !== material。id));
      show({ message: '素材已删除'， 输入: 'success' });
      if (previewMaterial?.id === material。id) {
        setPreviewMaterial(null);
      }
    } catch (error: any) {
      console。error('删除素材失败:'， error);
      show({
        message: error?.response?.data?.error?.message || error。message || '删除素材失败'，
        输入: 'error'，
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (material: Material) => {
    try {
      const imageUrl = getImageUrl(material。url);
      const response = await fetch(imageUrl);
      const blob = await response。blob();
      const url = window。URL。createObjectURL(blob);
      const a = document。createElement('a');
      a。href = url;
      a。download = material。filename || `material-${material。id}.png`;
      document。body。appendChild(a);
      a。click();
      window。URL。revokeObjectURL(url);
      document。body。removeChild(a);
    } catch (error) {
      console。error('下载失败:'， error);
      show({ message: '下载失败'， 输入: 'error' });
    }
  };

  const handleSaveAsTemplate = async (material: Material) => {
    if (savingTemplateId) return;
    
    setSavingTemplateId(material。id);
    try {
      // 1. Convert URL to File object
      const file = await materialUrlToFile(material);
      
      // 2. Upload as user template
      const name = material。prompt || material。filename || '未命名素材';
      await uploadUserTemplate(file， name);
      
      show({ message: '已保存到我的模板库'， 输入: 'success' });
    } catch (error: any) {
      console。error('保存模板失败:'， error);
      show({
        message: error?.response?.data?.error?.message || error。message || '保存模板失败'，
        输入: 'error'，
      });
    } finally {
      setSavingTemplateId(null);
    }
  };

  const getMaterialDisplayName = (m: Material) =>
    (m。prompt && m。prompt。trim()) ||
    (m。name && m。name。trim()) ||
    (m。original_filename && m。original_filename。trim()) ||
    (m。source_filename && m。source_filename。trim()) ||
    m。filename ||
    m。url;

  const renderProjectLabel = (p: Project) => {
    const text = p。idea_prompt || p。outline_text || `项目 ${p。project_id。slice(0， 8)}`;
    return text。length > 20 ? `${text。slice(0， 20)}…` : text;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={20} />}
              onClick={() => navigate('/')}
            >
              返回
            </Button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="text-banana-500" />
              素材库
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={16} />}
                onClick={loadMaterials}
                disabled={isLoading}
              >
                刷新
              </Button>
          </div>
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* 工具栏 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">筛选项目:</span>
              <select
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e。target。value)}
                className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-banana-500 focus:border-banana-500 sm:text-sm rounded-md"
              >
                <option value="all">所有素材</option>
                <option value="none">未关联项目 (全局)</option>
                <option disabled>───────────</option>
                {项目。map((p) => (
                  <option key={p。project_id} value={p。project_id}>
                    {renderProjectLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              共 {materials。length} 个素材
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-block cursor-pointer">
              <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-banana-500 rounded-md hover:bg-banana-600 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Upload size={18} />
                <span>{isUploading ? '上传中...' : '上传图片'}</span>
              </div>
              <input
                输入="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            
            <Button
              variant="secondary"
              icon={<Sparkles size={18} />}
              onClick={() => setIsGeneratorOpen(true)}
            >
              AI 生成素材
            </Button>
          </div>
        </div>

        {/* 素材网格 */}
        {isLoading && materials。length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-banana-500 mb-2" size={32} />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : materials。length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <ImageIcon size={64} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">暂无素材</h3>
            <p className="text-gray-500 mt-1">上传图片或使用 AI 生成来丰富你的素材库</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {materials。map((material) => (
              <div
                key={material。id}
                className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer aspect-square"
                onClick={() => setPreviewMaterial(material)}
              >
                <img
                  src={getImageUrl(material。url)}
                  alt={getMaterialDisplayName(material)}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* 悬停遮罩 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                   <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e。stopPropagation();
                          setPreviewMaterial(material);
                        }}
                        className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 transition-colors"
                        title="查看大图"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e。stopPropagation();
                          handleSaveAsTemplate(material);
                        }}
                        className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 transition-colors disabled:opacity-50"
                        title="保存为风格模板"
                        disabled={savingTemplateId === material。id}
                      >
                        {savingTemplateId === material。id ? <RefreshCw className="animate-spin" size={18} /> : <Palette size={18} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e。stopPropagation();
                          handleDownload(material);
                        }}
                        className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 transition-colors"
                        title="下载"
                      >
                        <下载 size={18} />
                      </button>
                   </div>
                </div>

                {/* 底部信息 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-xs truncate">
                    {getMaterialDisplayName(material)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 图片预览 Modal */}
      {previewMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setPreviewMaterial(null)}>
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setPreviewMaterial(null)}
          >
            <X size={32} />
          </button>
          
          <div 
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={e => e。stopPropagation()}
          >
            <img
              src={getImageUrl(previewMaterial。url)}
              alt={getMaterialDisplayName(previewMaterial)}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            
            <div className="mt-6 flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20"
                icon={<下载 size={20} />}
                onClick={() => handleDownload(previewMaterial)}
              >
                下载原图
              </Button>
              <div className="w-px h-6 bg-white/20"></div>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20"
                icon={savingTemplateId === previewMaterial。id ? <RefreshCw className="animate-spin" size={20} /> : <Palette size={20} />}
                onClick={() => handleSaveAsTemplate(previewMaterial)}
                disabled={savingTemplateId === previewMaterial。id}
              >
                设为模板
              </Button>
              <div className="w-px h-6 bg-white/20"></div>
              <Button
                variant="ghost"
                className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
                icon={deletingId === previewMaterial。id ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
                onClick={() => handleDelete(previewMaterial)}
                disabled={deletingId === previewMaterial。id}
              >
                删除
              </Button>
            </div>
            
            {/* 图片信息 */}
            <div className="mt-4 text-white/80 text-sm max-w-2xl text-center">
                {previewMaterial。prompt && (
                    <p className="mb-1"><span className="opacity-60">Prompt:</span> {previewMaterial。prompt}</p>
                )}
                <p><span className="opacity-60">文件名:</span> {previewMaterial。filename}</p>
            </div>
          </div>
        </div>
      )}

      <MaterialGeneratorModal
        projectId={filterProjectId === 'all' || filterProjectId === 'none' ? null : filterProjectId}
        isOpen={isGeneratorOpen}
        onClose={() => {
          setIsGeneratorOpen(false);
          loadMaterials();
        }}
      />
      
      <ToastContainer />
    </div>
  );
};
