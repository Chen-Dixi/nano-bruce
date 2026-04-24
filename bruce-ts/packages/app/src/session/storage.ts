/**
 * Session SQLite 存储层
 *
 * 使用 better-sqlite3 实现持久化存储
 */

import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { Session, SessionMetadata, SessionListItem } from "./types.js";
import type { AgentMessage } from "@nano-bruce/agent-core";

/** Sessions 数据库路径（默认 ~/.bruce/sessions.db） */
export function getSessionsDbPath(): string {
  const bruceDir = path.join(os.homedir(), ".bruce");
  if (!fs.existsSync(bruceDir)) {
    fs.mkdirSync(bruceDir, { recursive: true });
  }
  return path.join(bruceDir, "sessions.db");
}

export class SessionStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? getSessionsDbPath();
    this.db = new Database(path);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        uuid TEXT PRIMARY KEY,
        messages_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata_json TEXT
      )
    `);
  }

  /** 创建新 session（自动生成 UUID） */
  createSession(metadata?: SessionMetadata): Session {
    const session: Session = {
      uuid: randomUUID(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };
    this.saveSession(session);
    return session;
  }

  /** 加载指定 session */
  loadSession(uuid: string): Session | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE uuid = ?").get(uuid) as {
      uuid: string;
      messages_json: string;
      created_at: number;
      updated_at: number;
      metadata_json: string | null;
    } | undefined;

    if (!row) return null;

    return {
      uuid: row.uuid,
      messages: JSON.parse(row.messages_json) as AgentMessage[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  /** 保存/更新 session */
  saveSession(session: Session): void {
    session.updatedAt = Date.now();
    this.db.prepare(`
      INSERT OR REPLACE INTO sessions (uuid, messages_json, created_at, updated_at, metadata_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      session.uuid,
      JSON.stringify(session.messages),
      session.createdAt,
      session.updatedAt,
      session.metadata ? JSON.stringify(session.metadata) : null
    );
  }

  /** 列出所有 session（简要信息） */
  listSessions(): SessionListItem[] {
    const rows = this.db.prepare("SELECT uuid, created_at, updated_at, messages_json FROM sessions ORDER BY updated_at DESC").all() as Array<{
      uuid: string;
      created_at: number;
      updated_at: number;
      messages_json: string;
    }>;

    return rows.map(row => ({
      uuid: row.uuid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: (JSON.parse(row.messages_json) as AgentMessage[]).length,
    }));
  }

  /** 删除指定 session */
  deleteSession(uuid: string): void {
    this.db.prepare("DELETE FROM sessions WHERE uuid = ?").run(uuid);
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }
}