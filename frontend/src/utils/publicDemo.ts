export let isPublicDemo = false;
export interface PublicPartner {
  name: string; format: string; base: string; text: string; image: string; caption: string;
  signup: string; key_hint: string;
}
export let publicPartners: Record<string, PublicPartner> = {};
let memoryToken = '';
export function visitorHeaders(): Record<string, string> {
  if (!isPublicDemo) return {};
  let token = memoryToken;
  try { token = localStorage.getItem('banana-slides-user-token') || token; } catch { /* private browsing */ }
  if (!/^[a-zA-Z0-9_-]{20,100}$/.test(token)) {
    token = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('banana-slides-user-token', token); } catch { /* use memory */ }
  }
  memoryToken = token;
  return { 'X-User-Token': token };
}
export async function initializePublicDemo(baseURL: string): Promise<void> {
  const response = await fetch(`${baseURL}/api/public-config`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('无法读取站点配置，请稍后重试。');
  const result = await response.json();
  if (typeof result.data?.enabled !== 'boolean') throw new Error('站点配置无效，请稍后重试。');
  isPublicDemo = result.data.enabled;
  publicPartners = result.data.partners || {};
  if (isPublicDemo && import.meta.env.PROD && !document.querySelector('[data-public-analytics]')) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://cloud.umami.is/script.js';
    script.dataset.websiteId = '6bb8b6f0-f744-4111-9745-60791fac53b0';
    script.dataset.publicAnalytics = 'true';
    document.head.appendChild(script);
  }
}
