import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useT } from '@/hooks/useT';

export const DEMO_NOTICE_SEEN_KEY = 'hasSeenPublicDemoNotice';

const messages = {
  zh: {
    title: '应用演示说明',
    description: '该网址目前仅作应用演示，可能存在卡顿或等待问题。',
    recommendation: '如需更完整的体验，请前往 ',
    download: 'GitHub 下载桌面版',
    continue: '我已了解，继续体验',
    punctuation: '。',
  },
  en: {
    title: 'About this demo',
    description: 'This website is currently an application demo. You may experience slowdowns or delays.',
    recommendation: 'For a more complete experience, ',
    download: 'download the desktop app from GitHub',
    continue: 'Got it, continue',
    punctuation: '.',
  },
};

export const DemoNoticeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const t = useT(messages);

  return (
    <Modal isOpen onClose={onClose} title={t('title')} size="md">
      <div className="space-y-4 text-base leading-relaxed text-gray-700 dark:text-foreground-secondary">
        <p>{t('description')}</p>
        <p>
          {t('recommendation')}
          <a
            href="https://github.com/Anionex/banana-slides/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 underline underline-offset-4 hover:text-banana-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-banana-500 dark:text-white dark:hover:text-banana-300"
          >
            {t('download')}
          </a>
          {t('punctuation')}
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose} autoFocus>{t('continue')}</Button>
      </div>
    </Modal>
  );
};
