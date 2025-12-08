import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Rocket, Key, Lightbulb, FileText, Image, Download, ChevronRight, ChevronLeft, X } from 'lucide-react';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    {
      title: '欢迎使用 Banana Slides！🍌',
      description: '一个基于 AI 的智能 PPT 生成工具，让你轻松创作美观专业的演示文稿。',
      icon: <Rocket className="w-16 h-16 text-banana-500" />,
    },
    {
      title: '第一步：配置 API 密钥',
      description: '在开始使用前，你需要配置 API 密钥。我们推荐使用中转API，稳定可靠且易于配置。',
      icon: <Key className="w-16 h-16 text-blue-500" />,
      action: {
        label: '立即配置 API',
        onClick: () => {
          onOpenSettings();
          onClose();
        }
      }
    },
    {
      title: '本站使用流程',
      description: '获取 API 密钥的完整流��：\n\n1️⃣ 注册账号：创建 MaynorAI 账号\n2️⃣ 登录平台：访问控制台\n3️⃣ 充值额度：新用户可免费试用\n4️⃣ 获取令牌：在控制台获取 API Token',
      icon: <ChevronRight className="w-16 h-16 text-amber-500" />
    },
    {
      title: '创建方式灵活多样',
      description: '支持三种创建方式：\n• 从想法创建：输入一个简单的想法，AI帮你生成完整PPT\n• 从大纲创建：提供大纲，快速生成页面\n• 从页面描述创建：直接输入页面描述，精准控制',
      icon: <Lightbulb className="w-16 h-16 text-yellow-500" />,
    },
    {
      title: '智能生成内容',
      description: 'AI 会自动生成：\n• 结构化的大纲\n• 详细的页面描述\n• 精美的配图\n支持多轮编辑和调整',
      icon: <FileText className="w-16 h-16 text-green-500" />,
    },
    {
      title: '上传参考素材',
      description: '可以上传：\n• 参考图片作为风格模板\n• PDF/Word文档提供内容素材\n• 自定义素材库\nAI 会理解并应用到生成中',
      icon: <Image className="w-16 h-16 text-purple-500" />,
    },
    {
      title: '导出与分享',
      description: '完成后可以导出为：\n• PPTX 格式（可编辑）\n• PDF 格式（便于分享）\n支持标准 16:9 比例',
      icon: <Download className="w-16 h-16 text-indigo-500" />,
    },
  ];

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // 标记用户已看过引导
    localStorage.setItem('banana_onboarding_completed', 'true');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSkip} title="" size="lg">
      <div className="relative">
        {/* 关闭按钮 */}
        <button
          onClick={handleSkip}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 进度指示器 */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-banana-500'
                  : index < currentStep
                  ? 'w-2 bg-banana-300'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* 内容区 */}
        <div className="text-center space-y-6 py-8">
          {/* 图标 */}
          <div className="flex justify-center">
            {currentStepData.icon}
          </div>

          {/* 标题 */}
          <h2 className="text-2xl font-bold text-gray-900">
            {currentStepData.title}
          </h2>

          {/* 描述 */}
          <p className="text-gray-600 whitespace-pre-line max-w-md mx-auto leading-relaxed">
            {currentStepData.description}
          </p>

          {/* 特殊操作按钮（如配置API） */}
          {currentStepData.action && (
            <div className="pt-4">
              <Button
                variant="primary"
                onClick={currentStepData.action.onClick}
                className="mx-auto"
              >
                {currentStepData.action.label}
              </Button>
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isFirstStep
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            上一步
          </button>

          <div className="text-sm text-gray-500">
            {currentStep + 1} / {steps.length}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-banana-500 text-white rounded-lg hover:bg-banana-600 transition-colors"
          >
            {isLastStep ? '开始使用' : '下一步'}
            {!isLastStep && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* 跳过按钮 */}
        {!isLastStep && (
          <div className="text-center mt-4">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              跳过引导
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
