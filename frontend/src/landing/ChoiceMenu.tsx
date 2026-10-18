import { Menu } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import './language-menu.css';

type ChoiceMenuProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; lang?: string }[];
  trigger: ReactNode;
  triggerClassName: string;
};

/** Shared single-choice dropdown for landing navigation and gallery filters. */
export function ChoiceMenu({ label, value, onValueChange, options, trigger, triggerClassName }: ChoiceMenuProps) {
  return <Menu.Root>
    <Menu.Trigger className={triggerClassName} aria-label={label} title={label}>{trigger}</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner className="landing-language-positioner" sideOffset={10} align="end">
        <Menu.Popup className="landing-language-popup" aria-label={label}>
          <Menu.RadioGroup value={value} onValueChange={onValueChange}>
            {options.map(option => <Menu.RadioItem key={option.value} value={option.value} closeOnClick className="landing-language-option">
              <span lang={option.lang}>{option.label}</span>
              <Menu.RadioItemIndicator className="landing-language-check"><Check size={16} aria-hidden="true" /></Menu.RadioItemIndicator>
            </Menu.RadioItem>)}
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}
