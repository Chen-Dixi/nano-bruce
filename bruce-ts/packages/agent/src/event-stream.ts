/**
 * Agent 事件流：基于 ai 层 EventStream，agent 循环 push 事件，调用方 for await 消费或 await result() 取最终 messages
 *
 * 仿照 Pi-mono：createAgentStream 返回 EventStream<AgentEvent, AgentMessage[]>，
 * isComplete = agent_end，extractResult = event.messages。
 */

import { EventStream } from "@nano-bruce/ai";
import type { AgentEvent, AgentMessage } from "./types.js";

/**
 * 创建 Agent 事件流：返回的流实现 AsyncIterable<AgentEvent>，可 for await 消费事件，
 * 且 result() 返回 Promise<AgentMessage[]>，在 agent_end 或 end(messages) 时 resolve。
 */
export function createAgentStream(): EventStream<AgentEvent, AgentMessage[]> {
  return new EventStream<AgentEvent, AgentMessage[]>(
    (event: AgentEvent) => event.type === "agent_end",
    (event: AgentEvent) => (event.type === "agent_end" ? event.messages : [])
  );
}

export type AgentEventStream = ReturnType<typeof createAgentStream>;
