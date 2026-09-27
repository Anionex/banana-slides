import { useState, type FormEvent } from 'react';
import { CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { visitorHeaders } from '@/utils/publicDemo';

const copy = {
  zh: {
    trigger: '反馈问题', title: '遇到问题？告诉我们',
    intro: '很抱歉影响了你的使用。写下发生了什么，我们会认真查看。',
    message: '问题描述', placeholder: '例如：点击生成后一直停在加载中……',
    email: '联系邮箱（选填）', emailHint: '方便我们需要更多信息时联系你；不留也可以提交。',
    privacy: '反馈会保存问题描述、选填邮箱和当前页面；不会附带项目内容或 API Key。',
    submit: '提交反馈', sending: '正在提交…', success: '已收到，谢谢你告诉我们。我们会认真查看。',
    close: '关闭', failed: '暂时无法提交，请稍后重试。', rateLimit: '提交太频繁，请稍后再试。',
  },
  en: {
    trigger: 'Report a problem', title: 'Something went wrong? Tell us',
    intro: "We're sorry this interrupted your work. Tell us what happened and we'll look into it.",
    message: 'What happened?', placeholder: 'For example: generation keeps loading after I click Start…',
    email: 'Your email (optional)', emailHint: 'Only if you would like us to follow up. You can submit without it.',
    privacy: 'The report saves your description, optional email, and current page. Project content and API keys are not included.',
    submit: 'Submit feedback', sending: 'Submitting…', success: "Received. Thank you for telling us. We'll take a look.",
    close: 'Close', failed: 'Could not submit right now. Please try again later.', rateLimit: 'Please wait a moment before submitting again.',
  },
} as const;

export function FeedbackWidget() {
  const { i18n } = useTranslation();
  const t = copy[i18n.language?.startsWith('zh') ? 'zh' : 'en'];
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...visitorHeaders(true) },
        body: JSON.stringify({ message: message.trim(), email: email.trim(), page: window.location.pathname, website }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? t.rateLimit : t.failed);
      setMessage('');
      setEmail('');
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failed);
    } finally {
      setSending(false);
    }
  }

  return <>
    <button
      type="button"
      onClick={() => { setError(''); setSent(false); setOpen(true); }}
      className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-banana-400 px-5 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-yellow-900/20 transition hover:bg-banana-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-700 sm:bottom-7 sm:right-7"
    >
      <MessageSquare size={18} aria-hidden="true" />{t.trigger}
    </button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={t.title} size="md">
      {sent ? <div className="space-y-5 text-gray-700 dark:text-gray-200">
        <p role="status" className="flex items-start gap-3 leading-relaxed"><CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={22} />{t.success}</p>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-banana-400 px-5 py-2.5 font-semibold text-gray-950 hover:bg-banana-300">{t.close}</button>
      </div> : <form onSubmit={submit} className="space-y-4 text-gray-700 dark:text-gray-200">
        <p className="text-sm leading-relaxed">{t.intro}</p>
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.message}</span>
          <textarea required maxLength={3000} rows={5} autoFocus value={message} onChange={event => setMessage(event.target.value)} placeholder={t.placeholder}
            className="block w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 outline-none focus:border-banana-500 focus:ring-2 focus:ring-banana-200 dark:border-gray-600 dark:bg-background-tertiary dark:text-white" />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.email}</span>
          <input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-banana-500 focus:ring-2 focus:ring-banana-200 dark:border-gray-600 dark:bg-background-tertiary dark:text-white" />
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{t.emailHint}</span>
        </label>
        <div className="absolute -left-[10000px]" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t.privacy}</p>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={sending || !message.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-banana-400 px-5 py-2.5 font-semibold text-gray-950 hover:bg-banana-300 disabled:cursor-not-allowed disabled:opacity-60">
          <Send size={17} aria-hidden="true" />{sending ? t.sending : t.submit}
        </button>
      </form>}
    </Modal>
  </>;
}
