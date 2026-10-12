import { Menu } from '@base-ui/react/menu';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './language-menu.css';

export function LanguageMenu() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en';
  const label = language === 'zh' ? '选择语言' : 'Choose language';

  return <Menu.Root>
    <Menu.Trigger className="landing-language-trigger" aria-label={label} title={label}>
      <Globe size={19} aria-hidden="true" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner className="landing-language-positioner" sideOffset={10} align="end">
        <Menu.Popup className="landing-language-popup" aria-label={label}>
          <Menu.RadioGroup value={language} onValueChange={value => { void i18n.changeLanguage(value); }}>
            {[{ value: 'zh', label: '简体中文', lang: 'zh-CN' }, { value: 'en', label: 'English', lang: 'en' }].map(option =>
              <Menu.RadioItem key={option.value} value={option.value} closeOnClick className="landing-language-option">
                <span lang={option.lang}>{option.label}</span>
                <Menu.RadioItemIndicator className="landing-language-check"><Check size={16} aria-hidden="true" /></Menu.RadioItemIndicator>
              </Menu.RadioItem>,
            )}
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}
