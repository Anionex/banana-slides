// ReferenceFile 相关组件的共享翻译
export const referenceFileI18n = {
  zh: {
    referenceFile: {
      title: "选择参考文件", totalFiles: "共 {{count}} 个文件", noFiles: "暂无文件",
      selectedCount: "已选择 {{count}} 个", allAttachments: "所有附件", unclassified: "未归类附件",
      currentProjectAttachments: "当前项目附件", uploadedFiles: "已上传的文件", uploadedImages: "已上传图片",
      refreshList: "刷新列表", imageLoadFailed: "图片加载失败", deleteThisMaterial: "删除此素材",
      parseStatus: { pending: "等待解析", parsing: "解析中...", completed: "解析完成", failed: "解析失败" },
      reparse: "重新解析", removeFromProject: "从项目中移除", deleteFile: "删除文件",
      imageCaptionFailed: "⚠️ {{count}} 张图片未能生成描述",
      messages: {
        loadFailed: "加载参考文件列表失败", uploadSuccess: "成功上传 {{count}} 个文件", uploadFailed: "上传文件失败",
        cannotDelete: "无法删除：缺少文件ID", deleteSuccess: "文件删除成功", deleteFailed: "删除文件失败",
        selectAtLeastOne: "请至少选择一个文件", selectValid: "请选择有效的文件",
        maxSelection: "最多只能选择 {{count}} 个文件",
        parseTriggered: "已触发 {{count}} 个文件的解析，将在后台进行", parseFailed: "触发文件解析失败"
      }
    }
  },
  en: {
    referenceFile: {
      title: "Select Reference Files", totalFiles: "{{count}} files", noFiles: "No files",
      selectedCount: "{{count}} selected", allAttachments: "All Attachments", unclassified: "Unclassified",
      currentProjectAttachments: "Current Project Attachments", uploadedFiles: "Uploaded Files", uploadedImages: "Uploaded Images",
      refreshList: "Refresh List", imageLoadFailed: "Image load failed", deleteThisMaterial: "Delete this material",
      parseStatus: { pending: "Pending", parsing: "Parsing...", completed: "Completed", failed: "Failed" },
      reparse: "Reparse", removeFromProject: "Remove from Project", deleteFile: "Delete File",
      imageCaptionFailed: "⚠️ {{count}} images failed to generate captions",
      messages: {
        loadFailed: "Failed to load reference file list", uploadSuccess: "Successfully uploaded {{count}} file(s)", uploadFailed: "Failed to upload file",
        cannotDelete: "Cannot delete: Missing file ID", deleteSuccess: "File deleted successfully", deleteFailed: "Failed to delete file",
        selectAtLeastOne: "Please select at least one file", selectValid: "Please select valid files",
        maxSelection: "Maximum {{count}} files can be selected",
        parseTriggered: "Triggered parsing for {{count}} file(s), will process in background", parseFailed: "Failed to trigger file parsing"
      }
    }
  }
};
