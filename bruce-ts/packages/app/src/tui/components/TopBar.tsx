import { TextAttributes } from "@opentui/core";
import type { AgentState } from "../stores/agentStore.js";

interface TopBarProps {
  state: AgentState;
  provider: string;
  model: string;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m${s % 60}s`;
  return `${s}.${Math.floor((ms % 1000) / 100)}s`;
}

export function TopBar(props: TopBarProps) {
  const statusIcon = () => {
    switch (props.state.status) {
      case "thinking":
        return "◐";
      case "executing":
        return "◉";
      default:
        return "◯";
    }
  };

  const statusLabel = () => {
    switch (props.state.status) {
      case "thinking":
        return "Thinking";
      case "executing":
        return "Executing";
      default:
        return "Idle";
    }
  };

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
      <box flexDirection="row" gap={1}>
        <text fg="#cdd6f4">{statusIcon() + " " + statusLabel()}</text>
        <text>{"  ·  "}</text>
        <text fg="#89b4fa">{props.provider}</text>
        <text>{" / "}</text>
        <text fg="#a6e3a1">{props.model}</text>
      </box>
      {props.state.isTimerRunning && (
        <text fg="#f9e2af">{formatElapsed(props.state.elapsedMs)}</text>
      )}
    </box>
  );
}
