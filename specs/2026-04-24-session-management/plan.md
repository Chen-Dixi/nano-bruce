---
name: session-management-plan
description: Phase 2 Session Management 实现任务清单
type: project
---

# Session Management Plan

## Task Group 1: Session 数据层

- [ ] 1.1: 创建 `packages/app/src/session/` 目录结构
- [ ] 1.2: 定义 Session 类型（`types.ts`）
  - uuid, messages, createdAt, updatedAt, metadata
- [ ] 1.3: 实现 SQLite 存储层（`storage.ts`）
  - 使用 better-sqlite3 或 sql.js
  - 表结构：sessions(uuid, messages_json, created_at, updated_at, metadata_json)
  - CRUD：create, load, save, delete, list
- [ ] 1.4: 编写 Session 数据层单元测试

## Task Group 2: Agent 扩展

- [ ] 2.1: EngineAgent 添加 `getMessages()` 方法
  - 返回当前 messages 数组副本
- [ ] 2.2: EngineAgent 添加 `setMessages(messages)` 方法
  - 用于恢复 session 时设置对话历史
- [ ] 2.3: 更新 `packages/agent/src/index.ts` 导出

## Task Group 3: CLI REPL

- [ ] 3.1: 重构 `cli.ts` 参数解析
  - 添加 `-s <uuid>` 参数支持
  - 保持 `--message` 单轮模式兼容
- [ ] 3.2: 实现 REPL 循环
  - 使用 `readline/promises`
  - 提示符设计：`bruce> `
- [ ] 3.3: 实现退出处理
  - Ctrl+D → 保存 session 后退出
  - 第一次 Ctrl+C → 提示 "Press Ctrl+C again to exit"
  - 第二次 Ctrl+C → 强制退出（不保存）
- [ ] 3.4: 每轮对话后自动保存 session
- [ ] 3.5: 新 session 创建时自动生成 UUID
- [ ] 3.6: `-s <uuid>` 时加载已有 session 并恢复 messages

## Task Group 4: 依赖与构建

- [ ] 4.1: 添加 better-sqlite3 依赖
  - 或 sql.js（纯 JS，无编译）
- [ ] 4.2: 更新 package.json 导出
- [ ] 4.3: TypeScript 类型声明处理

## Dependencies

- 2.1 依赖 1.2（类型定义）
- 3.6 依赖 1.3（存储层）和 2.2（setMessages）
- 4.1 需先完成再进行 1.3

## Notes

- SQLite 选择：推荐 `better-sqlite3`（高性能），若编译问题可用 `sql.js`
- messages_json 存储格式：直接 JSON.stringify AgentMessage[]
- REPL 需处理中断信号（SIGINT），注意 readline 的 close 事件