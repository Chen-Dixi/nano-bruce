import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TextAttributes, ASCIIFont } from "@opentui/core";
import { InputBar } from "./InputBar.js";

interface WelcomeScreenProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  provider?: string;
  model?: string;
}

export function WelcomeScreen(props: WelcomeScreenProps) {

  return (
    <box
      width="100%"
      flexGrow={1}
      backgroundColor="#1e1e2e"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      gap={2}
    >
  
      {ASCIIFont({
      text: "BRUCE",
      font: "block",
      color: "#D4A853",
    })}
      <box width="80%" maxWidth={80}>
        <InputBar
          onSubmit={props.onSubmit}
          disabled={props.disabled}
          provider={props.provider}
          model={props.model}
        />
      </box>
      <text fg="#6c7086" attributes={TextAttributes.DIM}>
        Press Enter to send, Ctrl+C to exit
      </text>
    </box>
  );
}
