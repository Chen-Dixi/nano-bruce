---
name: tech-stack
description: Nano-Bruce 技术选型与缺口分析
type: project
---

# Nano-Bruce 技术栈

## Current Tech Stack（当前技术选型）

### 核心运行时

| 层级 | 技术 | 选择理由 |
|------|------|----------|
| 语言 | TypeScript | 类型安全、生态丰富、前后端通用 |
| 运行时 | Bun | 高性能、原生支持 SQLite、OpenTUI 兼容、内置打包与测试 |
| 包管理 | Bun | 快速安装、内置 lockfile、兼容 npm workspaces |
| 存储 | SQLite (bun:sqlite) | 轻量级、零配置、Bun 原生支持、无需原生编译依赖 |

### SQLite 存储方案

| 用途 | 说明 |
|------|------|
| 用户配置存储 | Provider 配置、偏好设置 |
| 技能缓存 | 已加载技能的元数据与内容摘要 |
| 执行日志 | Agent 运行追踪、token 使用统计 |

**选型理由：**

1. **零配置** —— 无需独立数据库服务，数据即文件
2. **原生支持** —— Bun 内置 `bun:sqlite`，无需第三方库和原生编译
3. **适合 CLI** —— 单用户场景，无并发压力
4. **便于迁移** —— 单 `.db` 文件，易于备份和迁移

**使用方式：** `import { Database } from "bun:sqlite"`

### Markdown 记忆存储

| 用途 | 说明 |
|------|------|
| 对话历史持久化 | 存储会话消息，人类可读、便于调试 |
| 记忆摘要 | 关键信息提取，跨会话检索 |

**存储位置：** `~/.bruce/memory/` 目录，每个会话一个 `.md` 文件

**选型理由：**

1. **人类可读** —— 直接打开查看，无需数据库工具
2. **便于调试** —— 文本格式，易于搜索和比对
3. **学习友好** —— 符合项目"透明优先"原则
4. **Git 兼容** —— 可纳入版本控制，便于追踪变化

### Terminal UI

| 层级 | 技术 | 选择理由 |
|------|------|----------|
| TUI 框架 | OpenTUI | OpenCode 同款框架、React/Solid 绑定、组件丰富、终端兼容性好 |

**选型理由：**

1. **实战验证** —— OpenCode 已在生产环境使用，稳定可靠
2. **组件丰富** —— 内置 Markdown 渲染、代码高亮、交互选择等组件
3. **多范式支持** —— React 和 Solid 绑定，灵活选择
4. **终端兼容** —— 良好的终端模拟器兼容性

### AI Provider 层

| Provider | 状态 | 备注 |
|----------|------|------|
| OpenAI | ✅ 已实现 | GPT-4o, GPT-4o-mini 等 |
| Moonshot | ✅ 已实现 | Kimi 模型 |
| DeepSeek | ✅ 已实现 | DeepSeek Chat / Coder |

### 核心模块

| 模块 | 实现状态 | 说明 |
|------|----------|------|
| Agent Loop | ✅ 已实现 | 核心对话循环，支持流式输出 |
| Skill System | ✅ 已实现 | 基于 SKILL.md 的技能发现与加载 |
| Tool System | ✅ 已实现 | read/write/edit/bash 元工具 |
| Prompt Builder | ✅ 已实现 | 消息模板与上下文构建 |
| Stream Handler | ✅ 已实现 | 打字机效果与增量推送 |

---

## Tech Stack Gaps（技术缺口分析）

### P0 - 核心缺口（必须解决）

#### 1. Memory / 记忆系统

**现状：** 无状态运行，每次对话独立，无上下文持久化

**缺口详情：**
- 缺少对话历史持久化存储
- 缺少跨会话记忆管理
- 缺少记忆检索与摘要机制

**解决方案：** 使用 Markdown 文件存储对话历史，存储在 `~/.bruce/memory/` 目录，每个会话一个 `.md` 文件，格式人类可读、便于调试和学习

**影响：** 无法构建长期交互的 Agent 应用

#### 2. Configuration System / 配置系统

**现状：** 依赖环境变量，无统一配置入口

**缺口详情：**
- 缺少 `~/.bruce/settings.json` 配置文件支持
- 缺少 Provider/API Key 配置管理
- 缺少用户偏好设置持久化

**解决方案：** 配置可存储在 SQLite（`~/.bruce/config.db`）或 JSON 文件，优先级：CLI > 环境变量 > SQLite/JSON > 默认值

**影响：** 用户体验差，每次使用需手动配置

#### 3. Context Management / 上下文管理

**现状：** 简单的消息数组，无智能上下文策略

**缺口详情：**
- 缺少 token 计数与预算管理
- 缺少上下文压缩/摘要机制
- 缺少关键信息保留策略

**影响：** 长对话容易超出上下文限制

---

### P1 - 重要缺口（应优先解决）

#### 4. Terminal UI / 终端交互界面

**现状：** 纯 CLI 文本输出，交互体验基础

**缺口详情：**
- 缺少类似 OpenCode 的 Rich Terminal UI
- 缺少实时状态展示与进度反馈
- 缺少交互式确认与选择界面

**解决方案：** 使用 OpenTUI（OpenCode 同款 TUI 框架），提供 Markdown 渲染、代码高亮、交互组件等能力

**参考：** OpenCode, Claude Code 的 TUI 交互体验

**影响：** 降低使用门槛，提升开发体验

#### 5. Agent Design Patterns / 设计模式

**现状：** 仅支持基础 ReAct 循环

**缺口详情：**
- 缺少 Tree of Thought 实现
- 缺少 Plan-and-Execute 模式
- 缺少 Reflection 自我反思模式

**影响：** 限制 Agent 解决复杂问题的能力

#### 6. Human-in-the-Loop / 人机协作

**现状：** 无主动询问能力

**缺口详情：**
- 缺少类似 Claude Code 的 `AskUserQuestion` 功能
- 缺少 Agent 主动请求确认的机制
- 缺少多轮澄清对话支持

**影响：** Agent 无法处理模糊指令或需要人工决策的场景

---

### P2 - 增强缺口（后续规划）

#### 7. Testing Framework / 测试框架

**现状：** 无 Agent 行为验证机制

**缺口详情：**
- 缺少 Agent 行为测试 DSL
- 缺少输出质量评估工具
- 缺少回归测试框架

#### 8. Observability / 可观测性

**现状：** 基础日志输出

**缺口详情：**
- 缺少 token 使用监控
- 缺少执行链路追踪
- 缺少性能指标收集
- 缺少调试可视化工具

---

## Technology Decisions（技术决策记录）

### 为什么选择 TypeScript 而非 Python？

1. **类型系统** —— 编译期捕获错误，对学习型项目尤为重要
2. **生态平衡** —— AI SDK 覆盖完善，前端开发者友好
3. **异步模型** —— 原生 Promise/async-await，流式处理直观
4. **差异化** —— Python Agent 框架众多，TS 领域有空间

### 为什么不使用 LangChain 等框架？

1. **学习目标** —— 自实现才能"吃透"底层机制
2. **依赖控制** —— 避免大型框架的隐藏行为
3. **灵活性** —— 不受框架设计决策限制

### 为什么从 Node.js/npm 迁移到 Bun？

1. **OpenTUI 依赖** —— OpenTUI 目前仅支持 Bun 运行时，是 Phase 3 Terminal UI 的必选框架
2. **内置 SQLite** —— `bun:sqlite` 无需原生编译，替代 better-sqlite3，安装更快、依赖更少
3. **性能提升** —— Bun 启动更快、包安装速度显著优于 npm
4. **一体化工具链** —— 内置运行时、包管理、打包、测试，减少工具碎片化

### Provider 抽象层设计原则

```typescript
interface ModelProvider {
  chat(messages: Message[], options?: ChatOptions): AsyncGenerator<StreamEvent>;
}
```

统一接口，最小抽象，易于扩展新 Provider。

---

**Why:** 明确技术方向，识别开发优先级，避免重复造轮子
**How to apply:** 新功能开发前对照此文档，确认技术选型一致性；缺口填补按 P0 → P1 → P2 优先级推进