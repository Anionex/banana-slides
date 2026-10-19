import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, FileText, Upload, X } from 'lucide-react';
import { visitorHeaders } from '../../utils/publicDemo';
import type { GalleryLanguage } from './catalog';
import { FeedbackDialog } from '../FeedbackDialog';
import './gallery-submission.css';

const MAX_BYTES = 50 * 1024 * 1024;
export function GallerySubmission({ language }: { language: GalleryLanguage }) {
  const zh = language === 'zh';
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receipt, setReceipt] = useState<{ page_count: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => { if (request.current) { request.current.onload = null; request.current.onerror = null; request.current.ontimeout = null; request.current.abort(); } }, []);

  function choose(next: File | undefined) {
    if (!next || sending) return;
    setReceipt(null); setError(''); setFile(null);
    if (input.current) input.current.value = '';
    if (!next.name.toLowerCase().endsWith('.pdf') || (next.type && next.type !== 'application/pdf')) {
      setError(zh ? '请选择 PDF 文件，不支持 PPTX 或图片。' : 'Choose a PDF, rather than a PPTX or image.'); return;
    }
    if (next.size > MAX_BYTES || next.size === 0) {
      setError(zh ? '请选择 50 MB 以内、非空的 PDF。' : 'Choose a non-empty PDF up to 50 MB.'); return;
    }
    setFile(next);
  }
  function submit() {
    if (!file || request.current) return;
    const xhr = new XMLHttpRequest(); request.current = xhr;
    setSending(true); setProgress(0); setError('');
    const finish = () => { request.current = null; setSending(false); };
    const fail = (code?: string) => {
      const messages: Record<string, [string, string]> = {
        NOT_BANANA_EXPORT: ['未识别到 Banana Slides 导出标记。请从应用直接导出完整 PDF 后重试。', 'Banana Slides export metadata was not found. Export the complete PDF directly from the app and try again.'],
        INVALID_PDF: ['无法读取这份 PDF。请提交直接导出的完整、未加密文件，最多 500 页。', 'This PDF could not be read. Use a complete, unencrypted export with up to 500 slides.'],
        PDF_TOO_LARGE: ['PDF 不能超过 50 MB。', 'The PDF must be 50 MB or smaller.'],
        SUBMISSION_RATE_LIMIT: ['提交太频繁，请稍等一分钟再试。', 'Please wait a minute before sending another presentation.'],
      };
      setError(messages[code || '']?.[zh ? 0 : 1] || (zh ? '提交未确认，文件已保留。请检查网络后重试；同一文件不会重复保存。' : 'Submission was not confirmed. Your file is still selected. Check your connection and retry; the same file will not be saved twice.'));
      finish();
    };
    xhr.open('POST', '/api/gallery/submissions'); xhr.timeout = 180000;
    Object.entries(visitorHeaders(true)).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.onerror = () => fail(); xhr.ontimeout = () => fail();
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { fail(); return; }
      if (xhr.status < 200 || xhr.status >= 300 || !data.data?.received) { fail(data.error?.code); return; }
      setReceipt(data.data); setFile(null); if (input.current) input.current.value = ''; finish();
    };
    const body = new FormData(); body.set('file', file); xhr.send(body);
  }
  return <><section className="gallery-submission" aria-labelledby="gallery-submission-title">
    <img className="gallery-submission-art" src="/gallery/share-presentation.webp" width={480} height={320} alt="" loading="lazy" decoding="async" />
    <div className="gallery-submission-intro">
      <h2 id="gallery-submission-title">{zh ? '也想分享你的作品？' : 'Made something with Banana Slides?'}</h2>
      <p>{zh ? '把你用 Banana Slides 制作的整套幻灯片发给我们。' : 'Send us a complete presentation you created with Banana Slides.'}</p>
    </div>
    <button ref={trigger} type="button" className="gallery-submission-entry" onClick={() => setOpen(true)}>{zh ? '提交作品' : 'Share your presentation'}<ArrowUpRight size={17} aria-hidden="true" /></button>
  </section>
  <FeedbackDialog isOpen={open} onClose={() => setOpen(false)} title={zh ? '提交你的作品' : 'Share your presentation'} className="landing-page gallery-submission-dialog" returnFocus={() => trigger.current}>
    <p className="gallery-submission-description">{zh ? '请上传从 Banana Slides 直接导出的完整 PDF。文件仅供管理员查看，不会自动公开。' : 'Upload the complete PDF exported directly from Banana Slides. Only administrators can view it; it will not be published automatically.'}</p>
    <div className="gallery-submission-form" aria-busy={sending} data-dragging={dragging}
      onDragEnter={event => { event.preventDefault(); if (!sending && event.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); } }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = sending ? 'none' : 'copy'; }}
      onDragLeave={event => { event.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={event => {
        event.preventDefault(); dragDepth.current = 0; setDragging(false);
        if (sending) return;
        if (event.dataTransfer.files.length !== 1) { setError(zh ? '请一次选择一份完整 PDF。' : 'Choose one complete PDF at a time.'); return; }
        choose(event.dataTransfer.files[0]);
      }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" aria-label={zh ? '选择完整 PDF' : 'Choose a complete PDF'} hidden onChange={event => choose(event.target.files?.[0])} />
      {receipt ? <div className="gallery-submission-success" role="status"><Check size={20} aria-hidden="true" /><div><strong>{zh ? '作品已收到' : 'Presentation received'}</strong><p>{zh ? `${receipt.page_count} 页 PDF 已保存，仅管理员可见。` : `${receipt.page_count} slides saved. Only administrators can access the PDF.`}</p><button type="button" onClick={() => { setReceipt(null); input.current?.click(); }}>{zh ? '选择另一份作品' : 'Choose another presentation'}</button></div></div> : <>
        {file ? <div className="gallery-submission-file"><FileText size={22} aria-hidden="true" /><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></div><button type="button" disabled={sending} aria-label={zh ? '移除文件' : 'Remove file'} onClick={() => { setFile(null); setError(''); if (input.current) input.current.value = ''; }}><X size={16} /></button></div> : <div className="gallery-submission-empty">
          <span className="gallery-submission-icon" aria-hidden="true"><FileText size={20} /></span>
          <p>{dragging ? (zh ? '松开，添加这份作品' : 'Drop to add your presentation') : (zh ? '把完整 PDF 拖到这里' : 'Drop your complete PDF here')}</p>
          <button className="gallery-submission-pick" type="button" onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" /><span>{zh ? '选择 PDF 文件' : 'Choose PDF file'}</span></button>
        </div>}
        <p className="gallery-submission-note">{zh ? 'PDF · 最大 50 MB · 最多 500 页' : 'PDF · Up to 50 MB · Up to 500 slides'}</p>
        {file && <div className="gallery-submission-send"><button type="button" disabled={sending} onClick={submit}>{sending ? (progress < 100 ? (zh ? `上传中 ${progress}%` : `Uploading ${progress}%`) : (zh ? '正在检查导出信息…' : 'Checking export metadata…')) : (zh ? '提交作品' : 'Send presentation')}{!sending && <ArrowUpRight size={16} aria-hidden="true" />}</button>{sending && <div className="gallery-submission-progress" role="progressbar" aria-label={zh ? '上传进度' : 'Upload progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}</div>}
      </>}
      {error && <p className="gallery-submission-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></p>}
    </div>
  </FeedbackDialog></>;
}
