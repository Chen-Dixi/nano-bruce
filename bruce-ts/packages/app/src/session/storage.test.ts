/**
 * Session Storage 单元测试
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { SessionStorage } from "./storage.js";
import type { Session } from "./types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("SessionStorage", () => {
  let storage: SessionStorage;
  let testDbPath: string;

  beforeEach(() => {
    // 使用临时数据库
    testDbPath = path.join(os.tmpdir(), `test-sessions-${Date.now()}.db`);
    storage = new SessionStorage(testDbPath);
  });

  afterEach(() => {
    storage.close();
    // 清理临时文件
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test("createSession generates valid UUID", () => {
    const session = storage.createSession();
    expect(session.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.updatedAt).toBeGreaterThan(0);
  });

  test("createSession with metadata", () => {
    const metadata = { cwd: "/tmp", skillsDir: "/skills" };
    const session = storage.createSession(metadata);
    expect(session.metadata?.cwd).toBe("/tmp");
    expect(session.metadata?.skillsDir).toBe("/skills");
  });

  test("saveSession and loadSession", () => {
    const session = storage.createSession();
    session.messages.push({
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    });
    storage.saveSession(session);

    const loaded = storage.loadSession(session.uuid);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages.length).toBe(1);
    expect(loaded!.messages[0].content).toBe("Hello");
    expect(loaded!.updatedAt).toBeGreaterThanOrEqual(session.createdAt);
  });

  test("loadSession returns null for invalid UUID", () => {
    const loaded = storage.loadSession("non-existent-uuid");
    expect(loaded).toBeNull();
  });

  test("listSessions returns all sessions", () => {
    storage.createSession();
    storage.createSession();
    const list = storage.listSessions();
    expect(list.length).toBe(2);
  });

  test("listSessions returns correct messageCount", () => {
    const session = storage.createSession();
    session.messages.push({ role: "user", content: "Hi", timestamp: Date.now() });
    session.messages.push({ role: "assistant", content: [{ type: "text", text: "Hello!" }], timestamp: Date.now() });
    storage.saveSession(session);

    const list = storage.listSessions();
    const found = list.find(s => s.uuid === session.uuid);
    expect(found?.messageCount).toBe(2);
  });

  test("deleteSession removes session", () => {
    const session = storage.createSession();
    storage.deleteSession(session.uuid);
    const loaded = storage.loadSession(session.uuid);
    expect(loaded).toBeNull();
  });

  test("saveSession updates updatedAt", () => {
    const session = storage.createSession();
    const originalUpdatedAt = session.updatedAt;

    // 等待一小段时间确保时间戳变化
    const start = Date.now();
    while (Date.now() - start < 10) {}

    session.messages.push({ role: "user", content: "New message", timestamp: Date.now() });
    storage.saveSession(session);

    const loaded = storage.loadSession(session.uuid);
    expect(loaded!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });
});