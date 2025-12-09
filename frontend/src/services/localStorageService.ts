/**
 * 本地存储服务
 * 使用 localStorage 存储项目数据
 */

import type { Project, Page } from '@/types';
import type { ReferenceFile } from '@/api/endpoints';

const STORAGE_PREFIX = 'banana_slides_';
const PROJECTS_KEY = `${STORAGE_PREFIX}projects`;
const CURRENT_PROJECT_KEY = `${STORAGE_PREFIX}current_project_id`;
const REFERENCE_FILES_KEY = `${STORAGE_PREFIX}reference_files`;

export class LocalStorageService {
  /**
   * 保存项目
   */
  static saveProject(project: Project): void {
    const projects = this.getAllProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);

    if (existingIndex >= 0) {
      projects[existingIndex] = {
        ...project,
        updated_at: new Date().toISOString()
      };
    } else {
      projects.push({
        ...project,
        created_at: project.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  /**
   * 获取所有项目
   */
  static getAllProjects(): Project[] {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('解析项目数据失败:', error);
      return [];
    }
  }

  /**
   * 获取单个项目
   */
  static getProject(projectId: string): Project | null {
    const projects = this.getAllProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  /**
   * 删除项目
   */
  static deleteProject(projectId: string): void {
    const projects = this.getAllProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));

    // 如果删除的是当前项目，清除当前项目ID
    if (this.getCurrentProjectId() === projectId) {
      this.setCurrentProjectId(null);
    }
  }

  /**
   * 设置当前项目ID
   */
  static setCurrentProjectId(projectId: string | null): void {
    if (projectId) {
      localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  }

  /**
   * 获取当前项目ID
   */
  static getCurrentProjectId(): string | null {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  }

  /**
   * 获取当前项目
   */
  static getCurrentProject(): Project | null {
    const projectId = this.getCurrentProjectId();
    if (!projectId) return null;
    return this.getProject(projectId);
  }

  /**
   * 更新页面
   */
  static updatePage(projectId: string, pageId: string, updates: Partial<Page>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const pageIndex = project.pages.findIndex(p => p.id === pageId);
    if (pageIndex < 0) return;

    project.pages[pageIndex] = {
      ...project.pages[pageIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.saveProject(project);
  }

  /**
   * 添加页面
   */
  static addPage(projectId: string, page: Page): void {
    const project = this.getProject(projectId);
    if (!project) return;

    project.pages.push({
      ...page,
      created_at: page.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.saveProject(project);
  }

  /**
   * 删除页面
   */
  static deletePage(projectId: string, pageId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;

    project.pages = project.pages.filter(p => p.id !== pageId);
    this.saveProject(project);
  }

  /**
   * 重新排序页面
   */
  static reorderPages(projectId: string, pageIds: string[]): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const reorderedPages = pageIds
      .map(id => project.pages.find(p => p.id === id))
      .filter(Boolean) as Page[];

    project.pages = reorderedPages.map((page, index) => ({
      ...page,
      order_index: index
    }));

    this.saveProject(project);
  }

  /**
   * 清除所有数据
   */
  static clearAll(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * 导出所有数据（用于备份）
   */
  static exportData(): string {
    const projects = this.getAllProjects();
    return JSON.stringify(projects, null, 2);
  }

  /**
   * 导入数据（用于恢复）
   */
  static importData(jsonData: string): void {
    try {
      const projects = JSON.parse(jsonData);
      if (!Array.isArray(projects)) {
        throw new Error('数据格式错误');
      }
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储使用情况
   */
  static getStorageInfo(): { used: number; total: number; percentage: number } {
    let used = 0;
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          used += value.length;
        }
      }
    });

    // localStorage 通常限制为 5-10MB
    const total = 5 * 1024 * 1024; // 假设 5MB
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage
    };
  }

  /**
   * 保存参考文件
   */
  static saveReferenceFile(file: ReferenceFile): void {
    const files = this.getReferenceFiles();
    const existingIndex = files.findIndex(f => f.id === file.id);

    if (existingIndex >= 0) {
      files[existingIndex] = {
        ...file,
        updated_at: new Date().toISOString()
      };
    } else {
      files.push({
        ...file,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    localStorage.setItem(REFERENCE_FILES_KEY, JSON.stringify(files));
  }

  /**
   * 获取所有参考文件
   */
  static getReferenceFiles(): ReferenceFile[] {
    const data = localStorage.getItem(REFERENCE_FILES_KEY);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('解析参考文件数据失败:', error);
      return [];
    }
  }

  /**
   * 获取单个参考文件
   */
  static getReferenceFile(fileId: string): ReferenceFile | null {
    const files = this.getReferenceFiles();
    return files.find(f => f.id === fileId) || null;
  }

  /**
   * 删除参考文件
   */
  static deleteReferenceFile(fileId: string): void {
    const files = this.getReferenceFiles();
    const filtered = files.filter(f => f.id !== fileId);
    localStorage.setItem(REFERENCE_FILES_KEY, JSON.stringify(filtered));
  }

  /**
   * 获取项目的参考文件
   */
  static getProjectReferenceFiles(projectId: string | null): ReferenceFile[] {
    const files = this.getReferenceFiles();
    if (projectId === null || projectId === 'none') {
      // 返回全局文件（未关联项目）
      return files.filter(f => !f.project_id);
    } else if (projectId === 'all') {
      // 返回所有文件
      return files;
    } else {
      // 返回特定项目的文件
      return files.filter(f => f.project_id === projectId);
    }
  }

  /**
   * 关联文件到项目
   */
  static associateFileToProject(fileId: string, projectId: string): void {
    const file = this.getReferenceFile(fileId);
    if (!file) return;

    file.project_id = projectId;
    file.updated_at = new Date().toISOString();
    this.saveReferenceFile(file);
  }
}
