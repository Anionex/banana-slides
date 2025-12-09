/**
 * MinerU 文件解析服务
 * 前端直接调用 MinerU API 进行文件解析
 */

export interface MinerUConfig {
  token: string;
  apiBase?: string;
}

export interface ParseTaskResult {
  taskId: string;
  state: 'pending' | 'running' | 'done' | 'failed' | 'converting';
  fullZipUrl?: string;
  errorMessage?: string;
  progress?: {
    extractedPages: number;
    totalPages: number;
    startTime: string;
  };
}

export interface ParseFileOptions {
  modelVersion?: 'pipeline' | 'vlm';
  isOcr?: boolean;
  enableFormula?: boolean;
  enableTable?: boolean;
  language?: string;
  pageRanges?: string;
  extraFormats?: ('docx' | 'html' | 'latex')[];
}

export class MinerUService {
  private token: string;
  private apiBase: string;

  constructor(config: MinerUConfig) {
    this.token = config.token;
    // 在开发环境使用 Vite 代理，避免 CORS 问题
    const isDev = import.meta.env.DEV;
    if (isDev) {
      this.apiBase = '/mineru-api';
      console.log('[MinerU] 开发环境：使用 Vite 代理');
    } else {
      this.apiBase = config.apiBase || 'https://mineru.net/api/v4';
      console.log('[MinerU] 生产环境：直接调用 API');
    }
  }

  /**
   * 解析文件（通过 URL）
   */
  async parseFileByUrl(
    fileUrl: string,
    options: ParseFileOptions = {}
  ): Promise<ParseTaskResult> {
    const response = await fetch(`${this.apiBase}/extract/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        url: fileUrl,
        model_version: options.modelVersion || 'vlm',
        is_ocr: options.isOcr,
        enable_formula: options.enableFormula,
        enable_table: options.enableTable,
        language: options.language,
        page_ranges: options.pageRanges,
        extra_formats: options.extraFormats
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.msg || '创建解析任务失败');
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || '创建解析任务失败');
    }

    const taskId = result.data.task_id;
    
    // 开始轮询任务状态
    return this.pollTaskStatus(taskId);
  }

  /**
   * 上传本地文件并解析
   */
  async parseLocalFile(
    file: File,
    options: ParseFileOptions = {},
    onProgress?: (progress: { extractedPages: number; totalPages: number; startTime: string }) => void
  ): Promise<ParseTaskResult> {
    console.log(`[MinerU] 开始解析文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // 1. 申请上传链接
    console.log('[MinerU] 步骤 1/3: 申请上传链接...');
    const urlResponse = await fetch(`${this.apiBase}/file-urls/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        files: [{ name: file.name }],
        model_version: options.modelVersion || 'vlm',
        enable_formula: options.enableFormula,
        enable_table: options.enableTable,
        language: options.language,
        extra_formats: options.extraFormats
      })
    });

    if (!urlResponse.ok) {
      throw new Error('申请上传链接失败');
    }

    const urlResult = await urlResponse.json();
    
    if (urlResult.code !== 0) {
      throw new Error(urlResult.msg || '申请上传链接失败');
    }

    const batchId = urlResult.data.batch_id;
    const uploadUrl = urlResult.data.file_urls[0];
    console.log(`[MinerU] 获得上传链接，batch_id: ${batchId}`);

    // 2. 上传文件
    console.log('[MinerU] 步骤 2/3: 上传文件...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('文件上传失败');
    }
    console.log('[MinerU] 文件上传成功');

    // 3. 轮询批量任务状态
    console.log('[MinerU] 步骤 3/3: 等待解析完成...');
    return this.pollBatchStatus(batchId, 300, 2000, onProgress);
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<ParseTaskResult> {
    const response = await fetch(`${this.apiBase}/extract/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('查询任务状态失败');
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || '查询任务状态失败');
    }

    const data = result.data;

    return {
      taskId: data.task_id,
      state: data.state,
      fullZipUrl: data.full_zip_url,
      errorMessage: data.err_msg,
      progress: data.extract_progress ? {
        extractedPages: data.extract_progress.extracted_pages,
        totalPages: data.extract_progress.total_pages,
        startTime: data.extract_progress.start_time
      } : undefined
    };
  }

  /**
   * 轮询任务状态直到完成
   */
  private async pollTaskStatus(
    taskId: string,
    maxAttempts: number = 300,
    interval: number = 2000
  ): Promise<ParseTaskResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getTaskStatus(taskId);

      if (status.state === 'done') {
        return status;
      }

      if (status.state === 'failed') {
        throw new Error(status.errorMessage || '解析失败');
      }

      // 继续等待
      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    }

    throw new Error('解析超时');
  }

  /**
   * 查询批量任务状态
   */
  private async getBatchStatus(batchId: string): Promise<ParseTaskResult[]> {
    const response = await fetch(`${this.apiBase}/extract-results/batch/${batchId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('查询批量任务状态失败');
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || '查询批量任务状态失败');
    }

    return result.data.extract_result.map((item: any) => ({
      taskId: batchId,
      state: item.state,
      fullZipUrl: item.full_zip_url,
      errorMessage: item.err_msg,
      progress: item.extract_progress ? {
        extractedPages: item.extract_progress.extracted_pages,
        totalPages: item.extract_progress.total_pages,
        startTime: item.extract_progress.start_time
      } : undefined
    }));
  }

  /**
   * 轮询批量任务状态直到完成
   */
  private async pollBatchStatus(
    batchId: string,
    maxAttempts: number = 300,
    interval: number = 2000,
    onProgress?: (progress: { extractedPages: number; totalPages: number; startTime: string }) => void
  ): Promise<ParseTaskResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statuses = await this.getBatchStatus(batchId);
      const status = statuses[0]; // 只处理第一个文件

      // 输出状态日志
      if (status.state === 'waiting-file') {
        console.log(`[MinerU] 轮询 ${attempts + 1}/${maxAttempts}: 等待文件上传...`);
      } else if (status.state === 'pending') {
        console.log(`[MinerU] 轮询 ${attempts + 1}/${maxAttempts}: 排队中...`);
      } else if (status.state === 'running') {
        if (status.progress) {
          console.log(`[MinerU] 轮询 ${attempts + 1}/${maxAttempts}: 解析中 ${status.progress.extractedPages}/${status.progress.totalPages} 页`);
          // 调用进度回调
          if (onProgress) {
            onProgress(status.progress);
          }
        } else {
          console.log(`[MinerU] 轮询 ${attempts + 1}/${maxAttempts}: 解析中...`);
        }
      } else if (status.state === 'converting') {
        console.log(`[MinerU] 轮询 ${attempts + 1}/${maxAttempts}: 格式转换中...`);
      }

      if (status.state === 'done') {
        console.log('[MinerU] 解析完成！');
        return status;
      }

      if (status.state === 'failed') {
        console.error('[MinerU] 解析失败:', status.errorMessage);
        throw new Error(status.errorMessage || '解析失败');
      }

      // 继续等待
      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    }

    console.error(`[MinerU] 解析超时 (已轮询 ${maxAttempts} 次)`);
    throw new Error('解析超时，请稍后重试');
  }

  /**
   * 下载并解压解析结果
   */
  async downloadResult(zipUrl: string): Promise<Blob> {
    const response = await fetch(zipUrl);
    
    if (!response.ok) {
      throw new Error('下载解析结果失败');
    }

    return response.blob();
  }
}
