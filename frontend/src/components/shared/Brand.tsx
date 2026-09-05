import logoUrl from '@/assets/logo.png';
import { cn } from '@/utils';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn('studio-brand', compact && 'studio-brand-compact')}>
      <img src={logoUrl} alt="" width={32} height={32} />
      <span>蕉幻<span className="studio-brand-english">Banana Slides</span></span>
    </span>
  );
}
