import { For } from "solid-js";
import { UserMessage } from "./UserMessage.js";
import { AssistantMessage } from "./AssistantMessage.js";
import { ActivityStatusBar } from "./ActivityStatusBar.js";
import type { AgentState } from "../stores/agentStore.js";

interface ChatAreaProps {
  state: AgentState;
  provider: string;
  model: string;
}

export function ChatArea(props: ChatAreaProps) {
  return (
    <scrollbox
      width="100%"
      flexGrow={1}
      backgroundColor="#1e1e2e"
      stickyScroll
      stickyStart="bottom"
      scrollY
    >
      <For each={props.state.messages}>
        {(msg) => (
          <box width="100%">
            {msg.role === "user" && <UserMessage content={msg.content} />}
            {msg.role === "assistant" && <AssistantMessage message={msg} />}
            {msg.role === "toolResult" && (
              <box paddingLeft={1} paddingRight={1}>
                <text fg="#6c7086" wrapMode="word">
                  {msg.content}
                </text>
              </box>
            )}
          </box>
        )}
      </For>
      {props.state.status !== "idle" && (
        <ActivityStatusBar
          provider={props.provider}
          model={props.model}
          elapsedMs={props.state.elapsedMs}
        />
      )}
    </scrollbox>
  );
}
