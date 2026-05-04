import { createStore, produce } from "solid-js/store";
import type { AgentEvent, AgentMessage, AgentToolResult } from "@nano-bruce/agent-core";
import type { ChatStreamEvent } from "@nano-bruce/ai";

export type ToolCallStatus = "pending" | "running" | "done" | "error";

export interface UIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "toolResult";
  content: string;
  thinking?: string;
  toolCalls?: UIToolCall[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface AgentState {
  messages: UIMessage[];
  status: "idle" | "thinking" | "executing";
  elapsedMs: number;
  isTimerRunning: boolean;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractTextContent(msg: AgentMessage): string {
  if (!msg.content) return "";
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as any).text || "")
    .join("");
}

function extractThinkingContent(msg: AgentMessage): string {
  if (!msg.content || typeof msg.content === "string") return "";
  return msg.content
    .filter((c) => c.type === "thinking")
    .map((c) => (c as any).thinking || "")
    .join("");
}

export function createAgentStore(initialMessages: AgentMessage[] = []) {
  const [state, setState] = createStore<AgentState>({
    messages: initialMessages.map((m) => ({
      id: generateId(),
      role: m.role as "user" | "assistant" | "toolResult",
      content: extractTextContent(m),
      thinking: m.role === "assistant" ? extractThinkingContent(m) : undefined,
      timestamp: Date.now(),
    })),
    status: "idle",
    elapsedMs: 0,
    isTimerRunning: false,
  });

  function startTimer() {
    if (timerInterval) return;
    setState("isTimerRunning", true);
    const startTime = Date.now() - state.elapsedMs;
    timerInterval = setInterval(() => {
      setState("elapsedMs", Date.now() - startTime);
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    setState("isTimerRunning", false);
  }

  function resetTimer() {
    stopTimer();
    setState("elapsedMs", 0);
  }

  function addUserMessage(text: string): UIMessage {
    const msg: UIMessage = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setState("messages", (msgs) => [...msgs, msg]);
    return msg;
  }

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case "agent_start": {
        resetTimer();
        startTimer();
        setState("status", "thinking");
        break;
      }
      case "agent_end": {
        stopTimer();
        setState("status", "idle");
        setState(
          "messages",
          produce((msgs) => {
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              last.isStreaming = false;
            }
          }),
        );
        break;
      }
      case "turn_start": {
        setState("status", "thinking");
        break;
      }
      case "turn_end": {
        setState("status", "idle");
        break;
      }
      case "message_start": {
        const msg = event.message;
        if (msg.role === "assistant") {
          const uiMsg: UIMessage = {
            id: generateId(),
            role: "assistant",
            content: extractTextContent(msg),
            thinking: extractThinkingContent(msg),
            isStreaming: true,
            timestamp: Date.now(),
          };
          setState("messages", (msgs) => [...msgs, uiMsg]);
        } else if (msg.role === "toolResult") {
          const uiMsg: UIMessage = {
            id: generateId(),
            role: "toolResult",
            content: extractTextContent(msg),
            timestamp: Date.now(),
          };
          setState("messages", (msgs) => [...msgs, uiMsg]);
        }
        break;
      }
      case "message_update": {
        const e = event.assistantMessageEvent;
        setState(
          "messages",
          produce((msgs) => {
            const last = msgs[msgs.length - 1];
            if (!last || last.role !== "assistant") return;

            if (e.type === "text_delta") {
              last.content += e.delta;
            } else if (e.type === "thinking_delta") {
              last.thinking = (last.thinking || "") + e.delta;
            } else if (e.type === "text_start") {
              last.isStreaming = true;
            } else if (e.type === "text_end") {
              last.isStreaming = false;
            }
          }),
        );
        break;
      }
      case "message_end": {
        setState(
          "messages",
          produce((msgs) => {
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              last.content = extractTextContent(event.message);
              last.thinking = extractThinkingContent(event.message);
              last.isStreaming = false;
            }
          }),
        );
        break;
      }
      case "tool_execution_start": {
        setState("status", "executing");
        setState(
          "messages",
          produce((msgs) => {
            const last = msgs[msgs.length - 1];
            if (!last || last.role !== "assistant") return;
            if (!last.toolCalls) last.toolCalls = [];
            last.toolCalls.push({
              id: event.toolCallId,
              name: event.toolName,
              args: event.args,
              status: "running",
            });
          }),
        );
        break;
      }
      case "tool_execution_end": {
        setState(
          "messages",
          produce((msgs) => {
            for (let i = msgs.length - 1; i >= 0; i--) {
              const msg = msgs[i];
              if (msg.role !== "assistant" || !msg.toolCalls) continue;
              const tc = msg.toolCalls.find((t) => t.id === event.toolCallId);
              if (tc) {
                tc.status = event.isError ? "error" : "done";
                tc.result = event.result.content;
                tc.isError = event.isError;
                break;
              }
            }
          }),
        );
        break;
      }
    }
  }

  return {
    state,
    addUserMessage,
    handleEvent,
    startTimer,
    stopTimer,
    resetTimer,
  };
}

export type AgentStore = ReturnType<typeof createAgentStore>;
