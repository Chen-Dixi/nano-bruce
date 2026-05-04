import { createSignal, onMount, onCleanup } from "solid-js";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import type { Agent } from "@nano-bruce/bruce";
import type { AgentEvent, AgentMessage } from "@nano-bruce/agent-core";
import { createAgentStore } from "./stores/agentStore.js";
import { TopBar } from "./components/TopBar.js";
import { BottomBar } from "./components/BottomBar.js";
import { ChatArea } from "./components/ChatArea.js";
import { WelcomeScreen } from "./components/WelcomeScreen.js";
import { InputBar } from "./components/InputBar.js";

interface TuiAppProps {
  agent: Agent;
  initialMessages?: AgentMessage[];
  provider: string;
  model: string;
  cwd: string;
  onExit?: () => void;
  onSessionSave?: (messages: AgentMessage[]) => void;
}

function App(props: TuiAppProps) {
  const renderer = useRenderer();
  const store = createAgentStore(props.initialMessages || []);
  const [hasStarted, setHasStarted] = createSignal(
    (props.initialMessages?.length || 0) > 0
  );
  const [isProcessing, setIsProcessing] = createSignal(false);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      props.onExit?.();
      renderer.destroy();
      return;
    }
    if (key.name === "escape") {
      props.onExit?.();
      renderer.destroy();
      return;
    }
  });

  onMount(() => {
    const unsub = props.agent.subscribe((event: AgentEvent) => {
      store.handleEvent(event);
      if (event.type === "agent_end" && props.onSessionSave) {
        props.onSessionSave(props.agent.getMessageHistory());
      }
    });
    onCleanup(() => unsub?.());
  });

  async function sendMessage(text: string) {
    if (isProcessing()) return;

    store.addUserMessage(text);
    setHasStarted(true);
    setIsProcessing(true);

    try {
      await props.agent.chat(text);
    } catch (err) {
      console.error("Agent error:", err);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor="#1e1e2e"
      flexDirection="column"
    >
      <TopBar state={store.state} provider={props.provider} model={props.model} />
      {hasStarted() ? (
        <ChatArea
          state={store.state}
          provider={props.provider}
          model={props.model}
        />
      ) : (
        <WelcomeScreen
          onSubmit={sendMessage}
          disabled={isProcessing()}
          provider={props.provider}
          model={props.model}
        />
      )}
      {hasStarted() && (
        <InputBar
          onSubmit={sendMessage}
          disabled={isProcessing()}
          provider={props.provider}
          model={props.model}
        />
      )}
      <BottomBar cwd={props.cwd} />
    </box>
  );
}

export interface LaunchTuiOptions {
  agent: Agent;
  initialMessages?: AgentMessage[];
  provider: string;
  model: string;
  cwd: string;
  onExit?: () => void;
  onSessionSave?: (messages: AgentMessage[]) => void;
}

export async function launchTui(options: LaunchTuiOptions) {
  render(() => (
    <App
      agent={options.agent}
      initialMessages={options.initialMessages}
      provider={options.provider}
      model={options.model}
      cwd={options.cwd}
      onExit={options.onExit}
      onSessionSave={options.onSessionSave}
    />
  ), {
    exitOnCtrlC: false,
  });
}
