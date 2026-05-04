# Terminal UI Validation

## Success Criteria

- `bruce` 启动后进入 TUI 界面
  - 无历史消息时显示 WelcomeScreen（中央 ASCII art Logo + 输入框）
  - 有历史消息时（`-s <uuid>`）直接进入 ChatArea 显示完整消息列表
- 顶部状态条（TopBar）显示 Agent 状态、provider/model、耗时
- 底部状态栏（BottomBar）显示 cwd、token 用量、快捷键提示
- 用户消息有左侧竖线标识，样式与参考图一致
- Agent 响应以流式打字机效果逐字/逐块渲染
- Markdown 内容正确渲染（标题、列表、粗体、代码块、链接高亮）
- 代码块有语法高亮（语言标记 + 颜色区分）
- ThinkingBlock 斜体灰色显示，默认折叠，可展开，支持流式追加
- ToolCallBlock 以 bullet point 展示，参数树形缩进，状态指示（working hard... / done / error）
- 流式响应期间显示 ActivityStatusBar（provider/model + 耗时）
- 交互式选择列表可上下键选择、Enter 确认
- 终端窗口调整大小时布局自适应
- Ctrl+C / Ctrl+D 保存 session 后退出

## Test Framework

- Using: Vitest（基于 specs/tech-stack.md，TypeScript + Bun 项目）
- E2E: 手动测试（TUI 难以自动化）

## Test Cases

### Unit Tests

```typescript
import { test, expect } from "vitest";

// 消息列表响应式存储
test("messageStore: push and retrieve messages", () => {
  const store = createMessageStore();
  store.push({ role: "user", content: [{ type: "text", text: "hello" }] });
  expect(store.messages().length).toBe(1);
});

// 工具状态流转
test("toolState: transitions from pending to done", () => {
  const state = createToolState();
  state.start("call-1", "read_file");
  expect(state.get("call-1")?.status).toBe("running");
  state.finish("call-1", { content: "file contents" });
  expect(state.get("call-1")?.status).toBe("done");
});

// AgentEvent → UI State 映射
test("eventHandler: message_update appends text delta", () => {
  const handler = createEventHandler();
  handler.handle({
    type: "message_update",
    message: mockAssistantMessage,
    assistantMessageEvent: { type: "text_delta", delta: "Hello" },
  });
  expect(handler.currentText()).toContain("Hello");
});

// 计时器
test("timer: starts on agent_start and stops on agent_end", () => {
  const timer = createTimer();
  timer.start();
  expect(timer.isRunning()).toBe(true);
  timer.stop();
  expect(timer.isRunning()).toBe(false);
  expect(timer.elapsed() >= 0).toBe(true);
});

// 历史消息加载
test("historyLoader: loads messages from session storage", async () => {
  const loader = createHistoryLoader();
  const messages = await loader.load("test-uuid");
  expect(Array.isArray(messages)).toBe(true);
});
```

### Integration Tests

- Test 1: WelcomeScreen → 输入消息 → ChatArea 出现对话
  - 启动 bruce TUI，验证显示 WelcomeScreen（Logo + 输入框）
  - 在输入框输入 "hello"，Enter 发送
  - 验证 WelcomeScreen 消失，ChatArea 出现用户消息和 Agent 响应
- Test 2: 历史消息恢复 → `-s <uuid>` 加载完整对话
  - 先创建一轮对话，获取 session uuid
  - `bruce -s <uuid>` 启动
  - 验证 ChatArea 直接显示历史消息（用户消息 + Agent 回复 + 工具调用记录）
- Test 3: 流式渲染 → 文本逐步出现，非一次性显示
  - 发送消息后，观察 Agent 响应是逐字/逐块渲染
  - 验证打字机效果（text_delta 事件驱动）
  - 验证 ActivityStatusBar 实时显示耗时
- Test 4: 代码块渲染 → Markdown 代码块有语法高亮
  - 让 Agent 输出包含代码块的 Markdown
  - 验证代码块有颜色区分和语言标记
- Test 5: Thinking 块 → 可折叠，流式追加
  - 触发模型返回 thinking 内容
  - 验证 ThinkingBlock 斜体灰色、默认折叠
  - 验证 thinking_delta 实时追加内容
- Test 6: 工具调用 → bullet point + 树形缩进 + 状态变化
  - 触发 Agent 调用工具（如读取文件）
  - 验证 ToolCallBlock 显示 ● 工具名 + 描述
  - 验证参数以 └─ 树形缩进展示
  - 验证状态从 working hard... → done
- Test 7: Session 持久化 → 退出后恢复对话
  - 进行一轮对话，Ctrl+D 退出
  - `bruce -s <uuid>` 恢复，验证历史消息完整显示
- Test 8: 终端窗口调整 → 布局自适应
  - 调整终端窗口大小
  - 验证布局无错位、文本自动换行

### Manual Smoke Test

```
1. bun run packages/app/src/cli.ts
2. 验证显示 WelcomeScreen（中央 ASCII art Logo + 输入框）
3. 输入 "写一个 hello world 的 Python 函数"
4. 观察：流式渲染 + 代码高亮 + ThinkingBlock 折叠 + ActivityStatusBar 计时
5. 输入 "读取当前目录文件列表"（触发工具调用）
6. 观察：ToolCallBlock bullet point + 树形参数 + working hard 状态
7. Ctrl+D 退出
8. bruce -s <uuid> 恢复
9. 验证历史消息完整渲染（包括之前的工具调用记录）
```

## Merge Checklist

- [ ] 所有单元测试通过 (`bun test`)
- [ ] 手动 smoke test 通过
- [ ] iTerm2 + VS Code Terminal 兼容性验证
- [ ] 无回归：`--message` 单轮模式正常工作
- [ ] 无回归：`init` / `list-sessions` 子命令正常工作
- [ ] packages/app/src/tui/ 模块导出和类型声明完整
