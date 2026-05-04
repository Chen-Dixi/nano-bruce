import { createSignal } from "solid-js";
import { TextAttributes } from "@opentui/core";

interface InputBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  provider?: string;
  model?: string;
}

export function InputBar(props: InputBarProps) {
  const [text, setText] = createSignal("");

  const handleSubmit = () => {
    const t = text().trim();
    if (!t || props.disabled) return;
    props.onSubmit(t);
    setText("");
  };

  const label = () => {
    if (props.provider && props.model) {
      return `${props.provider} · ${props.model}`;
    }
    return "";
  };

  return (
    <box
      height={3}
      width="100%"
      backgroundColor="#181825"
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
    >
      <box flexDirection="row" alignItems="center" gap={1}>
        <box flexGrow={1}>
          <input
            placeholder="Ask anything..."
            value={text()}
            onInput={(value: string) => setText(value || "")}
            onSubmit={handleSubmit}
            backgroundColor="#313244"
            textColor="#cdd6f4"
            focusedBackgroundColor="#45475a"
            width="100%"
          />
        </box>
        {label() && (
          <text fg="#6c7086" attributes={TextAttributes.DIM}>
            {label()}
          </text>
        )}
      </box>
    </box>
  );
}
