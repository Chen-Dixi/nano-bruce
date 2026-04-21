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
| 运行时 | Node.js | 跨平台、CLI 友好、流式处理能力强 |
| 包管理 | npm | 标准化、广泛支持 |

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

**影响：** 无法构建长期交互的 Agent 应用

#### 2. Configuration System / 配置系统

**现状：** 依赖环境变量，无统一配置入口

**缺口详情：**
- 缺少 `~/.bruce/settings.json` 配置文件支持
- 缺少 Provider/API Key 配置管理
- 缺少用户偏好设置持久化

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