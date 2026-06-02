interface ProgressBarProps {
  progress: number;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, progress));

  return (
    <div className="progress-track" aria-label={`当前进度 ${value}%`}>
      <div
        className="progress-fill"
        style={{
          width: `${value}%`,
        }}
      />
    </div>
  );
}
