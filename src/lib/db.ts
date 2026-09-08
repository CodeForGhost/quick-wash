import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

// A single connection is reused across requests. In dev, Next.js re-evaluates
// modules on every hot reload, so the handle is cached on globalThis to avoid
// opening (and leaking) a new connection each time.
const globalForDb = globalThis as unknown as { __laundryDb?: Database.Database };

function createConnection(): Database.Database {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "laundry.db");
  const dir = path.dirname(path.resolve(file));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const conn = new Database(path.resolve(file));
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA_SQL);
  return conn;
}

export const db: Database.Database = globalForDb.__laundryDb ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.__laundryDb = db;

/** Rows come back as plain objects; this narrows the `unknown` from better-sqlite3. */
export function all<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}

/** Current time in the same `YYYY-MM-DD HH:MM:SS` shape SQLite's datetime() uses. */
export function now(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** Today as `YYYY-MM-DD`, in the server's local timezone. */
export function today(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
