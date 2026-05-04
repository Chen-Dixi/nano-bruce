import { createSignal } from "solid-js";
import { TextAttributes } from "@opentui/core";

interface ThinkingBlockProps {
  content: string;
}

export function ThinkingBlock(props: ThinkingBlockProps) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingLeft={3}
      paddingRight={1}
      gap={0}
    >
      <box
        flexDirection="row"
        gap={1}
        onMouseDown={() => setExpanded(!expanded())}
      >
        <text
          fg="#6c7086"
          attributes={TextAttributes.ITALIC}
        >
          {expanded() ? "▼" : "▶"} Thinking
        </text>
      </box>
      {expanded() && (
        <box paddingLeft={2}>
          <text
            fg="#6c7086"
            attributes={TextAttributes.ITALIC}
            wrapMode="word"
          >
            {props.content}
          </text>
        </box>
      )}
    </box>
  );
}
