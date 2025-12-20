// 页面状态
export type PageStatus = 'DRAFT' | 'DESCRIPTION_GENERATED' | 'GENERATING' | 'COMPLETED' | 'FAILED';

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
    }
  | {
      // 格式2: 类型定义中的结构化格式
      title: string;
      text_content: string[];
      layout_suggestion?: string;
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

// 页面
export interface Page {
  page_id: string;  // 后端返回 page_id
  id?: string;      // 前端使用的别名
  order_index: number;
  part?: string; // 章节名
  outline_content: OutlineContent;
  description_content?: DescriptionContent;
  generated_image_url?: string; // 后端返回 generated_image_url
  generated_image_path?: string; // 前端使用的别名
  status: PageStatus;
  created_at?: string;
  updated_at?: string;
  image_versions?: ImageVersion[]; // 历史版本列表
}

// 项目
export interface Project {
  project_id: string;  // 后端返回 project_id
  id?: string;         // 前端使用的别名
  idea_prompt: string;
  outline_text?: string;  // 用户输入的大纲文本（用于outline类型）
  description_text?: string;  // 用户输入的描述文本（用于description类型）
  extra_requirements?: string; // 额外要求，应用到每个页面的AI提示词
  creation_type?: string;
  template_image_url?: string; // 后端返回 template_image_url
  template_image_path?: string; // 前端使用的别名
  status: ProjectStatus;
  pages: Page[];
  created_at: string;
  updated_at: string;
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
  ai_provider_format: 'openai' | 'gemini';
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
  created_at?: string;
  updated_at?: string;
}


