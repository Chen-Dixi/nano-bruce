import { ThinkingBlock } from "./ThinkingBlock.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import type { UIMessage } from "../stores/agentStore.js";

interface AssistantMessageProps {
  message: UIMessage;
}

export function AssistantMessage(props: AssistantMessageProps) {
  const msg = () => props.message;
  const hasThinking = () => !!msg().thinking && msg().thinking!.length > 0;
  const hasToolCalls = () => !!msg().toolCalls && msg().toolCalls!.length > 0;

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <box flexGrow={1}>
        <text fg="#cdd6f4" wrapMode="word">
          {msg().content}
        </text>
      </box>
      {hasThinking() && (
        <ThinkingBlock content={msg().thinking!} />
      )}
      {hasToolCalls() && (
        <ToolCallBlock toolCalls={msg().toolCalls!} />
      )}
    </box>
  );
}
