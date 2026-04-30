---
name: session-management
description: Nano-Bruce Phase 2 Session 管理系统需求定义
type: project
---

# Session Management Requirements

## Scope

### In Scope
- Session 创建与 UUID 标识
- Session 持久化存储（SQLite）
- REPL 多轮对话支持
- `-s <uuid>` 或 `--session <uuid>` 参数恢复指定 session
- 每轮对话后自动保存
- Ctrl+D 保存退出 / 双 Ctrl+C 强制退出
- `bruce list-sessions` 命令列出当前目录下的 session（默认按 cwd 过滤）
- `bruce list-sessions -g` 列出所有 session（全局）
- **延迟创建 session** —— 启动 REPL 时不立即创建 session，用户提交第一条消息后才创建，避免产生空白 session

### Out of Scope
- Session 删除功能（`bruce delete <uuid>`）
- 跨会话记忆检索
- Token 计数与上下文压缩（Phase 3 Memory System）

## Decisions

| Decision | Rationale |
|----------|-----------|
| 使用 SQLite 存储 | 技术栈已确定，适合 CLI 工具，便于后续扩展查询 |
| 纯 UUID 文件命名 | 简洁清晰，session 表直接用 uuid 作为主键 |
| 每轮自动保存 | 减少用户心智负担，防止意外丢失对话 |
| Ctrl+D + 双 Ctrl+C | 区分"保存退出"与"强制退出"两种意图 |
| 延迟创建 session | 避免产生大量空白 session，仅在用户实际输入后才创建 |
| `-s` 和 `--session` 互通 | 提供长短两种参数形式，便于记忆和使用 |
| `list-sessions` 按目录过滤 | 避免显示无关项目的 session，减少干扰；`-g` 查看全局 |

## Context

### References
- `specs/roadmap.md` - Phase 2 Session Management
- `specs/tech-stack.md` - SQLite 作为存储方案

### Dependencies
- Phase 1 Configuration System ✅（已完成）
- Agent Loop 机制（已实现）

### Constraints
- 单用户 CLI 场景，无并发压力
- 存储路径：`~/.bruce/sessions.db`
- 需兼容现有 `--message` 单轮对话模式

## Open Questions

- [ ] Session 表是否需要 metadata 字段（cwd, skillDir）？
- [ ] 是否需要 session 过期/清理机制？