interface BottomBarProps {
  cwd: string;
  tokenUsage?: string;
}

export function BottomBar(props: BottomBarProps) {
  return (
    <box
      height={1}
      width="100%"
      backgroundColor="#1e1e2e"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg="#6c7086">{props.cwd}</text>
      <text fg="#6c7086">{props.tokenUsage || ""}</text>
      <text fg="#6c7086">ctrl+p commands</text>
    </box>
  );
}
