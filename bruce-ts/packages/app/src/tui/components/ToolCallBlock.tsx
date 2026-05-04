import { createSignal, For } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { UIToolCall } from "../stores/agentStore.js";

interface ToolCallBlockProps {
  toolCalls: UIToolCall[];
}

function ToolCallItem(props: { toolCall: UIToolCall }) {
  const [expanded, setExpanded] = createSignal(false);
  const tc = () => props.toolCall;

  const statusColor = () => {
    switch (tc().status) {
      case "running":
        return "#f9e2af";
      case "done":
        return "#a6e3a1";
      case "error":
        return "#f38ba8";
      default:
        return "#6c7086";
    }
  };

  const statusIcon = () => {
    switch (tc().status) {
      case "running":
        return "◐";
      case "done":
        return "✓";
      case "error":
        return "✗";
      default:
        return "○";
    }
  };

  const argsText = () => {
    try {
      return JSON.stringify(tc().args, null, 2);
    } catch {
      return String(tc().args);
    }
  };

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingLeft={2}
      gap={0}
    >
      <box
        flexDirection="row"
        gap={1}
        onMouseDown={() => setExpanded(!expanded())}
      >
        <text fg={statusColor()}>{statusIcon()}</text>
        <text fg="#cdd6f4">{tc().name}</text>
        {tc().status === "running" && (
          <text fg="#f9e2af" attributes={TextAttributes.ITALIC}>:: working hard...</text>
        )}
      </box>
      {expanded() && (
        <box flexDirection="column" paddingLeft={3} gap={0}>
          <text fg="#6c7086" attributes={TextAttributes.DIM}>└─ args:</text>
          <text fg="#9399b2" wrapMode="word">{argsText()}</text>
          {tc().result && (
            <box flexDirection="column" gap={0}>
              <text fg="#6c7086" attributes={TextAttributes.DIM}>└─ result:</text>
              <text fg="#9399b2" wrapMode="word">{tc().result}</text>
            </box>
          )}
        </box>
      )}
    </box>
  );
}

export function ToolCallBlock(props: ToolCallBlockProps) {
  return (
    <box width="100%" flexDirection="column" gap={0}>
      <For each={props.toolCalls}>
        {(tc) => <ToolCallItem toolCall={tc} />}
      </For>
    </box>
  );
}
