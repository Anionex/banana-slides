/**
 * StatsCard - displays a single statistic in a card
 */

interface StatsCardProps {
  label: string;
  value: number | string;
}

export default function StatsCard({ label, value }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary p-5 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-foreground-secondary mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">{value}</p>
    </div>
  );
}
