// 页面状态
export type PageStatus = 'DRAFT' | 'GENERATING_DESCRIPTION' | 'DESCRIPTION_GENERATED' | 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED';

// 项目状态
export type ProjectStatus = 'DRAFT' | 'OUTLINE_GENERATED' | 'DESCRIPTIONS_GENERATED' | 'COMPLETED';

// 大纲内容
export interface OutlineContent {
  title: string;
  points: string[];
}

// 描述内容 - 支持两种格式：后端可能返回纯文本或结构化内容
export type DescriptionContent =
  | {
      // 格式1: 后端返回的纯文本格式
      text: string;
      extra_fields?: Record<string, string>;
      layout_suggestion?: string; // 向后兼容
    }
  | {
      // 格式2: 类型定义中的结构化格式
      title: string;
      text_content: string[];
      extra_fields?: Record<string, string>;
      layout_suggestion?: string; // 向后兼容
    };

// 图片版本
export interface ImageVersion {
  version_id: string;
  page_id: string;
  image_path: string;
  image_url?: string;
  version_number: number;
  is_current: boolean;
  created_at?: string;
}

// 模板模式
export type TemplateMode = 'single' | 'multi';

// 模板选择来源
export type TemplateSelectionSource = 'manual' | 'auto' | 'batch_apply';

// 模板资产解析状态
export type TemplateAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 模板解析区域（文本/图片）
export interface TemplateRegion {
  name: string;
  position: string;
  size: string;
}

// 模板解析结果（PRD §5.3 九字段 schema）
export interface TemplateAnalysis {
  template_role: string;
  layout_structure: string;
  content_capacity: 'low' | 'medium' | 'high';
  text_regions: TemplateRegion[];
  image_regions: TemplateRegion[];
  visual_density: 'low' | 'medium' | 'high';
  style_keywords: string[];
  color_palette: string[];
  notes: string;
}

// 项目模板库中的一张模板资产
export interface TemplateAsset {
  id: string;
  image_url: string;
  thumb_url: string | null;
  analysis_status: TemplateAnalysisStatus;
  analysis_json: TemplateAnalysis | null;
  analysis_notes: string | null;
  analysis_error: string | null;
  user_label: string | null;
  user_edited_analysis: boolean;
  source: 'upload' | 'pdf_split' | 'system_preset';
  sort_order: number;
  referenced_page_ids?: string[];
}

// 页面
export interface Page {
  page_id: string;  // 后端返回 page_id
  id?: string;      // 前端使用的别名
  order_index: number;
  part?: string; // 章节名
  outline_content: OutlineContent | null;
  description_content?: DescriptionContent;
  narration_text?: string; // TTS 旁白文本
  generated_image_url?: string; // 后端返回 generated_image_url
  generated_image_path?: string; // 前端使用的别名
  status: PageStatus;
  created_at?: string;
  updated_at?: string;
  image_versions?: ImageVersion[]; // 历史版本列表
  // 页级模板（per-page template）
  template_asset_id?: string | null;
  template_style_text?: string | null;
  template_selection_source?: TemplateSelectionSource | null;
  template_match_reason?: string | null;
  template_match_confidence?: number | null;
}

export interface NarrationConfig {
  speaker_persona: string;
  target_audience: string;
  speech_tone: string;
  presentation_topic: string;
  min_words: number;
  max_words: number;
}

// 导出设置 - 组件提取方法
export type ExportExtractorMethod = 'mineru' | 'hybrid';

// 导出设置 - 背景图获取方法
export type ExportInpaintMethod = 'generative' | 'baidu' | 'hybrid';

// 项目
export interface Project {
  project_id: string;  // 后端返回 project_id
  id?: string;         // 前端使用的别名
  project_title?: string;
  idea_prompt: string;
  outline_text?: string;  // 用户输入的大纲文本（用于outline类型）
  description_text?: string;  // 用户输入的描述文本（用于description类型）
  extra_requirements?: string; // 额外要求，应用到每个页面的AI提示词
  outline_requirements?: string; // 大纲生成要求
  description_requirements?: string; // 页面描述生成要求
  creation_type?: string;
  template_image_url?: string; // 后端返回 template_image_url
  template_image_path?: string; // 前端使用的别名
  template_style?: string; // 风格描述文本（无模板图模式）
  template_mode?: TemplateMode; // 单/多模板模式（UI hint，底层始终每页一个模板）
  // 导出设置
  export_extractor_method?: ExportExtractorMethod; // 组件提取方法
  export_inpaint_method?: ExportInpaintMethod; // 背景图获取方法
  export_allow_partial?: boolean; // 是否允许返回半成品（导出出错时继续而非停止）
  enable_icon_subject_extraction?: boolean; // 是否对小尺寸图标走百度智能抠图（透明背景）
  image_aspect_ratio?: string; // 画面比例（如 16:9, 4:3）
  status: ProjectStatus;
  pages: Page[];
  created_at: string;
  updated_at: string;
}

/**
 * 素材信息
 */
export interface Material {
  id: string;
  project_id?: string | null;
  filename: string;
  url: string;
  relative_path: string;
  created_at: string;
  updated_at: string;
  prompt?: string;
  original_filename?: string | null;
  source_filename?: string;
  name?: string;
  caption?: string | null;
}

// 任务状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// 任务信息
export interface Task {
  task_id: string;
  id?: string; // 别名
  task_type?: string;
  status: TaskStatus;
  progress?: {
    total: number;
    completed: number;
    failed?: number;
    [key: string]: any; // 允许额外的字段，如material_id, image_url等
  };
  error_message?: string;
  result?: any;
  error?: string; // 别名
  created_at?: string;
  completed_at?: string;
}

// 创建项目请求
export interface CreateProjectRequest {
  idea_prompt?: string;
  outline_text?: string;
  description_text?: string;
  template_image?: File;
  template_style?: string;
  image_aspect_ratio?: string;
}

// API响应
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  task_id?: string;
  message?: string;
  error?: string;
}

// 设置
export interface Settings {
  id: number;
  ai_provider_format: string;
  api_base_url?: string;
  api_key_length: number;
  image_resolution: string;
  image_aspect_ratio: string;
  max_description_workers: number;
  max_image_workers: number;
  text_model?: string;
  image_model?: string;
  mineru_api_base?: string;
  mineru_token_length: number;
  image_caption_model?: string;
  output_language: 'zh' | 'en' | 'ja' | 'auto';
  // 描述生成模式
  description_generation_mode: 'streaming' | 'parallel';
  // 描述额外字段
  description_extra_fields?: string[];
  image_prompt_extra_fields?: string[];
  // 推理模式配置（分别控制文本和图像）
  enable_text_reasoning: boolean;
  text_thinking_budget: number;
  enable_image_reasoning: boolean;
  image_thinking_budget: number;
  baidu_api_key_length: number;
  // LazyLLM 配置
  text_model_source?: string;
  image_model_source?: string;
  image_caption_model_source?: string;
  lazyllm_api_keys_info?: Record<string, number>;  // {vendor: key_length}
  // Per-model API credentials (for gemini/openai per-model overrides)
  text_api_key_length: number;
  text_api_base_url?: string;
  image_api_key_length: number;
  image_api_base_url?: string;
  image_caption_api_key_length: number;
  image_caption_api_base_url?: string;
  // OpenAI image API protocol
  openai_image_api_protocol?: string;
  // OpenAI Codex OAuth
  openai_oauth_connected: boolean;
  openai_oauth_account_id?: string;
  // ElevenLabs TTS
  elevenlabs_enabled: boolean;
  elevenlabs_api_key_length: number;
  elevenlabs_voice_id?: string;
  created_at?: string;
  updated_at?: string;
}
