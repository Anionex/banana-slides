import React, { useState } from 'react';
import { Sparkles, FileText, Palette, MessageSquare, Download, ChevronLeft, ChevronRight, ExternalLink, Settings, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Showcase data with i18n keys
const showcaseKeys = [
  { image: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644', titleKey: 'softwareDev' },
  { image: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e', titleKey: 'deepseek' },
  { image: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7', titleKey: 'prefabFood' },
  { image: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1', titleKey: 'moneyHistory' },
];

// Feature keys for i18n
const featureKeys = ['flexiblePaths', 'materialParsing', 'vibeEditing', 'easyExport'] as const;
const featureIcons = [
  <Sparkles className="text-yellow-500" size={24} />,
  <FileText className="text-blue-500" size={24} />,
  <MessageSquare className="text-green-500" size={24} />,
  <Download className="text-purple-500" size={24} />,
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [currentShowcase, setCurrentShowcase] = useState(0);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  const totalPages = 3;

  const handlePrevShowcase = () => {
    setCurrentShowcase((prev) => (prev === 0 ? showcaseKeys.length - 1 : prev - 1));
  };

  const handleNextShowcase = () => {
    setCurrentShowcase((prev) => (prev === showcaseKeys.length - 1 ? 0 : prev + 1));
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings');
  };

  const renderGuidePage = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center mr-4">
          <img
            src="/logo.png"
            alt="Banana Slides Logo"
            className="h-16 w-16 object-contain"
          />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">{t('help.welcome')}</h3>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('help.welcomeDesc')}</p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4 p-4 bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 rounded-xl border border-banana-200">
          <div className="flex-shrink-0 w-8 h-8 bg-banana-500 text-white rounded-full flex items-center justify-center font-bold">
            1
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step1Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step1Desc')}
            </p>
            <ul className="text-sm text-gray-600 dark:text-foreground-tertiary space-y-1 pl-4">
              <li>• {t('help.step1Items.apiConfig')}</li>
              <li>• {t('help.step1Items.modelConfig')}</li>
              <li>• {t('help.step1Items.mineruConfig')}</li>
              <li>• {t('help.step1Items.editableExport')}</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
          <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
            2
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step2Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step2Desc')}
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
          <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
            <Check size={18} />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step3Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step3Desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
        <div className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">
          4
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step4Title')}</h4>
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('help.step4Desc')}</p>
        </div>
        <a
          href="https://github.com/Anionex/banana-slides/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium"
        >
          <ExternalLink size={14} />
          {t('help.goToGithubIssue')}
        </a>
      </div>

      <div className="flex justify-center pt-2">
        <Button
          onClick={handleGoToSettings}
          className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white shadow-lg"
          icon={<Settings size={18} />}
        >
          {t('help.goToSettings')}
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          💡 <strong>{t('help.tip')}</strong>：{t('help.tipContent')}
        </p>
      </div>
    </div>
  );

  const renderShowcasePage = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-foreground-tertiary text-center">
        {t('help.showcasesDesc')}
      </p>

      <div className="relative">
        <div className="aspect-video bg-gray-100 dark:bg-background-secondary rounded-xl overflow-hidden shadow-lg">
          <img
            src={showcaseKeys[currentShowcase].image}
            alt={t(`help.showcaseTitles.${showcaseKeys[currentShowcase].titleKey}`)}
            className="w-full h-full object-cover"
          />
        </div>

        <button
          onClick={handlePrevShowcase}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={handleNextShowcase}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground-primary">
          {t(`help.showcaseTitles.${showcaseKeys[currentShowcase].titleKey}`)}
        </h3>
      </div>

      <div className="flex justify-center gap-2">
        {showcaseKeys.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentShowcase(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentShowcase
                ? 'bg-banana-500 w-6'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {showcaseKeys.map((showcase, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentShowcase(idx)}
            className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
              idx === currentShowcase
                ? 'border-banana-500 ring-2 ring-banana-200'
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <img
              src={showcase.image}
              alt={t(`help.showcaseTitles.${showcase.titleKey}`)}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      <div className="text-center pt-4">
        <a
          href="https://github.com/Anionex/banana-slides/issues/2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium"
        >
          <ExternalLink size={14} />
          {t('help.viewMoreCases')}
        </a>
      </div>
    </div>
  );

  const renderFeaturesPage = () => (
    <div className="space-y-3">
      {featureKeys.map((featureKey, idx) => (
        <div
          key={idx}
          className={`border rounded-xl transition-all cursor-pointer ${
            expandedFeature === idx
              ? 'border-banana-300 bg-banana-50/50 shadow-sm dark:shadow-background-primary/30'
              : 'border-gray-200 dark:border-border-primary hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-background-hover'
          }`}
          onClick={() => setExpandedFeature(expandedFeature === idx ? null : idx)}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-background-secondary rounded-lg shadow-sm dark:shadow-background-primary/30 flex items-center justify-center">
              {featureIcons[idx]}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-gray-800 dark:text-foreground-primary">
                {t(`help.features.${featureKey}.title`)}
              </h4>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary truncate">
                {t(`help.features.${featureKey}.description`)}
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`text-gray-400 transition-transform flex-shrink-0 ${
                expandedFeature === idx ? 'rotate-90' : ''
              }`}
            />
          </div>

          {expandedFeature === idx && (
            <div className="px-4 pb-4 pt-0">
              <div className="pl-13 space-y-2">
                {(t(`help.features.${featureKey}.details`, { returnObjects: true }) as string[]).map((detail: string, detailIdx: number) => (
                  <div key={detailIdx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
                    <span className="text-banana-500 mt-1">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        <div className="text-center pb-4 border-b border-gray-100 dark:border-border-primary">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 rounded-full mb-3">
            <Palette size={18} className="text-banana-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('help.title')}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">
            {currentPage === 0 ? t('help.quickStart') : currentPage === 1 ? t('help.featuresIntro') : t('help.showcases')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
            {currentPage === 0 ? t('help.quickStartDesc') : t('help.featuresIntroDesc')}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentPage
                  ? 'bg-banana-500 w-8'
                  : 'bg-gray-300 hover:bg-gray-400 w-2'
              }`}
              title={idx === 0 ? t('help.guidePage') : idx === 1 ? t('help.featuresIntro') : t('help.showcases')}
            />
          ))}
        </div>

        <div className="min-h-[400px]">
          {currentPage === 0 && renderGuidePage()}
          {currentPage === 1 && renderFeaturesPage()}
          {currentPage === 2 && renderShowcasePage()}
        </div>

        <div className="pt-4 border-t flex justify-between items-center">
          <div className="flex items-center gap-2">
            {currentPage > 0 && (
              <Button
                variant="ghost"
                onClick={handlePrevPage}
                icon={<ChevronLeft size={16} />}
                size="sm"
              >
                {t('help.prevPage')}
              </Button>
            )}
          </div>

          <a
            href="https://github.com/Anionex/banana-slides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <ExternalLink size={14} />
            GitHub
          </a>

          <div className="flex items-center gap-2">
            {currentPage < totalPages - 1 ? (
              <Button
                onClick={handleNextPage}
                icon={<ChevronRight size={16} />}
                size="sm"
                className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white"
              >
                {t('help.nextPage')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose} size="sm">
                {t('common.close')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
