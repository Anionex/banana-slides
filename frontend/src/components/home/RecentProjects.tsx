import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, RotateCw } from 'lucide-react';
import { listProjects } from '@/api/endpoints';
import type { Project } from '@/types';
import { useT } from '@/hooks/useT';
import { normalizeProject } from '@/utils';
import { getFirstPageImage, getProjectRoute, getProjectTitle, formatDate } from '@/utils/projectUtils';

const messages = {
  zh: { title: '接着上次的想法', all: '全部项目', empty: '你的下一份演示，从上方开始。', hint: '创建过的项目会出现在这里，随时回来继续。', loading: '正在加载最近项目…', failed: '暂时无法加载最近项目', retry: '重试', pages: '{{count}} 页', open: '继续编辑 {{title}}', noImage: '尚未生成画面' },
  en: { title: 'Pick up where you left off', all: 'All projects', empty: 'Your next presentation starts above.', hint: 'Your projects will appear here, ready to continue.', loading: 'Loading recent projects…', failed: 'Could not load recent projects', retry: 'Retry', pages: '{{count}} pages', open: 'Continue editing {{title}}', noImage: 'No image yet' },
};

export function RecentProjects() {
  const t = useT(messages);
  const [projects, setProjects] = useState<Project[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    listProjects(3, 0).then(response => {
      if (cancelled) return;
      if (!response.data) throw new Error('Missing project list');
      setProjects(response.data.projects.map(normalizeProject));
      setState('ready');
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <section className="studio-recent" aria-labelledby="recent-heading" aria-busy={state === 'loading'}>
      <div className="studio-section-heading"><h2 id="recent-heading">{t('title')}</h2><Link to="/history">{t('all')}<ArrowUpRight size={16} /></Link></div>
      {state === 'loading' ? <p role="status" className="studio-empty">{t('loading')}</p> : state === 'error' ? (
        <div className="studio-empty"><p role="status">{t('failed')}</p><button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCw size={14} />{t('retry')}</button></div>
      ) : projects.length === 0 ? (
        <div className="studio-empty"><FileText size={24} /><p>{t('empty')}</p><small>{t('hint')}</small></div>
      ) : (
        <div className="studio-recent-grid">
          {projects.map(project => {
            const title = getProjectTitle(project);
            const src = getFirstPageImage(project);
            return (
              <Link key={project.id || project.project_id} to={getProjectRoute(project)} className="studio-project" aria-label={t('open', { title })}>
                <div className="studio-project-cover">{src ? <img src={src} alt="" loading="lazy" /> : <span><FileText size={24} />{t('noImage')}</span>}</div>
                <div className="studio-project-info"><h3 title={title}>{title}</h3><ArrowUpRight size={16} /><p>{t('pages', { count: project.pages?.length || 0 })}<span>{formatDate(project.updated_at || project.created_at)}</span></p></div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
