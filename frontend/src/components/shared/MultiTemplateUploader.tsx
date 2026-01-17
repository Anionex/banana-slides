import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, GripVertical, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';

export interface TemplateFile {
  id: string;
  file: File;
  previewUrl: string;
  orderIndex: number;
}

interface MultiTemplateUploaderProps {
  templates: TemplateFile[];
  onTemplatesChange: (templates: TemplateFile[]) => void;
  maxTemplates?: number;
  disabled?: boolean;
  className?: string;
}

export const MultiTemplateUploader: React.FC<MultiTemplateUploaderProps> = ({
  templates,
  onTemplatesChange,
  maxTemplates = 50,
  disabled = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show, ToastContainer } = useToast();

  const generateId = () => `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file =>
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      show({ message: '请选择图片文件', type: 'error' });
      return;
    }

    const availableSlots = maxTemplates - templates.length;
    if (imageFiles.length > availableSlots) {
      show({
        message: `最多可上传 ${maxTemplates} 张模板，已选择前 ${availableSlots} 张`,
        type: 'warning'
      });
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);
    const newTemplates: TemplateFile[] = filesToAdd.map((file, index) => ({
      id: generateId(),
      file,
      previewUrl: URL.createObjectURL(file),
      orderIndex: templates.length + index,
    }));

    onTemplatesChange([...templates, ...newTemplates]);
  }, [templates, maxTemplates, onTemplatesChange, show]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template) {
      URL.revokeObjectURL(template.previewUrl);
    }
    const updated = templates
      .filter(t => t.id !== id)
      .map((t, index) => ({ ...t, orderIndex: index }));
    onTemplatesChange(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOverItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newTemplates = [...templates];
    const [dragged] = newTemplates.splice(draggedIndex, 1);
    newTemplates.splice(targetIndex, 0, dragged);

    const reordered = newTemplates.map((t, i) => ({ ...t, orderIndex: i }));
    onTemplatesChange(reordered);
    setDraggedIndex(targetIndex);
  };

  const clearAll = () => {
    templates.forEach(t => URL.revokeObjectURL(t.previewUrl));
    onTemplatesChange([]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <ToastContainer />

      {/* Drop zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all duration-200
          ${isDragging
            ? 'border-yellow-400 bg-yellow-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center text-center">
          <Upload className={`w-10 h-10 mb-3 ${isDragging ? 'text-yellow-500' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-gray-700">
            拖拽或点击上传多张模板图片
          </p>
          <p className="text-xs text-gray-500 mt-1">
            支持 JPG、PNG、WebP 格式，按上传顺序与页面绑定
          </p>
          {templates.length > 0 && (
            <p className="text-xs text-yellow-600 mt-2">
              已选择 {templates.length} 张模板
            </p>
          )}
        </div>
      </div>

      {/* Template preview grid */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              模板预览（拖拽调整顺序）
            </h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
            >
              清空全部
            </Button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {templates.map((template, index) => (
              <div
                key={template.id}
                className={`
                  group relative aspect-[4/3] rounded-lg overflow-hidden border-2
                  ${draggedIndex === index ? 'border-yellow-400 opacity-50' : 'border-gray-200'}
                  hover:border-yellow-300 transition-all cursor-move
                `}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOverItem(e, index)}
              >
                {/* Preview image */}
                <img
                  src={template.previewUrl}
                  alt={`模板 ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Overlay with page number */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">
                      P{index + 1}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(template.id);
                      }}
                      className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      disabled={disabled}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Drag handle indicator */}
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
                </div>

                {/* Page number badge (always visible) */}
                <div className="absolute top-1 right-1">
                  <span className="text-xs font-bold text-white bg-yellow-500 px-1.5 py-0.5 rounded shadow">
                    {index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Info message */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              模板将按顺序与PPT页面一一对应。第1张模板对应第1页，以此类推。
              如果模板数量少于页面数量，多余页面将不使用页级模板。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTemplateUploader;
