---
name: roadmap
description: Nano-Bruce 高层实现路径与阶段规划
type: project
---

# Nano-Bruce 开发路线图

## 开发原则

1. **小步快跑** —— 每个阶段独立可验证，完成后可发布
2. **渐进式复杂度** —— 先实现核心，再叠加增强
3. **可演示优先** —— 每阶段产出可交互的成果
4. **文档同步** —— 代码与文档同步更新

---

## Phase 0: 基础设施 ✅ (已完成)

**目标：** 建立可运行的项目骨架

- [x] TypeScript 项目结构
- [x] 基础 Agent Loop 实现
- [x] Skill 系统骨架
- [x] 多 Provider 支持 (OpenAI, Moonshot, DeepSeek)
- [x] 基础 CLI 入口

**产出：** 可运行的极简 Agent，支持基础对话和技能调用

---

## Phase 1: Configuration System ✅ (已完成)

**目标：** 统一配置管理，提升用户体验

### 1.1 配置文件支持
- [x] 实现 `~/.bruce/settings.json` 配置文件读取
- [x] 支持 Provider 配置（endpoint, model, api-key）
- [x] 支持用户偏好设置（默认 provider, 流式输出等）

### 1.2 配置优先级
- [x] 环境变量 > 配置文件 > 默认值

### 1.3 安全存储
- [x] API Key 存储于配置文件（明文，后续可扩展 keychain）

**验证：** 用户可通过配置文件持久化 Provider 设置，无需每次手动 export

**实际工作量：** 1 天

---

## Phase 2: Session Management 📋 (规划中)

**目标：** 实现会话管理与 REPL 多轮对话

### 2.1 Session 存储
- Session 创建与 UUID 标识
- SQLite 持久化存储（~/.bruce/sessions.db）
- Session CRUD 操作

### 2.2 CLI REPL
- REPL 多轮对话循环
- `-s <uuid>` 参数恢复指定 session
- 每轮对话后自动保存
- Ctrl+D 保存退出 / 双 Ctrl+C 强制退出

**验证：** Agent 可恢复之前对话历史，支持连续多轮交互

**预计工作量：** 2-3 天

**需求文档：** `specs/2026-04-24-session-management/`

---

## Phase 3: Memory System

**目标：** 实现对话记忆持久化与检索

### 3.1 对话存储
- 实现会话持久化存储（SQLite 或 JSON 文件）
- 对话历史 CRUD 操作
- 会话元数据管理（创建时间、标签等）

### 3.2 上下文管理
- Token 计数与预算管理
- 基础上下文压缩策略（截断旧消息）
- 关键信息保留标记

### 3.3 记忆检索（可选）
- 基于关键词的对话检索
- 摘要生成（需调用 LLM）

**验证：** Agent 可记住之前对话内容，支持多轮连续对话

**预计工作量：** 3-5 天

---

## Phase 4: Human-in-the-Loop

**目标：** Agent 可主动询问用户，处理模糊指令

### 4.1 AskUserQuestion 功能
- 实现 Agent 主动提问机制
- 支持多选/单选/文本输入
- 与 Tool System 成

### 4.2 确认流程
- 危险操作前的确认提示
- 可配置的自动确认规则

### 4.3 澄清对话
- 模糊指令的多轮澄清
- 意图确认机制

**验证：** Agent 遇到不确定情况时主动询问，而非猜测

**预计工作量：** 2-3 天

---

## Phase 5: Terminal UI

**目标：** 提供更友好的终端交互体验

### 5.1 Rich Output
- 实现 Markdown 渲染
- 代码高亮显示
- 流式打字机效果优化

### 5.2 交互组件
- 进度条与状态展示
- 交互式选择列表
- 实时日志面板

### 5.3 主题支持
- 可配置的颜色主题
- 紧凑/宽松布局切换

**验证：** 用户可通过 TUI 完成 Agent 交互，体验流畅

**参考实现：** OpenCode, Claude Code TUI

**预计工作量：** 5-7 天

---

## Phase 6: Agent Design Patterns

**目标：** 支持更复杂的 Agent 推理模式

### 6.1 Plan-and-Execute
- 任务分解与规划
- 子任务顺序执行
- 执行结果反馈与重规划

### 6.2 Tree of Thought
- 多分支推理实现
- 思路评估与剪枝
- 最优路径选择

### 6.3 Reflection
- 自我评估机制
- 迭代改进循环
- 质量检查点

**验证：** Agent 可处理需要多步规划、深度推理的复杂任务

**预计工作量：** 5-7 天

---

## Phase 7: Testing Framework

**目标：** 建立 Agent 行为验证体系

### 7.1 测试 DSL
- 定义 Agent 测试用例格式
- Mock Provider 支持
- 断言与验证工具

### 7.2 评估工具
- 输出质量评估指标
- 回归测试框架
- 性能基准测试

### 7.3 CI 集成
- 自动化测试流水线
- 测试覆盖率报告

**验证：** 核心功能有自动化测试覆盖，变更可验证

**预计工作量：** 3-4 天

---

## Phase 8: Observability

**目标：** 建立 Agent 运行时可观测能力

### 8.1 指标收集
- Token 使用统计
- 请求延迟监控
- 成本追踪

### 8.2 执行追踪
- 决策链路可视化
- Tool 调用追踪
- 错误链路分析

### 8.3 调试工具
- 运行时状态检查
- 消息流可视化
- 断点与单步执行（概念验证）

**验证：** 开发者可清晰了解 Agent 运行状态与决策过程

**预计工作量：** 4-5 天

---

## Phase Summary

| Phase | 名称 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| 0 | 基础设施 | P0 | - | ✅ 完成 |
| 1 | Configuration System | P0 | - | ✅ 完成 |
| 2 | Session Management | P0 | Phase 1 | 📋 规划中 |
| 3 | Memory System | P0 | Phase 2 | 📋 规划中 |
| 4 | Human-in-the-Loop | P1 | Phase 0 | 📋 规划中 |
| 5 | Terminal UI | P1 | Phase 0 | 📋 规划中 |
| 6 | Agent Design Patterns | P1 | Phase 3, 4 | 📋 规划中 |
| 7 | Testing Framework | P2 | Phase 0-6 | 📋 规划中 |
| 8 | Observability | P2 | Phase 0-6 | 📋 规划中 |

---

## 执行建议

1. **Phase 1 → Phase 2 → Phase 3 连续执行** —— 配置系统是会话管理的基础，会话管理是记忆系统的基础
2. **Phase 4 和 Phase 5 可并行** —— 互不依赖，可根据团队资源安排
3. **Phase 6 依赖 Memory** —— 复杂推理需要上下文支持
4. **Phase 7-8 可穿插进行** —— 测试和可观测性可随功能开发同步建设

---

**Why:** 为开发提供清晰路径，每个阶段有明确产出
**How to apply:** 开始新功能开发前，确认所属 Phase；Phase 内的任务可根据实际情况调整顺序，但应确保阶段目标达成后再进入下一 Phase