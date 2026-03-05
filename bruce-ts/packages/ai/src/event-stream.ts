/**
 * 通用事件流：生产者 push 事件，消费者 for await 迭代，并可 await result() 取最终结果
 *
 * 仿照 Pi-mono：isComplete + extractResult 解耦「何时结束」与「结果如何从事件中提取」，
 * 便于 ai 层（如 LLM 流）与 agent 层复用同一抽象。
 *
 * AsyncIterable vs AsyncGenerator：本类实现 AsyncIterable<T>（[Symbol.asyncIterator] 返回 AsyncIterator），
 * 未使用 async function* 的 AsyncGenerator。语义上「可被 for await 消费」用 AsyncIterable 表达即可；
 * AsyncGenerator 是 AsyncIterable 的一种实现（async function* 的返回值），带 return/throw，类型更具体。
 */

/**
 * 通用事件流 T，最终结果类型 R（默认 R = T）。
 * 实现 AsyncIterable<T>，可用 for await (const event of stream) 消费；
 * result() 返回 Promise<R>，在 push 到「完成事件」或调用 end(result) 时 resolve。
 */
export class EventStream<T, R = T> implements AsyncIterable<T> {
  private queue: T[] = []; // 待消费的事件队列
  private waiting: ((value: IteratorResult<T>) => void)[] = []; // 等待事件的消费者队列
  private done = false; // 流是否结束
  private finalResultPromise: Promise<R>; // 最终结果的 Promise
  private resolveFinalResult!: (result: R) => void; // ← 外部化的 resolve 函数

  constructor(
    private isComplete: (event: T) => boolean,
    private extractResult: (event: T) => R
  ) {
    this.finalResultPromise = new Promise((resolve) => {
      this.resolveFinalResult = resolve;   // ← 关键：把 resolve 函数"提取"出来
    });
  }

  push(event: T): void {
    if (this.done) return;

    if (this.isComplete(event)) {
      this.done = true;
      this.resolveFinalResult(this.extractResult(event));
    }

    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this.queue.push(event);
    }
  }

  end(result?: R): void {
    this.done = true;
    if (result !== undefined) {
      this.resolveFinalResult(result);
    }
    while (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      waiter({ value: undefined as unknown as T, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.done) {
        return;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) =>
          this.waiting.push(resolve)
        );
        if (result.done) return;
        yield result.value;
      }
    }
  }

  result(): Promise<R> {
    return this.finalResultPromise;
  }
}

/** AssistantMessageEventStream 定义在 types.ts，此处仅保留通用 EventStream */