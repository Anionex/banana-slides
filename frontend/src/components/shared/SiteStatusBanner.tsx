import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Wrench } from 'lucide-react';
import { SponsorModal } from './SponsorModal';

type SiteStatus = 'sufficient' | 'insufficient' | 'maintenance';

interface SiteStatusBannerProps {
  className?: string;
}

export const SiteStatusBanner: React.FC<SiteStatusBannerProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/site-status');
        const data = await response.json();
        setStatus(data.status || 'sufficient');
      } catch (error) {
        console.error('获取站点状态失败:', error);
        setStatus('sufficient'); // 默认显示正常状态
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  if (loading || !status) {
    return null; // 加载中或状态为空时不显示
  }

  const statusConfig = {
    sufficient: {
      icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      iconColor: 'text-green-500',
      title: '✅ 站点运行正常',
      message: (
        <>
          本站点由作者完全自费支持运营，当前运行正常。
          <br />
          如有疑问或合作意向，欢迎联系：
          <a 
            href="mailto:1005128408@qq.com" 
            className="font-semibold underline hover:text-green-700 transition-colors ml-1"
          >
            1005128408@qq.com
          </a>
        </>
      ),
    },
    insufficient: {
      icon: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-900',
      iconColor: 'text-orange-500',
      title: '⚠️ 站点余额不足，可能影响功能使用',
      message: (
        <>
          本站点由作者完全自费支持运营，余额可能会间歇性见底，会尽快补充余额。
          <br />
          也欢迎
          <button
            onClick={() => setIsSponsorModalOpen(true)}
            className="font-semibold underline hover:text-orange-700 transition-colors mx-1"
          >
            打赏作者
          </button>
          ，我会将其全部用于站点维护🚀
          <br />
          如有疑问或合作意向，欢迎联系：
          <a 
            href="mailto:1005128408@qq.com" 
            className="font-semibold underline hover:text-orange-700 transition-colors ml-1"
          >
            1005128408@qq.com
          </a>
        </>
      ),
    },
    maintenance: {
      icon: <Wrench className="w-5 h-5 flex-shrink-0" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-500',
      title: '🔧 系统维护中',
      message: (
        <>
          站点正在进行系统维护，部分功能可能暂时不可用。感谢您的理解与支持！
          <br />
          如有疑问，请联系：
          <a 
            href="mailto:1005128408@qq.com" 
            className="font-semibold underline hover:text-blue-700 transition-colors ml-1"
          >
            1005128408@qq.com
          </a>
        </>
      ),
    },
  };

  const config = statusConfig[status];

  return (
    <>
      <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className={config.iconColor}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${config.textColor} mb-1`}>
              {config.title}
            </h3>
            <p className={`text-sm ${config.textColor} leading-relaxed`}>
              {config.message}
            </p>
          </div>
        </div>
      </div>
      <SponsorModal 
        isOpen={isSponsorModalOpen} 
        onClose={() => setIsSponsorModalOpen(false)} 
      />
    </>
  );
};

