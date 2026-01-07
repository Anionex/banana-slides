import { useTranslation } from 'react-i18next';
import { cn } from '@/utils';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: '中文' },
];

interface LanguageSwitcherProps {
  className?: string;
  showIcon?: boolean;
}

export function LanguageSwitcher({ className, showIcon = true }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  // Get current language code (handle cases like 'en-US' -> 'en')
  const currentLang = i18n.language?.split('-')[0] || 'en';

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {showIcon && <Globe className="w-4 h-4 text-gray-500" />}
      <select
        value={currentLang}
        onChange={handleChange}
        className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-banana-500 cursor-pointer"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
