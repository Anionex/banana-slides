import { Tooltip } from '@base-ui/react/tooltip';
import { HelpCircle } from 'lucide-react';
import { useId, useState } from 'react';

const copy = {
  zh: {
    label: '了解预约版本',
    title: '预约的是什么？',
    description: '即将推出的 Banana Slides 云端服务，无需自行部署、无需配置 API Key，即可用自然语言创作和修改 PPT。',
    features: '提供独立账号，账号间数据相互隔离。后续计划提供最新功能的抢先体验机会。',
    status: '尚未开放，现仅接受预约；开放后邮件通知。',
  },
  en: {
    label: 'About the upcoming version',
    title: 'What are you signing up for?',
    description: 'The upcoming Banana Slides hosted service: create and edit presentations with natural language, without deploying software or configuring an API key.',
    features: 'Individual accounts with data kept separate between accounts. Early access opportunities for the latest features are also planned.',
    status: 'Not open yet. Join the waitlist to receive an email when the beta opens.',
  },
};

export function WaitlistHelp({ language }: { language: 'zh' | 'en' }) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const tooltipId = useId();
  const text = copy[language];

  return <Tooltip.Root open={open} onOpenChange={setOpen} triggerId={triggerId}>
    <Tooltip.Trigger id={triggerId} className="landing-waitlist-help" aria-label={text.label}
      aria-describedby={open ? tooltipId : undefined}
      delay={150} closeOnClick={false} onClick={() => setOpen(true)}>
      <HelpCircle size={16} aria-hidden="true" />
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={16} className="landing-waitlist-positioner">
        <Tooltip.Popup id={tooltipId} role="tooltip" className="landing-waitlist-tooltip">
          <strong>{text.title}</strong>
          <span>{text.description}</span>
          <span className="landing-waitlist-features">{text.features}</span>
          <span className="landing-waitlist-status">{text.status}</span>
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>;
}
