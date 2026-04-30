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
    // 创建表（包含 cwd 列）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        uuid TEXT PRIMARY KEY,
        cwd TEXT,
        messages_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata_json TEXT
      )
    `);

    // 迁移：旧表可能没有 cwd 列，检查并添加
    const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
    if (!columns.some(col => col.name === "cwd")) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN cwd TEXT");
    }

    // 创建索引
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_cwd ON sessions(cwd)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)");
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
    const cwd = session.metadata?.cwd ?? null;
    this.db.prepare(`
      INSERT OR REPLACE INTO sessions (uuid, cwd, messages_json, created_at, updated_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      session.uuid,
      cwd,
      JSON.stringify(session.messages),
      session.createdAt,
      session.updatedAt,
      session.metadata ? JSON.stringify(session.metadata) : null
    );
  }

  /** 列出 session（可选按 cwd 过滤） */
  listSessions(filterByCwd?: string): SessionListItem[] {
    let rows;
    if (filterByCwd) {
      // 使用 cwd 列精确查询（有索引，高效）
      rows = this.db.prepare(`
        SELECT uuid, created_at, updated_at, messages_json
        FROM sessions
        WHERE cwd = ?
        ORDER BY updated_at DESC
      `).all(filterByCwd) as Array<{
        uuid: string;
        created_at: number;
        updated_at: number;
        messages_json: string;
      }>;
    } else {
      rows = this.db.prepare(`
        SELECT uuid, created_at, updated_at, messages_json
        FROM sessions
        ORDER BY updated_at DESC
      `).all() as Array<{
        uuid: string;
        created_at: number;
        updated_at: number;
        messages_json: string;
      }>;
    }

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