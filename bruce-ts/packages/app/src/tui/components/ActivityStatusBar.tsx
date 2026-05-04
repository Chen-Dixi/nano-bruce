interface ActivityStatusBarProps {
  provider: string;
  model: string;
  elapsedMs: number;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m${s % 60}s`;
  return `${s}.${Math.floor((ms % 1000) / 100)}s`;
}

export function ActivityStatusBar(props: ActivityStatusBarProps) {
  return (
    <box
      width="100%"
      height={1}
      flexDirection="row"
      alignItems="center"
      paddingLeft={1}
      gap={1}
    >
      <text fg="#89b4fa">●</text>
      <text fg="#cdd6f4">
        {"Build · " + props.provider + " · " + props.model + " · " + formatElapsed(props.elapsedMs)}
      </text>
    </box>
  );
}
