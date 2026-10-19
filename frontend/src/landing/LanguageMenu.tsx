import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChoiceMenu } from './ChoiceMenu';

export function LanguageMenu() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const label = language === 'zh' ? '选择语言' : 'Choose language';

  return <ChoiceMenu label={label} value={language} onValueChange={value => { void i18n.changeLanguage(value); }}
    options={[{ value: 'zh', label: '简体中文', lang: 'zh-CN' }, { value: 'en', label: 'English', lang: 'en' }]}
    triggerClassName="landing-language-trigger" trigger={<Globe size={19} aria-hidden="true" />} />;
}
