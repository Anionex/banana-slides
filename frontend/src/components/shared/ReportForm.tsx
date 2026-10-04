import React from 'react';

export type ReportFields = {
  topic: string; purpose: string; audience: string; style: string;
  pages: string; points: string; requirements: string;
};
export const emptyReport: ReportFields = {
  topic: '', purpose: '', audience: '', style: '', pages: '', points: '', requirements: '',
};
const labels = {
  zh: { topic: '主题（必填）', purpose: '用途', audience: '目标受众', style: '视觉风格', pages: '预计页数', points: '内容要点', requirements: '补充要求' },
  en: { topic: 'Topic (required)', purpose: 'Purpose', audience: 'Audience', style: 'Visual style', pages: 'Expected slides', points: 'Key points', requirements: 'Additional requirements' },
};
const presets = {
  zh: [
    ['周报/月报', '汇报本期工作进展', '团队成员', '简洁清晰', '8'],
    ['项目汇报', '汇报项目阶段成果', '项目相关方', '专业简洁', '10'],
    ['产品介绍', '介绍产品及其价值', '潜在用户', '清晰直观', '10'],
    ['培训课件', '讲解知识与实践方法', '培训学员', '易读易懂', '15'],
    ['自定义', '', '', '', ''],
  ],
  en: [
    ['Weekly / monthly report', 'Report progress this period', 'Team members', 'Clear and concise', '8'],
    ['Project update', 'Present project milestones', 'Project stakeholders', 'Professional and concise', '10'],
    ['Product introduction', 'Introduce the product and its value', 'Potential users', 'Clear and visual', '10'],
    ['Training', 'Explain concepts and practical methods', 'Learners', 'Easy to follow', '15'],
    ['Custom', '', '', '', ''],
  ],
};
export function buildReportPrompt(fields: ReportFields, zh: boolean): string {
  const names = labels[zh ? 'zh' : 'en'];
  return (Object.keys(fields) as (keyof ReportFields)[])
    .filter(key => fields[key].trim())
    .map(key => `${names[key]}: ${fields[key].trim()}`).join('\n');
}
export function applyReportPreset(fields: ReportFields, index: number, zh: boolean): ReportFields {
  const [, purpose, audience, style, pages] = presets[zh ? 'zh' : 'en'][index];
  return { ...fields, purpose: fields.purpose || purpose, audience: fields.audience || audience,
    style: fields.style || style, pages: fields.pages || pages };
}
export const ReportForm: React.FC<{
  fields: ReportFields; onChange: (fields: ReportFields) => void;
  onRebuild: () => void; zh: boolean; disabled: boolean;
}> = ({ fields, onChange, onRebuild, zh, disabled }) => {
  const names = labels[zh ? 'zh' : 'en'];
  return <fieldset disabled={disabled} className="space-y-3 mb-4" data-testid="report-form">
    <label className="block text-sm">
      {zh ? '场景预设' : 'Scenario'}
      <select defaultValue="" className="block w-full p-2 border rounded-lg dark:bg-background-secondary" onChange={e => onChange(applyReportPreset(fields, Number(e.target.value), zh))}>
        <option value="" disabled>{zh ? '选择场景' : 'Choose a scenario'}</option>
        {presets[zh ? 'zh' : 'en'].map(([name], index) => <option key={index} value={index}>{name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(Object.keys(names) as (keyof ReportFields)[]).map(key => <label key={key} className="text-sm">
        {names[key]}
        {key === 'points' || key === 'requirements'
          ? <textarea className="block w-full p-2 border rounded-lg dark:bg-background-secondary" value={fields[key]} onChange={e => onChange({ ...fields, [key]: e.target.value })} />
          : <input className="block w-full p-2 border rounded-lg dark:bg-background-secondary" type={key === 'pages' ? 'number' : 'text'} min={key === 'pages' ? 1 : undefined} required={key === 'topic'} value={fields[key]} onChange={e => onChange({ ...fields, [key]: e.target.value })} />}
      </label>)}
    </div>
    {!fields.topic.trim() && <p className="text-sm text-amber-700 dark:text-amber-300">{zh ? '请填写主题后继续' : 'Enter a topic to continue'}</p>}
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{zh ? 'Prompt 预览（可直接编辑；手动编辑后，更新字段不会覆盖预览）' : 'Editable prompt preview (field changes preserve your manual edits)'}</span>
      <button type="button" className="text-blue-600 shrink-0" onClick={onRebuild}>{zh ? '从表单更新 Prompt' : 'Rebuild prompt from fields'}</button>
    </div>
  </fieldset>;
};
