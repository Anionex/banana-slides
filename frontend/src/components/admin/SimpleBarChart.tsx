/**
 * SimpleBarChart - pure SVG bar chart (no external deps)
 */

interface SimpleBarChartProps {
  labels: string[];
  values: number[];
  height?: number;
}

export default function SimpleBarChart({ labels, values, height = 220 }: SimpleBarChartProps) {
  const max = Math.max(...values, 1);
  const barCount = values.length;

  // Layout constants
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 50;
  const chartWidth = Math.max(barCount * 24, 400);
  const chartHeight = height;
  const innerH = chartHeight - paddingTop - paddingBottom;
  const innerW = chartWidth - paddingLeft - paddingRight;
  const barW = Math.max(innerW / barCount - 4, 4);

  return (
    <div className="overflow-x-auto">
      <svg
        width={chartWidth}
        height={chartHeight}
        className="text-gray-600 dark:text-foreground-secondary"
      >
        {/* Y axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = paddingTop + innerH * (1 - frac);
          const label = Math.round(max * frac);
          return (
            <g key={frac}>
              <line
                x1={paddingLeft}
                x2={paddingLeft + innerW}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text
                x={paddingLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {values.map((v, i) => {
          const barH = (v / max) * innerH;
          const x = paddingLeft + (innerW / barCount) * i + (innerW / barCount - barW) / 2;
          const y = paddingTop + innerH - barH;

          // Show label for every Nth bar depending on count
          const step = barCount > 15 ? Math.ceil(barCount / 10) : 1;
          const showLabel = i % step === 0 || i === barCount - 1;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                className="fill-banana-500"
              />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={paddingTop + innerH + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                  transform={`rotate(-35, ${x + barW / 2}, ${paddingTop + innerH + 16})`}
                >
                  {labels[i]?.slice(5) /* MM-DD */}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
