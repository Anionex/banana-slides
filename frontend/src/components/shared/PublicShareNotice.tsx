import { SponsorModal } from './SponsorModal';
import { useEffect, useState } from 'react';
import { Button, Modal, useToast } from '@/components/shared';

export function PublicShareNotice({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const { show, ToastContainer } = useToast();
  const url = `${window.location.origin}/project/${encodeURIComponent(projectId)}/preview`;
  const storageKey = `public-preview-reminder:${projectId}`;
  useEffect(() => {
    try { setOpen(localStorage.getItem(storageKey) !== 'seen'); }
    catch { setOpen(true); }
  }, [storageKey]);
  const close = () => {
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* unavailable storage */ }
    setOpen(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      show({ message: 'PPT 链接已复制，请保存到书签或笔记中。', type: 'success' });
    } catch { show({ message: '自动复制失败，请选中下方链接手动复制。', type: 'info' }); }
  };
  return <>
    <Button variant="secondary" onClick={() => setOpen(true)}>分享 / 保存链接</Button>
    <Modal isOpen={open} onClose={close} title="请保存当前 PPT 链接">
      <div className="space-y-4">
        <p>公开版不提供历史记录。如果想回来查看，请保存下面的链接，后续直接打开即可访问当前 PPT。</p>
        <p className="font-medium text-amber-700 dark:text-amber-400">如果链接丢失，将无法再次访问此 PPT。</p>
        <p className="text-sm text-gray-500">也可以将链接分享给他人查看，请只分享你愿意公开的内容。</p>
        <label className="block text-sm">当前 PPT 链接<input aria-label="当前 PPT 链接" className="mt-2 w-full rounded-lg border border-gray-300 dark:border-border-primary bg-transparent p-3" value={url} readOnly onFocus={e => e.target.select()} /></label>
        <div className="flex gap-3"><Button onClick={() => void copy()}>复制链接</Button><Button variant="secondary" onClick={close}>我知道了</Button></div>
      </div>
        <button className="mt-4 text-sm text-banana-700 underline" onClick={() => { close(); setSponsorOpen(true); }}>打赏作者 ☕</button>
    </Modal><SponsorModal isOpen={sponsorOpen} onClose={() => setSponsorOpen(false)} /><ToastContainer />
  </>;
}
