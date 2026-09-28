import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { CheckCircle2, ImagePlus, MessageSquare, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { visitorHeaders } from '@/utils/publicDemo';

const copy = {
  zh: {
    trigger: '反馈问题', title: '遇到问题？告诉开发者',
    intro: '很抱歉影响了你的使用。写下发生了什么，开发者会认真查看。',
    message: '问题描述', placeholder: '例如：点击生成后一直停在加载中……',
    email: '联系邮箱（选填）', emailHint: '方便开发者在需要更多信息时联系你；不留也可以提交。',
    imageHint: '可直接粘贴截图，或点击添加图片（最多 3 张，共 4 MB）。提交前请检查截图中的隐私信息。',
    addImage: '添加图片', removeImage: '移除图片', imageTypeError: '请使用 PNG、JPEG 或 WebP 图片。',
    imageLimitError: '最多 3 张图片，总大小不能超过 4 MB。',
    privacy: '反馈会保存问题描述、所添加的图片、选填邮箱和当前页面；不会自动附带项目内容或 API Key。',
    submit: '提交反馈', sending: '正在提交…', success: '已收到，谢谢你告诉开发者。开发者会认真查看。',
    close: '关闭', failed: '暂时无法提交，请稍后重试。', rateLimit: '提交太频繁，请稍后再试。',
  },
  en: {
    trigger: 'Report a problem', title: 'Something went wrong? Tell us',
    intro: "We're sorry this interrupted your work. Tell us what happened and we'll look into it.",
    message: 'What happened?', placeholder: 'For example: generation keeps loading after I click Start…',
    email: 'Your email (optional)', emailHint: 'Only if you would like us to follow up. You can submit without it.',
    imageHint: 'Paste a screenshot here, or add images (up to 3, 4 MB total). Check for private information before sending.',
    addImage: 'Add images', removeImage: 'Remove image', imageTypeError: 'Use PNG, JPEG, or WebP images.',
    imageLimitError: 'Add up to 3 images, 4 MB total.',
    privacy: 'The report saves your description, attached images, optional email, and current page. Project content and API keys are not added automatically.',
    submit: 'Submit feedback', sending: 'Submitting…', success: "Received. Thank you for telling us. We'll take a look.",
    close: 'Close', failed: 'Could not submit right now. Please try again later.', rateLimit: 'Please wait a moment before submitting again.',
  },
} as const;

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
type AttachedImage = { id: string; file: File; url: string };

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
  const [images, setImages] = useState<AttachedImage[]>([]);
  const imageUrls = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    imageUrls.current.forEach(url => URL.revokeObjectURL(url));
    imageUrls.current.clear();
  }, []);

  function addImages(files: File[]) {
    if (files.some(file => !IMAGE_TYPES.has(file.type))) {
      setError(t.imageTypeError);
      return;
    }
    if (images.length + files.length > MAX_IMAGES ||
        [...images.map(image => image.file), ...files].reduce((total, file) => total + file.size, 0) > MAX_IMAGE_BYTES) {
      setError(t.imageLimitError);
      return;
    }
    setError('');
    const added = files.map(file => {
      const url = URL.createObjectURL(file);
      imageUrls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setImages(current => [...current, ...added]);
  }

  function pasteImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile()).filter((file): file is File => file !== null);
    if (files.length) {
      event.preventDefault();
      addImages(files);
    }
  }

  function removeImage(id: string) {
    const removed = images.find(image => image.id === id);
    if (removed) {
      URL.revokeObjectURL(removed.url);
      imageUrls.current.delete(removed.url);
      setImages(current => current.filter(image => image.id !== id));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!message.trim() && images.length === 0) || sending) return;
    setSending(true);
    setError('');
    try {
      const form = new FormData();
      form.set('message', message.trim());
      form.set('email', email.trim());
      form.set('page', window.location.pathname);
      form.set('website', website);
      images.forEach(image => form.append('images', image.file, image.file.name));
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: visitorHeaders(true),
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? t.rateLimit : t.failed);
      setMessage('');
      setEmail('');
      images.forEach(image => {
        URL.revokeObjectURL(image.url);
        imageUrls.current.delete(image.url);
      });
      setImages([]);
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
          <textarea required={images.length === 0} maxLength={3000} rows={5} autoFocus value={message} onChange={event => setMessage(event.target.value)} onPaste={pasteImage} placeholder={t.placeholder}
            className="block w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 outline-none focus:border-banana-500 focus:ring-2 focus:ring-banana-200 dark:border-gray-600 dark:bg-background-tertiary dark:text-white" />
        </label>
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t.imageHint}</p>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label={t.addImage}
            onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:border-banana-400 dark:border-gray-600">
            <ImagePlus size={17} aria-hidden="true" />{t.addImage}
          </button>
          {images.length > 0 && <div className="flex flex-wrap gap-2" aria-label={t.addImage}>
            {images.map((image, index) => <div key={image.id} className="relative h-20 w-24 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
              <img src={image.url} alt={`${t.addImage} ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeImage(image.id)} aria-label={`${t.removeImage} ${index + 1}`}
                className="absolute right-1 top-1 rounded-full bg-gray-900/75 p-1 text-white hover:bg-gray-900"><X size={13} aria-hidden="true" /></button>
            </div>)}
          </div>}
        </div>
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.email}</span>
          <input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-banana-500 focus:ring-2 focus:ring-banana-200 dark:border-gray-600 dark:bg-background-tertiary dark:text-white" />
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{t.emailHint}</span>
        </label>
        <div className="absolute -left-[10000px]" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t.privacy}</p>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={sending || (!message.trim() && images.length === 0)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-banana-400 px-5 py-2.5 font-semibold text-gray-950 hover:bg-banana-300 disabled:cursor-not-allowed disabled:opacity-60">
          <Send size={17} aria-hidden="true" />{sending ? t.sending : t.submit}
        </button>
      </form>}
    </Modal>
  </>;
}
