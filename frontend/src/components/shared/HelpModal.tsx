import React, { useState } from 'react';
import { X, Sparkles, FileText, Palette, MessageSquare, Download, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 结果案例数据
const showcases = [
  {
    image: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644',
    title: '软件开发最佳实践',
  },
  {
    image: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e',
    title: 'DeepSeek-V3.2技术展示',
  },
  {
    image: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7',
    title: '预制菜智能产线装备研发和产业化',
  },
  {
    image: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1',
    title: '钱的演变：从贝壳到纸币的旅程',
  },
];

// 功能介绍数据
const features = [
  {
    icon: <Sparkles className="text-yellow-500" size={24} />,
    title: '灵活多样的创作路径',
    description: '支持想法、大纲、页面描述三种起步方式，满足不同创作习惯。',
    details: [
      '一句话生成：输入一个主题，AI 自动生成结构清晰的大纲和逐页内容描述',
      '自然语言编辑：支持以 Vibe 形式口头修改大纲或描述，AI 实时响应调整',
      '大纲/描述模式：既可一键批量生成，也可手动调整细节',
    ],
  },
  {
    icon: <FileText className="text-blue-500" size={24} />,
    title: '强大的素材解析能力',
    description: '上传多种格式文件，自动解析内容，为生成提供丰富素材。',
    details: [
      '多格式支持：上传 PDF/Docx/MD/Txt 等文件，后台自动解析内容',
      '智能提取：自动识别文本中的关键点、图片链接和图表信息',
      '风格参考：支持上传参考图片或模板，定制 PPT 风格',
    ],
  },
  {
    icon: <MessageSquare className="text-green-500" size={24} />,
    title: '"Vibe" 式自然语言修改',
    description: '不再受限于复杂的菜单按钮，直接通过自然语言下达修改指令。',
    details: [
      '局部重绘：对不满意的区域进行口头式修改（如"把这个图换成饼图"）',
      '整页优化：基于 nano banana pro🍌 生成高清、风格统一的页面',
    ],
  },
  {
    icon: <Download className="text-purple-500" size={24} />,
    title: '开箱即用的格式导出',
    description: '一键导出标准格式，直接演示无需调整。',
    details: [
      '多格式支持：一键导出标准 PPTX 或 PDF 文件',
      '完美适配：默认 16:9 比例，排版无需二次调整',
    ],
  },
];

/**
 * 帮助模态框组件
 * 展示结果案例和功能介绍
 */
export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'showcase' | 'features'>('showcase');
  const [currentShowcase, setCurrentShowcase] = useState(0);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  const handlePrevShowcase = () => {
    setCurrentShowcase((prev) => (prev === 0 ? showcases.length - 1 : prev - 1));
  };

  const handleNextShowcase = () => {
    setCurrentShowcase((prev) => (prev === showcases.length - 1 ? 0 : prev + 1));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        {/* 标题区 */}
        <div className="text-center pb-4 border-b border-gray-100">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-banana-50 to-orange-50 rounded-full mb-3">
            <Palette size={18} className="text-banana-600" />
            <span className="text-sm font-medium text-gray-700">蕉幻 · Banana Slides</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">帮助中心</h2>
          <p className="text-sm text-gray-500 mt-1">探索如何使用 AI 快速创建精美 PPT</p>
        </div>

        {/* 选项卡 */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setActiveTab('showcase')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'showcase'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles size={16} />
            结果案例
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'features'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={16} />
            功能介绍
          </button>
        </div>

        {/* 内容区 */}
        <div className="min-h-[400px]">
          {activeTab === 'showcase' ? (
            /* 结果案例 */
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                以下是使用蕉幻生成的 PPT 案例展示
              </p>

              {/* 轮播图 */}
              <div className="relative">
                <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={showcases[currentShowcase].image}
                    alt={showcases[currentShowcase].title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 左右切换按钮 */}
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

              {/* 案例标题 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  {showcases[currentShowcase].title}
                </h3>
              </div>

              {/* 指示点 */}
              <div className="flex justify-center gap-2">
                {showcases.map((_, idx) => (
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

              {/* 缩略图网格 */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {showcases.map((showcase, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentShowcase(idx)}
                    className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      idx === currentShowcase
                        ? 'border-banana-500 ring-2 ring-banana-200'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={showcase.image}
                      alt={showcase.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              {/* 更多案例链接 */}
              <div className="text-center pt-4">
                <a
                  href="https://github.com/Anionex/banana-slides/issues/2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium"
                >
                  <ExternalLink size={14} />
                  查看更多使用案例
                </a>
              </div>
            </div>
          ) : (
            /* 功能介绍 */
            <div className="space-y-3">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl transition-all cursor-pointer ${
                    expandedFeature === idx
                      ? 'border-banana-300 bg-banana-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setExpandedFeature(expandedFeature === idx ? null : idx)}
                >
                  {/* 标题行 */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-gray-800">{feature.title}</h4>
                      <p className="text-sm text-gray-500 truncate">{feature.description}</p>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`text-gray-400 transition-transform flex-shrink-0 ${
                        expandedFeature === idx ? 'rotate-90' : ''
                      }`}
                    />
                  </div>

                  {/* 展开详情 */}
                  {expandedFeature === idx && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="pl-13 space-y-2">
                        {feature.details.map((detail, detailIdx) => (
                          <div key={detailIdx} className="flex items-start gap-2 text-sm text-gray-600">
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
          )}
        </div>

        {/* 底部操作 */}
        <div className="pt-4 border-t flex justify-between items-center">
          <a
            href="https://github.com/Anionex/banana-slides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ExternalLink size={14} />
            GitHub 仓库
          </a>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </Modal>
  );
};
