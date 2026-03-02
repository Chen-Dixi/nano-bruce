/**
 * 简单事件流：Agent 循环向流中 push 事件，调用方通过 for await 消费
 *
 * 参考 Pi 的 EventStream：在 agent_end 时结束迭代并返回最终 messages。
 */

import type { AgentEvent, AgentMessage } from "./types.js";

/**
 * 创建 Agent 事件流：返回 push/end 控制句柄与异步迭代器
 */
export function createAgentStream(): {
  push(event: AgentEvent): void;
  end(messages: AgentMessage[]): void;
  [Symbol.asyncIterator]: () => AsyncGenerator<AgentEvent, AgentMessage[]>;
} {
  const q: AgentEvent[] = [];
  let finished = false;
  let resolveWait: (() => void) | null = null;

  const push = (event: AgentEvent): void => {
    q.push(event);
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  let resultResolve!: (m: AgentMessage[]) => void;
  const resultPromise = new Promise<AgentMessage[]>((r) => {
    resultResolve = r;
  });

  const end = (messages: AgentMessage[]): void => {
    if (!finished) {
      finished = true;
      resultResolve(messages);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }
  };

  async function* iterate(): AsyncGenerator<AgentEvent, AgentMessage[]> {
    let i = 0;
    while (true) {
      while (i < q.length) {
        const event = q[i++];
        yield event;
        if (event.type === "agent_end") return event.messages;
      }
      if (finished) break;
      await new Promise<void>((r) => {
        resolveWait = r;
      });
    }
    return [];
  }

  return {
    push,
    end,
    [Symbol.asyncIterator]: () => iterate(),
  };
}

export type AgentEventStream = ReturnType<typeof createAgentStream>;
