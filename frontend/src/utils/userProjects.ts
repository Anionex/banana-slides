/**
 * 用户项目关联管理工具
 * 用于在前端记录和过滤用户创建的项目
 */

const STORAGE_KEY = 'user_projects_mapping';

interface UserProjectsMapping {
  [userId: string]: string[]; // userId -> projectIds
}

/**
 * 获取用户项目映射
 */
const getMapping = (): UserProjectsMapping => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

/**
 * 保存用户项目映射
 */
const saveMapping = (mapping: UserProjectsMapping): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
};

/**
 * 将项目关联到用户
 * @param userId 用户 ID
 * @param projectId 项目 ID
 */
export const associateProjectToUser = (userId: string, projectId: string): void => {
  const mapping = getMapping();

  if (!mapping[userId]) {
    mapping[userId] = [];
  }

  // 避免重复添加
  if (!mapping[userId].includes(projectId)) {
    mapping[userId].push(projectId);
    saveMapping(mapping);
  }
};

/**
 * 获取用户的所有项目 ID
 * @param userId 用户 ID
 * @returns 项目 ID 列表
 */
export const getUserProjectIds = (userId: string): string[] => {
  const mapping = getMapping();
  return mapping[userId] || [];
};

/**
 * 移除用户的项目关联
 * @param userId 用户 ID
 * @param projectId 项目 ID
 */
export const removeProjectFromUser = (userId: string, projectId: string): void => {
  const mapping = getMapping();

  if (mapping[userId]) {
    mapping[userId] = mapping[userId].filter(id => id !== projectId);
    saveMapping(mapping);
  }
};

/**
 * 检查项目是否属于用户
 * @param userId 用户 ID
 * @param projectId 项目 ID
 * @returns 是否属于该用户
 */
export const isProjectOwnedByUser = (userId: string, projectId: string): boolean => {
  const mapping = getMapping();
  return mapping[userId]?.includes(projectId) || false;
};

/**
 * 获取所有已关联的项目 ID（所有用户的）
 * 用于判断某个项目是否已被任何用户"认领"
 */
export const getAllAssociatedProjectIds = (): Set<string> => {
  const mapping = getMapping();
  const allIds = new Set<string>();

  Object.values(mapping).forEach(projectIds => {
    projectIds.forEach(id => allIds.add(id));
  });

  return allIds;
};

/**
 * 清除用户的所有项目关联
 * @param userId 用户 ID
 */
export const clearUserProjects = (userId: string): void => {
  const mapping = getMapping();
  delete mapping[userId];
  saveMapping(mapping);
};
