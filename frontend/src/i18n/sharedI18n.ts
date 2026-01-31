// 组件间共享的小型翻译
export const sharedI18n = {
  zh: {
    slideCard: { notGenerated: "未生成", confirmDeletePage: "确定要删除这一页吗？", confirmDeleteTitle: "确认删除" },
    aiRefine: { ctrlEnterSubmit: "（Ctrl+Enter 提交）", history: "历史", viewHistory: "查看 {{count}} 条历史修改", previousRequirements: "之前的修改要求：", submitTooltip: "提交 (Ctrl+Enter)" },
    filePreview: { title: "文件预览", loading: "加载文件内容中...", notParsed: "文件尚未解析完成，无法预览", loadFailed: "加载文件内容失败" },
    imagePreview: { title: "图片预览", removeImage: "移除图片" },
    slidePreview: { pageGenerating: "该页面正在生成中，请稍候...", generationStarted: "已开始生成图片，请稍候...", versionSwitched: "已切换到该版本", outlineSaved: "大纲和描述已保存", materialsAdded: "已添加 {{count}} 个素材", exportStarted: "导出任务已开始，可在导出任务面板查看进度", cannotRefresh: "无法刷新：缺少项目ID", refreshSuccess: "刷新成功", extraRequirementsSaved: "额外要求已保存", styleDescSaved: "风格描述已保存", exportSettingsSaved: "导出设置已保存", loadTemplateFailed: "加载模板失败", templateChanged: "模板更换成功" },
    github: { viewRepo: "查看 GitHub 仓库" },
    shared: { pptTip: "提示：建议将PPT转换为PDF格式上传，可获得更好的解析效果", imageRemoved: "已移除图片", page: "第 {{num}} 页", regenerate: "重新生成", chapter: "章节", titleLabel: "标题", keyPointsPlaceholder: "要点（每行一个）", confirmDeletePage: "确定要删除这一页吗？", descriptionTitle: "编辑页面描述", description: "描述" }
  },
  en: {
    slideCard: { notGenerated: "Not Generated", confirmDeletePage: "Are you sure you want to delete this page?", confirmDeleteTitle: "Confirm Delete" },
    aiRefine: { ctrlEnterSubmit: "(Ctrl+Enter to submit)", history: "History", viewHistory: "View {{count}} previous edits", previousRequirements: "Previous edit requests:", submitTooltip: "Submit (Ctrl+Enter)" },
    filePreview: { title: "File Preview", loading: "Loading file content...", notParsed: "File not yet parsed, cannot preview", loadFailed: "Failed to load file content" },
    imagePreview: { title: "Image Preview", removeImage: "Remove Image" },
    slidePreview: { pageGenerating: "This page is generating, please wait...", generationStarted: "Image generation started, please wait...", versionSwitched: "Switched to this version", outlineSaved: "Outline and description saved", materialsAdded: "Added {{count}} material(s)", exportStarted: "Export task started, check progress in export tasks panel", cannotRefresh: "Cannot refresh: Missing project ID", refreshSuccess: "Refresh successful", extraRequirementsSaved: "Extra requirements saved", styleDescSaved: "Style description saved", exportSettingsSaved: "Export settings saved", loadTemplateFailed: "Failed to load template", templateChanged: "Template changed successfully" },
    github: { viewRepo: "View GitHub Repository" },
    shared: { pptTip: "Tip: It's recommended to convert PPT to PDF format for better parsing results", imageRemoved: "Image removed", page: "Page {{num}}", regenerate: "Regenerate", chapter: "Chapter", titleLabel: "Title", keyPointsPlaceholder: "Key points (one per line)", confirmDeletePage: "Are you sure you want to delete this page?", descriptionTitle: "Edit Descriptions", description: "Description" }
  }
};
