import React from 'react';
import { X } from 'lucide-react';

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SponsorModal: React.FC<SponsorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="relative bg-white rounded-2xl shadow-lg max-w-md w-full p-6 md:p-8">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="关闭"
        >
          <X size={20} />
        </button>

        {/* 内容 */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm rounded-full border border-banana-300/50 shadow-sm">
            <span className="text-xl">🎉</span>
            <span className="text-sm font-medium text-gray-700">将要完成！</span>
          </div>

          <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-banana-600 to-orange-500 bg-clip-text text-transparent">
            这款软件怎么样？
          </h3>

          <p className="text-sm md:text-base text-black-600 leading-relaxed">
          项目目前完全由作者自费, <br />
            如果这个项目对您有帮助，<br />
            欢迎请开发者喝杯咖啡 ☕
          </p>

          {/* 赞赏码图片 */}
          <div className="flex justify-center items-center pt-2">
            <div className="relative group">
              <div className="w-56 h-56 bg-white rounded-2xl shadow-lg border-2 border-banana-300/40 flex items-center justify-center overflow-hidden">
                <img
                  src="/sponsor.jpg"
                  alt="赞赏码"
                  className="w-full h-full object-contain p-3"
                />
              </div>

              {/* 装饰性光晕 */}
              <div className="absolute -inset-1 bg-gradient-to-r from-banana-400 to-orange-400 rounded-2xl opacity-20 blur-lg"></div>
            </div>
          </div>

          <p className="text-l text-black-500 pt-2">
            扫码赞赏任意金额，感谢您的支持 ❤️
          </p>

          {/* 底部按钮 */}
          <button
            onClick={onClose}
            className="mt-4 w-full px-6 py-2.5 bg-gradient-to-r from-banana-500 to-banana-600 text-white font-medium rounded-lg "
          >
            离开
          </button>
        </div>
      </div>
    </div>
  );
};

