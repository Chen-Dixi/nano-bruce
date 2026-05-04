# Terminal UI Requirements

## Scope

### In scope
- OpenTUI + Solid 绑定集成
- 顶部状态条（TopBar）：Agent 状态 + provider/model + 耗时计时器
- 底部状态栏（BottomBar）：cwd + token 用量 + 快捷键提示
- WelcomeScreen：无消息时显示 ASCII art Logo（`specs/2026-05-03-terminal-ui/logo.txt`）+ 中央输入框
- ChatArea：可滚动的完整消息列表（历史 + 实时）
- 历史消息加载：`-s <uuid>` 恢复时渲染全部历史消息
- Markdown 渲染与代码语法高亮
- 流式打字机效果（text_delta / thinking_delta 实时渲染）
- 用户消息样式：左侧竖线标识
- ThinkingBlock：斜体灰色、可折叠、支持 thinking_delta 流式追加
- ToolCallBlock：bullet point + 树形缩进参数 + working hard 状态
- ActivityStatusBar：流式响应中间显示 provider/model/耗时
- 进度指示器（agent 思考中动画）
- 交互式选择列表（Human-in-the-Loop 基础）
- 替换现有 readline REPL，bruce 启动直接进入 TUI

### Out of scope
- 颜色主题系统（后续迭代）
- 紧凑/宽松布局切换（后续迭代）
- 多栏布局（文件树等）
- 图片/表格渲染
- Vim 键位模式
- 鼠标交互支持（终端滚动除外）

## Decisions

- **Solid over React**: Solid 更轻量、无虚拟 DOM、性能更好，OpenCode 也使用 Solid
- **替换 REPL**: TUI 完全替代 readline REPL，不保留双模式
- **保留非交互子命令**: `init` / `list-sessions` / `--message` 仍为纯 CLI 输出，不启动 TUI
- **OpenCode 风格布局**: 顶部状态条 + 中间对话区 + 底部输入栏 + 底部状态栏
- **AgentEvent 直接驱动 UI**: 复用现有 AgentEvent 体系（agent_start / message_update / tool_execution_* 等），TUI 层订阅渲染，不引入中间状态层
- **TUI 代码放在 app/src/tui/**: TUI 作为 app 包的内部模块，不拆分为独立包，减少包管理复杂度
- **历史消息静态渲染**: 从 session 加载的历史消息直接渲染为完整内容，不参与流式更新
- **计时器实时更新**: agent_start 启动计时，turn_end / agent_end 停止，每秒刷新显示

## Context

- **References**: specs/mission.md（透明优先、极简克制）, specs/tech-stack.md（OpenTUI 选型、Bun 运行时）
- **Dependencies**:
  - Phase 0 基础设施 ✅（Agent Loop、Skill System、Tool System）
  - Phase 1 Configuration System ✅（Provider 配置读取）
  - Phase 2 Session Management ✅（SQLite session 存储、REPL 循环）
- **Constraints**:
  - 必须在 Bun 运行时下运行（OpenTUI 要求）
  - 终端兼容性：需覆盖 iTerm2、macOS Terminal、VS Code 终端
  - 包大小：新增依赖应控制在合理范围

## Open Questions

- [ ] OpenTUI Solid 绑定的具体 API 和组件清单（需查阅 opentui 文档/skill）
- [ ] Markdown 渲染：OpenTUI 是否内置 Markdown 组件，还是需要自行实现
- [ ] 代码高亮：使用 OpenTUI 内置方案还是接入 shiki/highlight.js
- [ ] InputBar 多行输入的具体交互细节（最大行数、滚动行为）
- [ ] 历史消息渲染时如何处理已有的 tool_result 消息（是否展开工具结果）
