import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TextAttributes } from "@opentui/core";
import { InputBar } from "./InputBar.js";

interface WelcomeScreenProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  provider?: string;
  model?: string;
}

function loadLogo(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const logoPath = join(__dirname, "./logo.txt");
    return readFileSync(logoPath, "utf-8");
  } catch {
    return "BRUCE";
  }
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  const logo = loadLogo();

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
      <text fg="#cdd6f4">{logo}</text>
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
