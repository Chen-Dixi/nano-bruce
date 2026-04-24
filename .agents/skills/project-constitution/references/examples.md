# Project Constitution Examples

Complete examples from Nano-Bruce project.

## Example: mission.md

```markdown
---
name: mission
description: Nano-Bruce 项目使命、目标用户与核心问题定义
type: project
---

# Nano-Bruce 项目使命

## Mission（使命）

Nano-Bruce 是一个**学习导向的极简 LLM Agent 框架**，致力于通过清晰、可运行的代码实现，帮助开发者深入理解 Agent harness 层的核心概念与实现方式。

## Target Audience（目标用户）

### 主要受众

1. **Agent 开发学习者** - 想要理解 LLM Agent 内部运作机制的开发者
2. **独立开发者 / Solo Founder** - 需要快速搭建 Agent 能力的独立开发者
3. **企业技术团队** - 评估不同 Agent 框架的技术选型者

### 非目标用户

- 追求开箱即用、零配置体验的终端用户
- 需要企业级 SLA 保障的生产环境（当前阶段）

## Core Problems（要解决的核心问题）

### 1. 认知门槛问题
现有 Agent 框架功能强大但抽象层级多，初学者难以理解底层机制。

### 2. 学习材料缺失问题
高质量、可运行的 Agent 实现参考稀缺。

### 3. 框架锁定问题
商业框架往往绑定特定生态。

### 4. 定制化困难问题
大型框架难以魔改。

## Design Principles（设计原则）

1. **透明优先** —— 代码即文档，行为可追溯
2. **极简克制** —— 只做必要之事，避免过度抽象
3. **可组合性** —— 各模块独立可测试、可替换
4. **渐进式复杂度** —— 入门简单，深入有路径

---

**Why:** 明确项目定位，避免功能蔓延
**How to apply:** 所有功能提案需对照使命声明验证
```

## Example: tech-stack.md Structure

Key sections:

- **Current Tech Stack** - Table of technologies with rationale
- **Tech Stack Gaps** - Organized by priority (P0/P1/P2)
- **Technology Decisions** - Q&A format explaining choices

## Example: roadmap.md Structure

Key sections:

- **Development Principles** - Numbered list of principles
- **Phase Sections** - Goal, tasks (checklist), validation, effort
- **Phase Summary** - Table with status tracking
- **Execution Notes** - Guidance on phase ordering