import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Lock } from 'lucide-react';
import { apiClient } from '@/api/client';
import { publicPartners } from '@/utils/publicDemo';
import { Button, useToast, useConfirm } from '@/components/shared';
import { getSettings } from '@/api/endpoints';

import { ASPECT_RATIO_OPTIONS } from '@/config/aspectRatio';

type Data = Record<string, unknown>;
type ServiceResult = { status: 'running' | 'success' | 'error'; provider: string; message: string; detail?: string };
const services = [
  ['text-model', '文本模型'], ['caption-model', '图片识别'], ['image-model', '图像生成'],
  ['mineru-pdf', 'MinerU 解析'], ['baidu-ocr', '百度 OCR'], ['baidu-inpaint', '百度图像修复'],
] as const;
const editableFields = ['partner', 'image_resolution', 'image_aspect_ratio', 'max_description_workers', 'max_image_workers',
  'output_language', 'description_generation_mode', 'enable_text_reasoning', 'text_thinking_budget',
  'enable_image_reasoning', 'image_thinking_budget', 'enable_image_quality_control', 'elevenlabs_enabled', 'elevenlabs_voice_id'];
const secretFields = [
  ['api_key', 'API Key'], ['mineru_token', 'MinerU Token'], ['baidu_api_key', '百度 OCR API Key'],
  ['elevenlabs_api_key', 'ElevenLabs API Key'],
];
export function PublicSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [data, setData] = useState<Data>({});
  const [saved, setSaved] = useState<Data>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, ServiceResult>>({});
  const activeTests = useRef(new Map<string, AbortController>());
  const keyDrafts = useRef<Record<string, string>>({});
  useEffect(() => {
    const running = activeTests.current;
    return () => { running.forEach(controller => controller.abort()); running.clear(); };
  }, []);
  const [error, setError] = useState('');
  const apply = (next: Data) => {
    keyDrafts.current = {};
    setSaved(next);
    setData({ ...next, ...Object.fromEntries(secretFields.map(([key]) => [key, ''])) });
  };
  const load = async () => {
    setLoading(true); setError('');
    try { const response = await getSettings(); apply(response.data as unknown as Data); }
    catch { setError('设置加载失败，请重试。'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const set = (key: string, value: string | number | boolean) => setData(prev => ({ ...prev, [key]: value }));
  const partner = publicPartners[String(data.partner)];
  const copyProviderLink = async () => {
    if (!partner?.signup) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(partner.signup);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = partner.signup;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand('copy')) throw new Error('Copy failed');
        } finally {
          textarea.remove();
        }
      }
      show({ message: '链接已复制到剪贴板', type: 'success' });
    } catch {
      show({ message: '复制失败，请手动复制链接', type: 'error' });
    }
  };
  const keyLengths = saved.provider_key_lengths as Record<string, number> | undefined;
  const hasSavedKey = Number(keyLengths?.[String(data.partner)] ?? (data.partner === saved.partner ? saved.api_key_length : 0)) > 0;
  const dirty = editableFields.some(key => data[key] !== saved[key]) || secretFields.some(([key]) => Boolean(data[key]));
  const selectProvider = (next: string) => {
    keyDrafts.current[String(data.partner)] = String(data.api_key || '');
    setData(prev => ({ ...prev, partner: next, api_key: keyDrafts.current[next] || '' }));
  };
  const save = async () => {
    setSaving(true);
    const fields = [...editableFields, ...secretFields.map(([key]) => key)];
    try {
      const response = await apiClient.put('/api/settings', Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]])));
      apply(response.data.data); show({ message: '设置保存成功', type: 'success' });
    } catch { show({ message: '设置保存失败，请重试。', type: 'error' }); }
    finally { setSaving(false); }
  };
  const reset = () => confirm('将清空你保存的所有 API 提供商密钥及个人配置，其他访客不受影响。', () => { void performReset(); }, { title: '重置个人设置' });
  const performReset = async () => {
    setSaving(true);
    try { const response = await apiClient.post('/api/settings/reset'); apply(response.data.data); show({ message: '个人设置已重置', type: 'success' }); }
    catch { show({ message: '重置失败，请重试。', type: 'error' }); }
    finally { setSaving(false); }
  };
  const test = async (name: string) => {
    if (activeTests.current.has(name) || saving || dirty) return;
    const controller = new AbortController();
    activeTests.current.set(name, controller);
    const provider = publicPartners[String(saved.partner)]?.name || '';
    const update = (status: ServiceResult['status'], message: string, detail?: string) => {
      setTestResults(prev => ({ ...prev, [name]: { status, message, detail, provider } }));
    };
    update('running', '正在测试…');
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 600000);
    try {
      const response = (await apiClient.post(`/api/settings/tests/${name}`, {}, { signal: controller.signal })).data;
      const taskId = response.data?.task_id;
      if (!taskId) throw new Error('服务测试未启动');
      while (!controller.signal.aborted) {
        const response = await apiClient.get(`/api/settings/tests/${taskId}/status`, { signal: controller.signal });
        const state = response.data.data;
        if (state?.status === 'COMPLETED') {
          const result = state.result || {};
          const detail = result.reply || result.caption || result.recognized_text || result.content_preview || (result.image_size ? result.image_size.join(' × ') : '');
          update(result.success === false ? 'error' : 'success', state.message || result.message || '测试完成', String(detail));
          return;
        }
        if (state?.status === 'FAILED') throw new Error(state.error || '服务测试失败');
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, 1500);
          controller.signal.addEventListener('abort', finish, { once: true });
        });
      }
    } catch (e) {
      if (!controller.signal.aborted) update('error', e instanceof Error ? e.message : '服务测试失败');
    } finally {
      if (timedOut) update('error', '等待结果超时，请稍后重试。');
      clearTimeout(timeout);
      activeTests.current.delete(name);
    }
  };
  const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-primary px-3 py-2 text-sm disabled:opacity-60';
  const sectionClass = 'rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary p-5 space-y-4';
  return <div className="min-h-screen bg-gray-50 dark:bg-background-primary text-gray-900 dark:text-foreground-primary">
    <header className="border-b border-gray-200 dark:border-border-primary px-4 py-3 flex items-center gap-4 bg-white dark:bg-background-secondary">
      <Button variant="ghost" icon={<Home size={18} />} onClick={() => navigate('/')}>返回首页</Button><h1 className="font-semibold text-lg">设置</h1>
    </header>
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      {location.state?.needsApiKey && <p role="status" className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">请先选择 API 提供商并填写你的 API Key。保存后返回首页继续，刚才的输入已保留。</p>}
      {location.state?.apiVerificationFailed && <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">API Key 验证失败，请检查所选 API 提供商、密钥及账户用量后重试。刚才的文字输入已保留。</p>}
      {loading ? <p role="status">正在加载个人设置…</p> : error ? <div role="alert">{error}<Button onClick={() => void load()}>重试</Button></div> : <>
        <fieldset disabled={saving} className="min-w-0 space-y-5">
        <section className={sectionClass} aria-label="API 配置">
          <h2 className="font-semibold">API 配置</h2>
          <label className="block text-sm space-y-2"><span>API 提供商</span>
            <select className={inputClass} value={String(data.partner)} onChange={e => selectProvider(e.target.value)}>
              {Object.entries(publicPartners).map(([id, profile]) => <option key={id} value={id}>{profile.name}</option>)}
            </select>
          </label>
          <p className="text-sm text-gray-500">{partner?.key_hint}。切换 API 提供商后使用各自保存的密钥。</p>
          <label className="block text-sm space-y-2"><span>API Key</span><input type="password" autoComplete="new-password" className={inputClass} value={String(data.api_key || '')} onChange={e => set('api_key', e.target.value)} placeholder={hasSavedKey ? '已保存，留空保持不变' : '输入该 API 提供商的 API Key'} /></label>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm space-y-2">
            <p className="font-medium">如何获取 API Key</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                前往 {partner?.name} 注册或登录：
                <span className="inline-flex items-center gap-2">
                  <a className="text-blue-600 hover:text-blue-800 underline font-medium" href={partner?.signup} target="_blank" rel="noopener noreferrer">点击此处访问 {partner?.name} →</a>
                  <button type="button" onClick={() => void copyProviderLink()} className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors">复制链接</button>
                </span>
              </li>
              <li>按平台说明充值或订阅对应服务</li>
              <li>创建上方所需类型的 API Key，填入并保存</li>
            </ol>
            <p className="text-xs flex items-center gap-1"><Lock size={12} />你的密钥仅用于你的请求，不会与其他访客共享。</p>
          </div>
        </section>
        <section className={sectionClass} aria-label="模型配置"><h2 className="font-semibold">模型配置</h2>
          {([['文本模型', partner?.text], ['图像生成模型', partner?.image], ['图像描述模型', partner?.caption]]).map(([label, value]) => <label className="block text-sm space-y-2" key={label}><span>{label}</span><input className={inputClass} value={value || ''} disabled readOnly /></label>)}
          <p className="text-xs text-gray-500">模型按所选 API 提供商固定。</p>
        </section>
        <section className={sectionClass}><h2 className="font-semibold">图像与生成设置</h2>
          {([['image_resolution', '图像清晰度', ['1K', '2K', '4K']], ['image_aspect_ratio', '默认图像比例', ASPECT_RATIO_OPTIONS.map(option => option.value)], ['output_language', '输出语言', ['zh', 'en', 'ja', 'auto']], ['description_generation_mode', '描述生成模式', ['streaming', 'parallel']]] as const).map(([key, label, choices]) => <label className="block text-sm space-y-2" key={key}><span>{label}</span><select className={inputClass} value={String(data[key])} onChange={e => set(key, e.target.value)}>{choices.map(value => <option key={value} value={value}>{({ zh: '中文', en: 'English', ja: '日本語', auto: '自动', streaming: '流式', parallel: '并行' } as Record<string, string>)[value] || value}</option>)}</select></label>)}
          {([['max_description_workers', '描述生成最大并发数'], ['max_image_workers', '图像生成最大并发数']] as const).map(([key, label]) => <label className="block text-sm space-y-2" key={key}><span>{label}</span><input className={inputClass} type="number" min={1} max={20} value={Number(data[key])} onChange={e => set(key, Number(e.target.value))} /></label>)}
          {([['enable_text_reasoning', '文本推理模式'], ['enable_image_reasoning', '图像推理模式'], ['enable_image_quality_control', '图像质量检查']] as const).map(([key, label]) => <label className="flex items-center gap-2 text-sm" key={key}><input type="checkbox" checked={Boolean(data[key])} onChange={e => set(key, e.target.checked)} />{label}</label>)}
        </section>
        <section className={sectionClass}><h2 className="font-semibold">推理预算</h2>
          {([['text_thinking_budget', '文本推理预算', 'enable_text_reasoning'], ['image_thinking_budget', '图像推理预算', 'enable_image_reasoning']] as const).map(([key, label, enabled]) => <label className="block text-sm space-y-2" key={key}><span>{label}</span><input className={inputClass} type="number" min={1} max={8192} disabled={!data[enabled]} value={Number(data[key])} onChange={e => set(key, Number(e.target.value))} /></label>)}
        </section>
        <section className={sectionClass}><h2 className="font-semibold">解析与导出配置</h2>
          {secretFields.slice(1).map(([key, label]) => <label className="block text-sm space-y-2" key={key}><span>{label}</span><input className={inputClass} type="password" autoComplete="new-password" value={String(data[key] || '')} placeholder={Number(saved[key + '_length']) > 0 ? '已保存，留空保持不变' : `输入 ${label}`} onChange={e => set(key, e.target.value)} /></label>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(data.elevenlabs_enabled)} onChange={e => set('elevenlabs_enabled', e.target.checked)} />启用 ElevenLabs 视频配音</label>
          <label className="block text-sm space-y-2"><span>ElevenLabs Voice ID</span><input className={inputClass} value={String(data.elevenlabs_voice_id || '')} onChange={e => set('elevenlabs_voice_id', e.target.value)} /></label>
        </section>
        </fieldset>
        <div className="flex gap-3"><Button onClick={() => void save()} disabled={saving}>{saving ? '正在保存…' : '保存设置'}</Button><Button variant="secondary" onClick={() => void reset()} disabled={saving}>重置设置</Button></div>
        <section className={sectionClass}>
          <h2 className="font-semibold">服务测试</h2>
          <p className="text-sm text-gray-500">使用已保存的配置。各项可同时运行，结果独立显示；图像生成可能需要数分钟，最长等待 10 分钟。</p>
          {dirty && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">设置有未保存的修改，请先保存后再开始新测试。已运行的测试继续使用启动时的配置。</p>}
          <div className="space-y-4">{services.map(([name, label]) => {
            const result = testResults[name];
            const running = result?.status === 'running';
            return <div key={name} data-testid={`service-test-${name}`} className="border-t border-gray-100 dark:border-border-primary pt-4 space-y-2">
              <div className="flex items-center justify-between gap-3"><span className="font-medium text-sm">{label}</span>
                <Button variant="secondary" disabled={running || saving || dirty} onClick={() => void test(name)}>{running ? `正在测试${label}…` : `测试${label}`}</Button>
              </div>
              {result && <div role="status" className={`text-sm ${result.status === 'error' ? 'text-red-600' : result.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                <p>{result.provider} · {result.message}</p>
                {result.detail && <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-gray-600 dark:text-foreground-secondary">{result.detail}</p>}
              </div>}
            </div>;
          })}</div>
        </section>
      </>}
    </main><ToastContainer />{ConfirmDialog}
  </div>;
}
