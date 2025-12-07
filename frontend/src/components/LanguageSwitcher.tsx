import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'toggle';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'toggle',
  className = ''
}) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'zh-CN';

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
  };

  if (variant === 'toggle') {
    return (
      <button
        onClick={() => handleLanguageChange(currentLang === 'zh-CN' ? 'en-US' : 'zh-CN')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 ${className}`}
      >
        <Globe size={16} />
        <span>{currentLang === 'zh-CN' ? '🇨🇳' : '🇺🇸'}</span>
      </button>
    );
  }

  return (
    <select
      value={currentLang}
      onChange={(e) => handleLanguageChange(e.target.value)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer ${className}`}
    >
      <option value="zh-CN">🇨🇳 简体中文</option>
      <option value="en-US">🇺🇸 English</option>
    </select>
  );
};

export default LanguageSwitcher;