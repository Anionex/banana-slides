import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const inputClass = "w-full px-4 py-3 pr-11 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition";

export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={inputClass} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-foreground-secondary"
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
