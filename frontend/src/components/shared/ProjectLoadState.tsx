import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { useT } from '@/hooks/useT';
import { Button } from './Button';
import { Loading } from './Loading';

const projectLoadI18n = {
  zh: {
    projectLoad: {
      title: '无法打开项目',
      fallback: '项目加载失败，请检查网络或后端服务后重试。',
      retry: '重试',
      backHome: '返回首页',
    },
  },
  en: {
    projectLoad: {
      title: 'Unable to open project',
      fallback: 'The project could not be loaded. Check the network or backend service and try again.',
      retry: 'Retry',
      backHome: 'Back to Home',
    },
  },
};

interface ProjectLoadStateProps {
  projectId?: string;
  loadingMessage: string;
}

export const ProjectLoadState: React.FC<ProjectLoadStateProps> = ({ projectId, loadingMessage }) => {
  const navigate = useNavigate();
  const t = useT(projectLoadI18n);
  const { projectLoad, syncProject } = useProjectStore();
  const failed = Boolean(
    projectId
    && projectLoad.projectId === projectId
    && projectLoad.status === 'error'
  );

  if (!failed) {
    return <Loading fullscreen message={loadingMessage} />;
  }

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 px-4 dark:bg-background-primary/95">
      <section
        className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl dark:border-amber-900/60 dark:bg-background-secondary"
        role="alert"
        aria-labelledby="project-load-error-title"
      >
        <AlertTriangle className="mx-auto mb-4 text-amber-500" size={48} strokeWidth={1.5} aria-hidden="true" />
        <h1 id="project-load-error-title" className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground-primary">
          {t('projectLoad.title')}
        </h1>
        <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-foreground-tertiary">
          {projectLoad.error || t('projectLoad.fallback')}
        </p>
        <div className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Button variant="secondary" icon={<Home size={16} />} onClick={() => navigate('/')}>
            {t('projectLoad.backHome')}
          </Button>
          <Button onClick={() => void syncProject(projectId)}>
            {t('projectLoad.retry')}
          </Button>
        </div>
      </section>
    </main>
  );
};
