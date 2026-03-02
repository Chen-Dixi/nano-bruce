/**
 * Agent 核心循环（参考 Pi agent-loop）
 *
 * 流程：接收初始 prompts → 进入 turn 循环 → 每轮调用 LLM 得到 assistant 消息 →
 * 若有 tool_calls 则执行工具、将结果追加到 context → 再调 LLM，直到无 tool_calls →
 * 检查 getFollowUpMessages，有则继续下一轮，否则 agent_end。
 */

import type { ChatMessage, ChatTool } from "../ai/types.js";
import type {
  AgentContext,
  AgentEvent,
  AgentLoopConfig,
  AgentMessage,
  AgentTool,
  AssistantMessage,
  ToolResultMessage,
  UserMessage,
} from "./types.js";
import { createAgentStream } from "./event-stream.js";

/** 默认：仅保留 user/assistant/toolResult，并转为 ChatMessage[]（system 由调用方在首条注入） */
function defaultConvertToLlm(messages: AgentMessage[], systemPrompt: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (systemPrompt.trim()) out.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant")
      out.push({
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.tool_calls,
      });
    else if (m.role === "toolResult")
      out.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
  }
  return out;
}

/** 将 AgentTool[] 转为 ChatTool[] */
function toolsToChatTools(tools: AgentTool[] | undefined): ChatTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * 从当前 context 调 LLM 获取一条 assistant 消息（非流式，一次返回完整消息）
 */
async function getAssistantResponse(
  context: AgentContext,
  config: AgentLoopConfig
): Promise<AssistantMessage> {
  let messages = context.messages;
  if (config.transformContext) {
    messages = await config.transformContext(messages, config.signal);
  }
  const convert = config.convertToLlm ?? defaultConvertToLlm;
  const chatMessages: ChatMessage[] = await convert(messages, config.systemPrompt);

  const chatResult = await config.provider.chat(chatMessages, {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    tools: toolsToChatTools(config.tools),
    signal: config.signal,
  });

  const msg = chatResult.message;
  return {
    role: "assistant",
    content: msg.content ?? null,
    tool_calls: msg.tool_calls,
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

/**
 * 执行助手消息中的全部 tool_calls，返回 tool 结果消息列表
 */
async function executeToolCalls(
  tools: AgentTool[] | undefined,
  assistantMessage: AssistantMessage,
  config: AgentLoopConfig,
  stream: ReturnType<typeof createAgentStream>
): Promise<{ results: ToolResultMessage[]; steeringMessages: AgentMessage[] | null }> {
  const toolCalls = assistantMessage.tool_calls ?? [];
  const results: ToolResultMessage[] = [];
  let steeringMessages: AgentMessage[] | null = null;

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const tool = tools?.find((t) => t.name === tc.name);

    stream.push({
      type: "tool_execution_start",
      toolCallId: tc.id,
      toolName: tc.name,
      args: parseJsonSafe(tc.arguments),
    });

    let result: { content: string; isError?: boolean };
    try {
      if (!tool) throw new Error(`Tool not found: ${tc.name}`);
      const args = parseJsonSafe(tc.arguments) as Record<string, unknown>;
      const out = await tool.execute(tc.id, args, config.signal);
      result = { content: out.content, isError: out.isError };
    } catch (e) {
      result = {
        content: e instanceof Error ? e.message : String(e),
        isError: true,
      };
    }

    stream.push({
      type: "tool_execution_end",
      toolCallId: tc.id,
      toolName: tc.name,
      result,
      isError: result.isError ?? false,
    });

    const toolResultMsg: ToolResultMessage = {
      role: "toolResult",
      toolCallId: tc.id,
      toolName: tc.name,
      content: result.content,
      isError: result.isError,
      timestamp: Date.now(),
    };
    results.push(toolResultMsg);
    stream.push({ type: "message_start", message: toolResultMsg });
    stream.push({ type: "message_end", message: toolResultMsg });

    if (config.getSteeringMessages) {
      const steering = await config.getSteeringMessages();
      if (steering.length > 0) {
        steeringMessages = steering;
        for (let j = i + 1; j < toolCalls.length; j++) {
          const skip = toolCalls[j];
          const skipResult: ToolResultMessage = {
            role: "toolResult",
            toolCallId: skip.id,
            toolName: skip.name,
            content: "Skipped due to queued user message.",
            isError: true,
            timestamp: Date.now(),
          };
          results.push(skipResult);
          stream.push({ type: "message_start", message: skipResult });
          stream.push({ type: "message_end", message: skipResult });
        }
        break;
      }
    }
  }

  return { results, steeringMessages };
}

function parseJsonSafe(s: string): Record<string, unknown> {
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

/**
 * 启动一次 Agent 循环：将 prompts 加入 context，然后执行 turn 循环直至无 tool_calls 且无 follow-up
 */
export function agentLoop(
  prompts: AgentMessage[],
  context: AgentContext,
  config: AgentLoopConfig
): ReturnType<typeof createAgentStream> {
  const stream = createAgentStream();
  const currentContext: AgentContext = {
    ...context,
    messages: [...context.messages, ...prompts],
  };
  const newMessages: AgentMessage[] = [...prompts];

  (async () => {
    stream.push({ type: "agent_start" });
    stream.push({ type: "turn_start" });
    for (const p of prompts) {
      stream.push({ type: "message_start", message: p });
      stream.push({ type: "message_end", message: p });
    }
    await runLoop(currentContext, newMessages, config, stream);
  })();

  return stream;
}

/**
 * 从当前 context 继续循环（不追加新消息），用于 retry 或继续处理队列
 */
export function agentLoopContinue(
  context: AgentContext,
  config: AgentLoopConfig
): ReturnType<typeof createAgentStream> {
  if (context.messages.length === 0) {
    throw new Error("Cannot continue: no messages in context");
  }
  const last = context.messages[context.messages.length - 1];
  if (last.role === "assistant") {
    throw new Error("Cannot continue from message role: assistant");
  }

  const stream = createAgentStream();
  const currentContext: AgentContext = { ...context };
  const newMessages: AgentMessage[] = [];

  (async () => {
    stream.push({ type: "agent_start" });
    stream.push({ type: "turn_start" });
    await runLoop(currentContext, newMessages, config, stream);
  })();

  return stream;
}

async function runLoop(
  currentContext: AgentContext,
  newMessages: AgentMessage[],
  config: AgentLoopConfig,
  stream: ReturnType<typeof createAgentStream>
): Promise<void> {
  let firstTurn = true;
  let pendingMessages: AgentMessage[] = (await config.getSteeringMessages?.()) ?? [];

  while (true) {
    let hasMoreToolCalls = true;
    let steeringAfterTools: AgentMessage[] | null = null;

    while (hasMoreToolCalls || pendingMessages.length > 0) {
      if (!firstTurn) stream.push({ type: "turn_start" });
      firstTurn = false;

      if (pendingMessages.length > 0) {
        for (const m of pendingMessages) {
          stream.push({ type: "message_start", message: m });
          stream.push({ type: "message_end", message: m });
          currentContext.messages.push(m);
          newMessages.push(m);
        }
        pendingMessages = [];
      }

      const assistantMessage = await getAssistantResponse(currentContext, config);
      currentContext.messages.push(assistantMessage);
      newMessages.push(assistantMessage);

      stream.push({ type: "message_start", message: assistantMessage });
      stream.push({ type: "message_end", message: assistantMessage });

      const toolCalls = assistantMessage.tool_calls ?? [];
      hasMoreToolCalls = toolCalls.length > 0;
      let toolResultsThisTurn: ToolResultMessage[] = [];

      if (hasMoreToolCalls) {
        const { results, steeringMessages } = await executeToolCalls(
          config.tools,
          assistantMessage,
          config,
          stream
        );
        toolResultsThisTurn = results;
        for (const r of results) {
          currentContext.messages.push(r);
          newMessages.push(r);
        }
        steeringAfterTools = steeringMessages;
      }

      stream.push({
        type: "turn_end",
        message: assistantMessage,
        toolResults: toolResultsThisTurn,
      });

      if (steeringAfterTools?.length) {
        pendingMessages = steeringAfterTools;
      } else {
        pendingMessages = (await config.getSteeringMessages?.()) ?? [];
      }
    }

    const followUp = (await config.getFollowUpMessages?.()) ?? [];
    if (followUp.length > 0) {
      pendingMessages = followUp;
      continue;
    }
    break;
  }

  stream.push({ type: "agent_end", messages: newMessages });
  stream.end(newMessages);
}
