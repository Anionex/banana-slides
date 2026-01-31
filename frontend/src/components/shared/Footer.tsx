import React from 'react';
import { Github } from 'lucide-react';

const GITHUB_REPO = 'Anionex/banana-slides';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full py-6 px-4 mt-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-gray-500 dark:text-foreground-tertiary">
          {/* Copyright */}
          <div className="flex items-center gap-1.5">
            <span>© {currentYear}</span>
            <span className="font-medium bg-gradient-to-r from-banana-600 to-orange-500 bg-clip-text text-transparent">
              蕉幻 Banana Slides
            </span>
          </div>

          {/* Divider - 仅在大屏显示 */}
          <span className="hidden sm:inline text-gray-300 dark:text-border-primary">·</span>

          {/* GitHub Link */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            <Github size={16} />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
