// Material 相关组件的共享翻译
export const materialI18n = {
  zh: {
    material: {
      title: "素材生成", centerTitle: "素材中心", selectTitle: "选择素材",
      saveToLibraryNote: "生成的素材会保存到素材库",
      generatedResult: "生成结果", generatedMaterial: "生成的素材", generatedPreview: "生成的素材会展示在这里",
      promptLabel: "提示词（原样发送给文生图模型）",
      promptPlaceholder: "例如：蓝紫色渐变背景，带几何图形和科技感线条，用于科技主题标题页...",
      referenceImages: "参考图片（可选）", mainReference: "主参考图（可选）", extraReference: "额外参考图（可选，多张）",
      clickToUpload: "点击上传", selectFromLibrary: "从素材库选择", generateMaterial: "生成素材",
      totalMaterials: "共 {{count}} 个素材", noMaterials: "暂无素材", selectedCount: "已选择 {{count}} 个",
      allMaterials: "所有素材", unassociated: "未关联项目", currentProject: "当前项目",
      viewMoreProjects: "+ 查看更多项目...", uploadFile: "上传文件",
      previewMaterial: "预览素材", deleteMaterial: "删除素材", closePreview: "关闭预览",
      canUploadOrGenerate: "可以上传图片或通过素材生成功能创建素材", canUploadImages: "可以上传图片作为素材",
      messages: {
        enterPrompt: "请输入提示词", materialAdded: "已添加 {{count}} 个素材", loadMaterialFailed: "加载素材失败",
        unsupportedFormat: "不支持的图片格式", uploadSuccess: "素材上传成功", uploadFailed: "上传素材失败",
        cannotDelete: "无法删除：缺少素材ID", deleteSuccess: "素材已删除", deleteFailed: "删除素材失败",
        downloadSuccess: "下载成功", downloadFailed: "下载失败",
        batchDownloadSuccess: "已打包 {{count}} 个素材", batchDownloadFailed: "批量下载失败",
        selectDownload: "请先选择要下载的素材", selectAtLeastOne: "请至少选择一个素材",
        maxSelection: "最多只能选择 {{count}} 个素材",
        generateSuccess: "素材生成成功，已保存到历史素材库", generateSuccessGlobal: "素材生成成功，已保存到全局素材库",
        generateComplete: "素材生成完成，但未找到图片地址", generateFailed: "素材生成失败",
        generateTimeout: "素材生成超时，请稍后查看素材库", pollingFailed: "轮询任务状态失败，请稍后查看素材库",
        noTaskId: "素材生成失败：未返回任务ID", savedToLibrary: "素材已保存到模板库", selectedAsTemplate: "已从素材库选择作为模板"
      }
    }
  },
  en: {
    material: {
      title: "Generate Material", centerTitle: "Material Center", selectTitle: "Select Material",
      saveToLibraryNote: "Generated materials will be saved to the library",
      generatedResult: "Generated Result", generatedMaterial: "Generated Material", generatedPreview: "Generated materials will be displayed here",
      promptLabel: "Prompt (sent directly to text-to-image model)",
      promptPlaceholder: "e.g., Blue-purple gradient background with geometric shapes and tech-style lines for a tech-themed title page...",
      referenceImages: "Reference Images (Optional)", mainReference: "Main Reference (Optional)", extraReference: "Extra References (Optional, multiple)",
      clickToUpload: "Click to upload", selectFromLibrary: "Select from Library", generateMaterial: "Generate Material",
      totalMaterials: "{{count}} materials", noMaterials: "No materials", selectedCount: "{{count}} selected",
      allMaterials: "All Materials", unassociated: "Unassociated", currentProject: "Current Project",
      viewMoreProjects: "+ View more projects...", uploadFile: "Upload File",
      previewMaterial: "Preview Material", deleteMaterial: "Delete Material", closePreview: "Close Preview",
      canUploadOrGenerate: "You can upload images or create materials through the material generator", canUploadImages: "You can upload images as materials",
      messages: {
        enterPrompt: "Please enter a prompt", materialAdded: "Added {{count}} material(s)", loadMaterialFailed: "Failed to load materials",
        unsupportedFormat: "Unsupported image format", uploadSuccess: "Material uploaded successfully", uploadFailed: "Failed to upload material",
        cannotDelete: "Cannot delete: Missing material ID", deleteSuccess: "Material deleted", deleteFailed: "Failed to delete material",
        downloadSuccess: "Download successful", downloadFailed: "Download failed",
        batchDownloadSuccess: "Packaged {{count}} materials", batchDownloadFailed: "Batch download failed",
        selectDownload: "Please select materials to download first", selectAtLeastOne: "Please select at least one material",
        maxSelection: "Maximum {{count}} materials can be selected",
        generateSuccess: "Material generated successfully, saved to history library", generateSuccessGlobal: "Material generated successfully, saved to global library",
        generateComplete: "Material generation complete, but image URL not found", generateFailed: "Failed to generate material",
        generateTimeout: "Material generation timeout, please check the library later", pollingFailed: "Failed to poll task status, please check the library later",
        noTaskId: "Material generation failed: No task ID returned", savedToLibrary: "Material saved to template library", selectedAsTemplate: "Selected from library as template"
      }
    }
  }
};
