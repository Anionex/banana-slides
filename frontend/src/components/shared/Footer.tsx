import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full py-6 px-4 mt-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-gray-500 dark:text-foreground-tertiary">
          {/* Copyright */}
          <div className="flex items-center gap-1.5">
            <span>© {currentYear}</span>
            <span className="font-medium bg-gradient-to-r from-banana-500 to-banana-400 bg-clip-text text-transparent">
              飞叶智能 FEIYE INTELLIGENCE
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
