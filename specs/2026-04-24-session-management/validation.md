---
name: session-management-validation
description: Phase 2 Session Management 验证标准与测试用例
type: project
---

# Session Management Validation

## Success Criteria

| Criterion | How to Verify |
|-----------|---------------|
| Session 创建 | 运行 `bruce` 进入 REPL，检查 ~/.bruce/sessions.db 有新记录 |
| Session 恢复 | 运行 `bruce -s <uuid>`，对话历史正确显示 |
| 多轮对话 | 输入多条消息，每轮后 session 更新 |
| 保存退出 | Ctrl+D 后 session 文件更新 |
| 强制退出 | 双 Ctrl+C 后 session 未更新最后一轮 |
| 单轮兼容 | `bruce --message "xxx"` 正常执行不进入 REPL |

## Test Framework

- Using: Vitest（基于 specs/tech-stack.md TypeScript + Phase 1 测试选择）

## Test Cases

### Unit Tests

```typescript
// packages/app/src/session/storage.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SessionStorage } from './storage.js';
import type { Session } from './types.js';

describe('SessionStorage', () => {
  let storage: SessionStorage;

  beforeEach(() => {
    // 使用临时数据库
    storage = new SessionStorage('/tmp/test-sessions.db');
  });

  afterEach(() => {
    storage.close();
  });

  test('createSession generates UUID', () => {
    const session = storage.createSession();
    expect(session.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeGreaterThan(0);
  });

  test('saveSession and loadSession', () => {
    const session = storage.createSession();
    session.messages.push({ role: 'user', content: 'Hello', timestamp: Date.now() });
    storage.saveSession(session);

    const loaded = storage.loadSession(session.uuid);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages.length).toBe(1);
    expect(loaded!.messages[0].content).toBe('Hello');
  });

  test('listSessions returns all sessions', () => {
    storage.createSession();
    storage.createSession();
    const list = storage.listSessions();
    expect(list.length).toBe(2);
  });

  test('deleteSession removes session', () => {
    const session = storage.createSession();
    storage.deleteSession(session.uuid);
    const loaded = storage.loadSession(session.uuid);
    expect(loaded).toBeNull();
  });
});
```

### Integration Tests

| Test | Description | Expected Outcome |
|------|-------------|------------------|
| REPL Entry | 运行 `bruce` 无参数 | 显示 `bruce>` 提示符，创建新 session |
| Session Resume | 运行 `bruce -s <existing-uuid>` | 恢复对话历史，显示之前消息 |
| Multi-turn | REPL 输入 3 条消息 | 每条后 session.updatedAt 更新 |
| Ctrl+D Exit | REPL 输入消息后 Ctrl+D | 进程退出，session 已保存最新消息 |
| Double Ctrl+C | REPL 输入消息后双 Ctrl+C | 进程退出，session 未保存最新消息 |
| Invalid UUID | `bruce -s invalid-uuid` | 报错提示 "Session not found" |
| Single Turn | `bruce --message "test"` | 执行单轮对话，进程退出，不创建 session |

## Merge Checklist

- [ ] 所有单元测试通过 (`npm test`)
- [ ] REPL 功能手动验证
- [ ] 退出行为验证（Ctrl+D / 双 Ctrl+C）
- [ ] Session 恢复验证
- [ ] 单轮 `--message` 模式兼容验证
- [ ] 无 regressions（原有功能正常）