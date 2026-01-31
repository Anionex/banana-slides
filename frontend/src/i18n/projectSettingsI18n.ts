// ProjectSettings 组件的翻译
export const projectSettingsI18n = {
  zh: {
    projectSettings: {
      title: "设置", projectConfig: "项目设置", exportConfig: "导出设置", globalConfig: "全局设置",
      projectConfigTitle: "项目级配置", projectConfigDesc: "这些设置仅应用于当前项目，不影响其他项目",
      globalConfigTitle: "全局设置", globalConfigDesc: "这些设置应用于所有项目",
      extraRequirements: "额外要求", extraRequirementsDesc: "在生成每个页面时，AI 会参考这些额外要求",
      extraRequirementsPlaceholder: "例如：使用紧凑的布局，顶部展示一级大纲标题，加入更丰富的PPT插图...",
      saveExtraRequirements: "保存额外要求",
      styleDescription: "风格描述", styleDescriptionDesc: "描述您期望的 PPT 整体风格，AI 将根据描述生成相应风格的页面",
      styleDescriptionPlaceholder: "例如：简约商务风格，使用深蓝色和白色配色，字体清晰大方，布局整洁...",
      saveStyleDescription: "保存风格描述",
      styleTip: "风格描述会在生成图片时自动添加到提示词中。如果同时上传了模板图片，风格描述会作为补充说明。",
      editablePptxExport: "可编辑 PPTX 导出设置", editablePptxExportDesc: "配置「导出可编辑 PPTX」功能的处理方式。这些设置影响导出质量和API调用成本。",
      extractorMethod: "组件提取方法", extractorMethodDesc: "选择如何从PPT图片中提取文字、表格等可编辑组件",
      extractorHybrid: "混合提取（推荐）", extractorHybridDesc: "MinerU版面分析 + 百度高精度OCR，文字识别更精确",
      extractorMineru: "MinerU提取", extractorMineruDesc: "仅使用MinerU进行版面分析和文字识别",
      backgroundMethod: "背景图获取方法", backgroundMethodDesc: "选择如何生成干净的背景图（移除原图中的文字后用于PPT背景）",
      backgroundHybrid: "混合方式获取（推荐）", backgroundHybridDesc: "百度精确去除文字 + 生成式模型提升画质",
      backgroundGenerative: "生成式获取", backgroundGenerativeDesc: "使用生成式大模型（如Gemini）直接生成背景，背景质量高但有遗留元素的可能",
      backgroundBaidu: "百度抹除服务获取", backgroundBaiduDesc: "使用百度图像修复API，速度快但画质一般",
      usesAiModel: "使用文生图模型",
      costTip: "标有「使用文生图模型」的选项会调用AI图片生成API（如Gemini），每页会产生额外的API调用费用。如果需要控制成本，可选择「百度修复」方式。",
      errorHandling: "错误处理策略", errorHandlingDesc: "配置导出过程中遇到错误时的处理方式",
      allowPartialResult: "允许返回半成品", allowPartialResultDesc: "开启后，导出过程中遇到错误（如样式提取失败、文本渲染失败等）时会跳过错误继续导出，最终可能得到不完整的结果。关闭时，任何错误都会立即停止导出并提示具体原因。",
      allowPartialResultWarning: "开启此选项可能导致导出的 PPTX 文件中部分文字样式丢失、元素位置错误或内容缺失。建议仅在需要快速获取结果且可以接受质量损失时开启。",
      saveExportSettings: "保存导出设置",
      tip: "提示"
    },
    shared: { saving: "保存中..." }
  },
  en: {
    projectSettings: {
      title: "Settings", projectConfig: "Project Settings", exportConfig: "Export Settings", globalConfig: "Global Settings",
      projectConfigTitle: "Project-level Configuration", projectConfigDesc: "These settings only apply to the current project",
      globalConfigTitle: "Global Settings", globalConfigDesc: "These settings apply to all projects",
      extraRequirements: "Extra Requirements", extraRequirementsDesc: "AI will reference these extra requirements when generating each page",
      extraRequirementsPlaceholder: "e.g., Use compact layout, show first-level outline title at top, add richer PPT illustrations...",
      saveExtraRequirements: "Save Extra Requirements",
      styleDescription: "Style Description", styleDescriptionDesc: "Describe your expected PPT overall style, AI will generate pages in that style",
      styleDescriptionPlaceholder: "e.g., Simple business style, use navy blue and white colors, clear fonts, clean layout...",
      saveStyleDescription: "Save Style Description",
      styleTip: "Style description will be automatically added to the prompt when generating images. If a template image is also uploaded, the style description will serve as supplementary notes.",
      editablePptxExport: "Editable PPTX Export Settings", editablePptxExportDesc: "Configure how \"Export Editable PPTX\" works. These settings affect export quality and API call costs.",
      extractorMethod: "Component Extraction Method", extractorMethodDesc: "Choose how to extract editable components like text and tables from PPT images",
      extractorHybrid: "Hybrid Extraction (Recommended)", extractorHybridDesc: "MinerU layout analysis + Baidu high-precision OCR for more accurate text recognition",
      extractorMineru: "MinerU Extraction", extractorMineruDesc: "Use only MinerU for layout analysis and text recognition",
      backgroundMethod: "Background Image Method", backgroundMethodDesc: "Choose how to generate clean background images (remove text from original for PPT background)",
      backgroundHybrid: "Hybrid Method (Recommended)", backgroundHybridDesc: "Baidu precise text removal + generative model quality enhancement",
      backgroundGenerative: "Generative Method", backgroundGenerativeDesc: "Use generative model (like Gemini) to directly generate background, high quality but may have residual elements",
      backgroundBaidu: "Baidu Inpainting", backgroundBaiduDesc: "Use Baidu image repair API, fast but average quality",
      usesAiModel: "Uses AI Image Model",
      costTip: "Options marked \"Uses AI Image Model\" will call AI image generation API (like Gemini), incurring extra API costs per page. To control costs, choose \"Baidu Inpainting\".",
      errorHandling: "Error Handling Strategy", errorHandlingDesc: "Configure how to handle errors during export",
      allowPartialResult: "Allow Partial Results", allowPartialResultDesc: "When enabled, export will skip errors (like style extraction or text rendering failures) and continue, potentially resulting in incomplete output. When disabled, any error will stop export immediately with a specific reason.",
      allowPartialResultWarning: "Enabling this option may result in PPTX files with missing text styles, mispositioned elements, or missing content. Only enable when you need quick results and can accept quality loss.",
      saveExportSettings: "Save Export Settings",
      tip: "Tip"
    },
    shared: { saving: "Saving..." }
  }
};
