import type { Project } from '@/types';
import { useT } from '@/hooks/useT';
import { getProjectTitle } from '@/utils/projectUtils';

const messages = {
  zh: { workspace: '创作进度', outline: '梳理大纲', detail: '编写内容', style: '配置风格', preview: '设计与导出', pages: '{{count}} 页' },
  en: { workspace: 'Creation progress', outline: 'Outline', detail: 'Content', style: 'Style', preview: 'Design & export', pages: '{{count}} pages' },
};

// Informational, not navigation: keep the editors' save and readiness guards intact.
export function WorkspaceContext({ project, stage }: { project: Project; stage: 'outline' | 'detail' | 'style' | 'preview' }) {
  const t = useT(messages);
  const stages = project.template_mode === 'multi' ? ['outline', 'detail', 'style', 'preview'] : ['outline', 'detail', 'preview'];
  return (
    <div className="studio-context">
      <div className="studio-project-name"><span title={getProjectTitle(project)}>{getProjectTitle(project)}</span><small>{t('pages', { count: project.pages.length })}</small></div>
      <ol aria-label={t('workspace')} className="studio-stages">
        {stages.map((item, index) => (
          <li key={item} aria-current={item === stage ? 'step' : undefined}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{t(item)}
          </li>
        ))}
      </ol>
    </div>
  );
}
