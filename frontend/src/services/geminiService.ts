/**
 * Gemini AI 服务
 * 前端直接调用 Google Gemini API
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  textModel?: string;
  imageModel?: string;
  apiBase?: string;
}

export interface OutlineItem {
  part?: string;
  title?: string;
  pages?: OutlineItem[];
  points?: string[];
}

export interface PageDescription {
  title: string;
  content: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private textModel: string;
  private imageModel: string;

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.textModel = config.textModel || 'gemini-2.0-flash-exp';
    this.imageModel = config.imageModel || 'gemini-2.0-flash-exp';
  }

  /**
   * 从想法生成大纲
   */
  async generateOutline(
    ideaPrompt: string,
    language: string = 'zh'
  ): Promise<OutlineItem[]> {
    const model = this.genAI.getGenerativeModel({ model: this.textModel });

    const prompt = `你是一个专业的 PPT 大纲生成助手。请根据用户的想法生成一个结构清晰的 PPT 大纲。

用户想法：
${ideaPrompt}

要求：
1. 生成 5-15 页的 PPT 大纲
2. 每页包含标题和要点
3. 可以分为多个部分（part），每个部分包含多个页面
4. 使用${language === 'zh' ? '中文' : '英文'}
5. 返回 JSON 格式

返回格式示例：
[
  {
    "part": "第一部分：引言",
    "pages": [
      {
        "title": "封面",
        "points": ["主标题", "副标题", "作者信息"]
      },
      {
        "title": "目录",
        "points": ["第一部分", "第二部分", "第三部分"]
      }
    ]
  },
  {
    "title": "结论",
    "points": ["总结要点1", "总结要点2"]
  }
]

请直接返回 JSON，不要包含任何其他文字。`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 提取 JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('无法解析大纲 JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * 解析用户输入的大纲文本
   */
  async parseOutlineText(
    outlineText: string,
    language: string = 'zh'
  ): Promise<OutlineItem[]> {
    const model = this.genAI.getGenerativeModel({ model: this.textModel });

    const prompt = `你是一个专业的 PPT 大纲解析助手。请将用户输入的大纲文本解析为结构化的 JSON 格式。

用户大纲：
${outlineText}

要求：
1. 识别大纲的层级结构
2. 将每个标题转换为一个页面
3. 提取每个标题下的要点
4. 保持原文内容，不要修改
5. 返回 JSON 格式

返回格式示例：
[
  {
    "part": "第一部分",
    "pages": [
      {
        "title": "页面标题",
        "points": ["要点1", "要点2"]
      }
    ]
  }
]

请直接返回 JSON，不要包含任何其他文字。`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('无法解析大纲 JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * 生成页面描述
   */
  async generatePageDescription(
    ideaPrompt: string,
    outline: OutlineItem[],
    pageOutline: OutlineItem,
    pageIndex: number,
    language: string = 'zh'
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.textModel });

    const outlineText = this.formatOutlineText(outline);

    const prompt = `你是一个专业的 PPT 内容生成助手。请为指定的页面生成详细的内容描述。

原始想法：
${ideaPrompt}

完整大纲：
${outlineText}

当前页面（第 ${pageIndex} 页）：
标题：${pageOutline.title}
要点：${pageOutline.points?.join(', ') || '无'}

要求：
1. 生成这一页的详细内容描述
2. 包含标题、正文、要点
3. 内容要具体、有深度
4. 使用${language === 'zh' ? '中文' : '英文'}
5. 适合用于 PPT 页面展示

请直接返回页面描述文本，不要包含 JSON 或其他格式。`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * 生成图片提示词
   */
  async generateImagePrompt(
    pageDescription: string,
    outline: OutlineItem[],
    pageIndex: number
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.textModel });

    const outlineText = this.formatOutlineText(outline);

    const prompt = `你是一个专业的 PPT 页面设计助手。请根据页面描述生成一个详细的图片生成提示词。

页面描述：
${pageDescription}

完整大纲：
${outlineText}

要求：
1. 生成适合 PPT 页面的视觉设计提示词
2. 包含布局、颜色、字体、图片元素等
3. 确保文字清晰可读
4. 风格统一、专业
5. 16:9 比例

请直接返回提示词文本。`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * 生成图片（使用 Gemini 图片生成模型）
   * 使用 chat 兼容格式的 API
   */
  async generateImage(
    prompt: string,
    referenceImages?: (string | File)[]
  ): Promise<string> {
    // 构建消息内容
    const content: any[] = [
      {
        type: 'text',
        text: prompt
      }
    ];

    // 添加参考图片
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        let base64Data: string;

        if (typeof img === 'string') {
          // 如果是 URL，下载并转换为 base64
          const response = await fetch(img);
          const blob = await response.blob();
          base64Data = await this.blobToBase64(blob);
        } else {
          // 如果是 File，直接转换为 base64
          base64Data = await this.fileToBase64(img);
        }

        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Data}`
          }
        });
      }
    }

    // 调用 chat 兼容格式的 API
    const response = await fetch(`${this.genAI.apiKey}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.genAI.apiKey}`
      },
      body: JSON.stringify({
        model: this.imageModel,
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        max_tokens: 16384
      })
    });

    if (!response.ok) {
      throw new Error(`图片生成失败: ${response.statusText}`);
    }

    const result = await response.json();

    // 提取图片数据
    if (result.choices && result.choices.length > 0) {
      const messageContent = result.choices[0].message.content;

      // 检查是否是 data URL 格式
      if (messageContent.startsWith('data:image')) {
        return messageContent;
      }

      // 检查是否是 markdown 图片格式
      if (messageContent.includes('![image]')) {
        const match = messageContent.match(/!\[image\]\((data:image\/[^)]+)\)/);
        if (match) {
          return match[1];
        }
      }

      // 如果是 URL，直接返回
      if (messageContent.startsWith('http://') || messageContent.startsWith('https://')) {
        return messageContent;
      }

      throw new Error('无法从响应中提取图片数据');
    }

    throw new Error('API 响应中没有图片数据');
  }

  /**
   * 将 File 转换为 base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 将 Blob 转换为 base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 格式化大纲为文本
   */
  private formatOutlineText(outline: OutlineItem[]): string {
    const lines: string[] = [];
    let index = 1;

    outline.forEach(item => {
      if (item.part && item.pages) {
        lines.push(`${index}. ${item.part}`);
        item.pages.forEach(page => {
          lines.push(`   ${index}.${item.pages!.indexOf(page) + 1} ${page.title}`);
        });
        index++;
      } else {
        lines.push(`${index}. ${item.title}`);
        index++;
      }
    });

    return lines.join('\n');
  }

  /**
   * 扁平化大纲为页面列表
   */
  flattenOutline(outline: OutlineItem[]): OutlineItem[] {
    const pages: OutlineItem[] = [];

    outline.forEach(item => {
      if (item.part && item.pages) {
        item.pages.forEach(page => {
          pages.push({
            ...page,
            part: item.part
          });
        });
      } else {
        pages.push(item);
      }
    });

    return pages;
  }
}
