// Editorial Command Center — Circular Progress Ring
// Animated SVG ring showing overall audit completion

interface ProgressRingProps {
  progress: number; // 0–100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({ progress, size = 80, strokeWidth = 6, className = "" }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`${progress}% complete`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-amber-100"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="progress-ring-circle text-amber-500"
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-current"
        style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: size * 0.22 }}
        fill="#1A1A18"
      >
        {progress}%
      </text>
    </svg>
  );
}
