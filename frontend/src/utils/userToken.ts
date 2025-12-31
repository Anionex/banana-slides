/**
 * 用户 Token 管理模块
 * 用于生成和管理用户的唯一标识符，实现简单的多用户隔离
 */

const USER_TOKEN_KEY = 'banana-slides-user-token';

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取或生成用户 Token
 * 如果 localStorage 中没有，则生成一个新的并存储
 */
export function getUserToken(): string {
  try {
    let token = localStorage.getItem(USER_TOKEN_KEY);
    
    if (!token) {
      // 首次访问，生成新的 token
      token = generateUUID();
      localStorage.setItem(USER_TOKEN_KEY, token);
      console.log('Generated new user token:', token);
    }
    
    return token;
  } catch (error) {
    // 如果 localStorage 不可用（如隐私模式），使用内存中的 token
    console.warn('localStorage not available, using session token');
    if (!sessionUserToken) {
      sessionUserToken = generateUUID();
    }
    return sessionUserToken;
  }
}

/**
 * 清除用户 Token（用于重置身份）
 */
export function clearUserToken(): void {
  try {
    localStorage.removeItem(USER_TOKEN_KEY);
    sessionUserToken = null;
    console.log('User token cleared');
  } catch (error) {
    console.warn('Failed to clear user token:', error);
  }
}

/**
 * 检查是否有用户 Token
 */
export function hasUserToken(): boolean {
  try {
    return !!localStorage.getItem(USER_TOKEN_KEY);
  } catch (error) {
    return !!sessionUserToken;
  }
}

// Session storage fallback (for when localStorage is not available)
let sessionUserToken: string | null = null;


