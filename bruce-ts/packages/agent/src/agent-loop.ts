/**
 * Agent 核心循环（参考 Pi agent-loop）
 *
 * 流程：接收初始 prompts → 进入 turn 循环 → 每轮调用 LLM 得到 assistant 消息 →
 * 若有 tool_calls（从 content 中 toolCall 块提取）则执行工具、将结果追加到 context → 再调 LLM，直到无 tool_calls →
 * 检查 getFollowUpMessages，有则继续下一轮，否则 agent_end。
 *
 * 消息类型（AssistantMessage、ToolResultMessage 等）统一使用 packages/ai 中的定义。
 */

import  {
  type ChatMessage,
  type ChatTool,
  type AssistantMessage,
  type ToolResultMessage,
  type ToolCallContent,
  stream as aiStream,
} from "@nano-bruce/ai";
import type {
  AgentContext,
  AgentLoopConfig,
  AgentMessage,
  AgentTool,
  StreamFn,
} from "./types.js";
import { createAgentStream } from "./event-stream.js";
import type { AgentEventStream } from "./event-stream.js";

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

/** 从 AssistantMessage 的 content 中提取所有 toolCall 块 */
function getToolCallsFromContent(msg: AssistantMessage): ToolCallContent[] {
  return msg.content.filter((b): b is ToolCallContent => b.type === "toolCall");
}

/**
 * 流式获取 assistant 消息
 */
async function streamAssistantResponse(
  context: AgentContext,
  config: AgentLoopConfig,
  stream: AgentEventStream,
  aiStreamFn?: StreamFn, // 调用大模型
): Promise<AssistantMessage> {
  let messages = context.messages;
  if (config.transformContext) {
    messages = await config.transformContext(messages, config.signal);
  }
  const convert = config.convertToLlm
  const chatMessages: ChatMessage[] = await convert(messages, context.systemPrompt) as ChatMessage[];
  const streamFunction = aiStreamFn ?? aiStream;
  const resolvedApiKey = await config.getApiKey?.(config.model.provider);

  const eventStream = await streamFunction(chatMessages, {
    ...config,
    tools: toolsToChatTools(config.agentTools),
    apiKey: resolvedApiKey,
  });

  let contextAddpartialMessage = false;
  let partialMessage: AssistantMessage | null = null;

  for await (const event of eventStream) {
    switch (event.type) {
      case "start":
        partialMessage = event.partial;
        context.messages.push(partialMessage);
        contextAddpartialMessage = true;
        stream.push({ type: "message_start", message: { ...partialMessage } });
        break;
      case "text_start":
      case "text_delta":
      case "text_end":
      case "thinking_start":
      case "thinking_delta":
      case "thinking_end":
      case "toolcall_start":
      case "toolcall_delta":
      case "toolcall_end": 
        if (partialMessage) {
          partialMessage = event.partial;
          context.messages[context.messages.length - 1] = partialMessage;
          stream.push({ type: "message_update", message: { ...partialMessage }, assistantMessageEvent: event });
        }
        break;
      case "done": 
      case "error": {
          const finalResult = await eventStream.result();
          if (contextAddpartialMessage) {
            context.messages[context.messages.length - 1] = finalResult;
          } else {
            context.messages.push(finalResult);
          }
          stream.push({ type: "message_end", message: finalResult });
          return finalResult;
      }
    }
  }
  return await eventStream.result();
}

/**
 * 执行助手消息中的全部 tool_calls（从 content 的 toolCall 块提取），返回 tool 结果消息列表
 */
async function executeToolCalls(
  tools: AgentTool[] | undefined,
  assistantMessage: AssistantMessage,
  config: AgentLoopConfig,
  stream: ReturnType<typeof createAgentStream>
): Promise<{ results: ToolResultMessage[]; steeringMessages: AgentMessage[] | null }> {
  const toolCalls = getToolCallsFromContent(assistantMessage);
  
  const results: ToolResultMessage[] = [];
  let steeringMessages: AgentMessage[] | null = null;

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const tool = tools?.find((t) => t.name === tc.name);

    stream.push({
      type: "tool_execution_start",
      toolCallId: tc.id,
      toolName: tc.name,
      args: tc.arguments,
    });

    let result: { content: string; isError?: boolean };
    try {
      if (!tool) throw new Error(`Tool not found: ${tc.name}`);
      const out = await tool.execute(tc.id, tc.arguments, config.signal);
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
      content: [{ type: "text", text: result.content }],
      isError: result.isError ?? false,
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
            content: [{ type: "text", text: "Skipped due to queued user message." }],
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
  stream: AgentEventStream
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

      const assistantMessage = await streamAssistantResponse(currentContext, config, stream);
      newMessages.push(assistantMessage);

      const toolCalls = getToolCallsFromContent(assistantMessage);
      console.log("toolCalls", toolCalls);
      hasMoreToolCalls = toolCalls.length > 0;
      let toolResultsThisTurn: ToolResultMessage[] = [];

      if (hasMoreToolCalls) {
        const { results, steeringMessages } = await executeToolCalls(
          config.agentTools,
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
