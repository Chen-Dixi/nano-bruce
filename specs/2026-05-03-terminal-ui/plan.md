# Terminal UI Plan

## Task Group 1: OpenTUI 集成与项目结构

- [ ] 1.1: 安装 OpenTUI 依赖（opentui, opentui-solid）
- [ ] 1.2: 在 `packages/app/src/tui/` 下创建 TUI 模块
  - `packages/app/src/tui/app.tsx` — TUI 入口，挂载 Solid 组件树
  - `packages/app/src/tui/components/` — UI 组件目录
  - `packages/app/src/tui/stores/` — Solid Signal / Store 状态管理
  - `packages/app/src/tui/index.ts` — TUI 模块导出（供 cli.ts 调用）
- [ ] 1.3: 配置 Bun 运行 TUI 入口（tsx/jsx 支持、Solid 编译）
- [ ] 1.4: 实现最小 TUI 启动验证（空界面能渲染）

## Task Group 2: 布局框架（OpenCode 风格）

- [ ] 2.1: 实现 `TopBar` 组件（顶部状态条）
  - 当前 Agent 状态（Idle / Thinking / Executing）
  - 当前 provider / model 名称
  - 当前 turn 耗时计时器
- [ ] 2.2: 实现 `BottomBar` 组件（底部状态栏）
  - 左侧：当前工作目录（cwd）
  - 中间：token 使用量（e.g. 20.7K (8%)）
  - 右侧：快捷键提示（ctrl+p commands）
- [ ] 2.3: 实现 `ChatArea` 组件
  - 可滚动的对话消息容器
  - 自动滚动到底部
  - 支持键盘导航（PgUp/PgDown 滚动历史）
- [ ] 2.4: 实现 `InputBar` 组件
  - 多行输入框，Enter 发送 / Shift+Enter 换行
  - 输入提示占位符："Ask anything..."
  - 当前 provider/model 标签（如 Build · kimi-k2.6）
- [ ] 2.5: 实现 `WelcomeScreen` 组件
  - 无历史消息时显示 ASCII art Logo（引用 `specs/2026-05-03-terminal-ui/logo.txt`）
  - 中央输入框（同 InputBar）
  - 底部快捷键提示
- [ ] 2.6: 组合 `App` 布局
  - TopBar（顶）+ ChatArea/WelcomeScreen（中，flex）+ InputBar（底）+ BottomBar（底）
  - 响应终端窗口大小变化

## Task Group 3: Rich Output — 消息渲染

- [ ] 3.1: 实现 `UserMessage` 组件
  - 左侧竖线标识（高亮色）
  - 用户输入文本
  - 与参考图一致的消息气泡样式
- [ ] 3.2: 实现 `AssistantMessage` 组件
  - Markdown 渲染（标题、列表、链接高亮、粗体/斜体）
  - 代码块语法高亮（接入 shiki 或 OpenTUI 内置高亮）
  - 行内代码样式
- [ ] 3.3: 实现 `ThinkingBlock` 组件
  - 斜体灰色显示思考过程
  - 可折叠/展开（默认折叠，点击展开）
  - 支持 thinking_delta 流式追加
- [ ] 3.4: 实现 `ToolCallBlock` 组件
  - bullet point 列表样式（● 工具名）
  - 工具描述 + 参数树形缩进（└─ path/to/file）
  - 执行状态指示：pending → running（:: working hard...）→ done / error
  - 可展开查看详细结果
- [ ] 3.5: 实现 `ActivityStatusBar` 组件
  - 流式响应期间显示在中间的状态条
  - Build · provider/model · elapsed time

## Task Group 4: 流式渲染与历史加载

- [ ] 4.1: 将 AgentEventStream 接入 Solid 响应式系统
  - AgentEvent → Solid Signal 更新
  - 消息列表 reactive 存储（`createStore`）
- [ ] 4.2: 实现历史消息加载
  - `-s <uuid>` 启动时从 SessionStorage 读取历史
  - 历史消息渲染为不可变的静态消息组件
  - 区分历史消息和当前流式消息
- [ ] 4.3: 实现流式打字机效果
  - text_delta 逐字符追加渲染
  - thinking_delta 实时更新 ThinkingBlock
  - 代码块增量渲染（边生成边高亮）
- [ ] 4.4: 实现工具执行实时更新
  - tool_execution_start → 显示 ToolCallBlock pending
  - tool_execution_end → 更新为 done + 结果，或 error
  - 并行工具调用的状态展示
- [ ] 4.5: 实现 Timer 计时器
  - agent_start 开始计时
  - turn_end / agent_end 停止计时
  - 实时显示在 TopBar 和 ActivityStatusBar

## Task Group 5: 交互组件

- [ ] 5.1: 实现 `ProgressIndicator` 组件
  - 旋转加载动画（agent 思考中）
  - 工具执行进度条
- [ ] 5.2: 实现 `SelectionList` 组件
  - 上下键选择 / Enter 确认
  - 用于 Human-in-the-Loop 的 AskUserQuestion
- [ ] 5.3: 实现 `CommandPalette` 组件（可选，基础版）
  - ctrl+p 呼出命令列表
  - 基础命令：退出、切换 provider、查看快捷键

## Task Group 6: CLI 集成与 Session 管理

- [ ] 6.1: 重构 `cli.ts` 入口
  - 删除 readline REPL 代码
  - `bruce` 命令启动 TUI（进入 WelcomeScreen 或 ChatArea）
  - 保留 `--message` 单轮模式（非 TUI）
  - 保留 `init` / `list-sessions` 子命令（非 TUI）
- [ ] 6.2: TUI 内集成 Session 管理
  - 启动时无 `-s`：显示 WelcomeScreen，首次输入后创建 session
  - 启动时带 `-s <uuid>`：加载历史消息到 ChatArea
  - 每轮对话后自动保存 session
- [ ] 6.3: 退出处理
  - Ctrl+C / Ctrl+D → 保存 session 后退出
  - Esc 双击 → 强制退出

## Dependencies

- Task Group 2 依赖 1.3（TUI 能启动）
- Task Group 3 依赖 2.2（ChatArea 组件）
- Task Group 4 依赖 3.2（消息组件存在才能流式更新）
- Task Group 5 依赖 2.1（TopBar 可展示状态）
- Task Group 6 依赖 4.3 + 5.1（核心功能完成后才替换 CLI）

## Notes

- OpenTUI 使用 Solid 绑定，组件写 .tsx
- AgentEvent 体系已有 `message_update` / `tool_execution_start` 等事件，TUI 层只需订阅渲染
- 先跑通最小 TUI 骨架再叠加功能，每个 Task Group 完成后可独立验证
- 参考图见 opencode_welcome.jpg / opencode_messages.jpg / helixent.jpg
