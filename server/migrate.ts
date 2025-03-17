import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from "../shared/schema";
import path from 'path';
import fs from 'fs';

// SQLiteデータベースのパスを固定
const dbDir = '/app/data';
const dbPath = path.join(dbDir, 'bottlemessenger.db');

// データディレクトリが存在することを確認
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`SQLiteデータベースを使用: ${dbPath}`);

// データベース接続を作成
const sqlite = new Database(dbPath);

// Drizzleデータベースインスタンスを作成
const db = drizzle(sqlite, { schema });

// マイグレーションを実行
console.log('マイグレーションを実行中...');

// テーブルを作成するSQLクエリを実行
const tables = [
  `CREATE TABLE IF NOT EXISTS bot_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    bluesky_handle TEXT NOT NULL,
    bluesky_password TEXT NOT NULL,
    nostr_private_key TEXT NOT NULL,
    nostr_relays TEXT NOT NULL DEFAULT '["wss://relay.damus.io", "wss://nos.lol"]',
    enabled TEXT NOT NULL DEFAULT 'true',
    auto_start TEXT NOT NULL DEFAULT 'false',
    bluesky_ignore_before_time INTEGER,
    bot_status TEXT NOT NULL DEFAULT 'stopped'
  )`,
  `CREATE TABLE IF NOT EXISTS bottles (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    content TEXT NOT NULL,
    sender_platform TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
    status TEXT NOT NULL DEFAULT 'active'
  )`,
  `CREATE TABLE IF NOT EXISTS bottle_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    bottle_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    sender_platform TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
    FOREIGN KEY (bottle_id) REFERENCES bottles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    platform TEXT NOT NULL,
    user_id TEXT NOT NULL,
    bottles_sent INTEGER NOT NULL DEFAULT 0,
    bottles_received INTEGER NOT NULL DEFAULT 0,
    replies_sent INTEGER NOT NULL DEFAULT 0,
    last_activity INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    source_platform TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_user TEXT NOT NULL,
    target_platform TEXT NOT NULL,
    target_id TEXT,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
    status TEXT NOT NULL,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bot_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    platform TEXT NOT NULL UNIQUE,
    last_processed_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bot_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    platform TEXT NOT NULL,
    response_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
  )`,
  `CREATE TABLE IF NOT EXISTS command_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    platform TEXT NOT NULL,
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
  )`
];

// 既存のテーブルに新しいカラムを追加するSQLクエリ
const alterQueries = [
  `ALTER TABLE bot_settings ADD COLUMN auto_start TEXT DEFAULT 'false'`,
  `ALTER TABLE bot_settings ADD COLUMN bluesky_ignore_before_time INTEGER`,
  `ALTER TABLE bot_settings ADD COLUMN bot_status TEXT DEFAULT 'stopped'`,
  `ALTER TABLE bot_settings ADD COLUMN bluesky_auto_post_enabled TEXT DEFAULT 'true'`,
  `ALTER TABLE bot_settings ADD COLUMN bluesky_auto_post_interval INTEGER DEFAULT 10`,
  `ALTER TABLE bot_settings ADD COLUMN nostr_auto_post_enabled TEXT DEFAULT 'true'`,
  `ALTER TABLE bot_settings ADD COLUMN nostr_auto_post_interval INTEGER DEFAULT 10`
];

// 既存のレコードを更新するSQLクエリ
const updateQueries = [
  `UPDATE bot_settings SET auto_start = 'false' WHERE auto_start IS NULL`,
  `UPDATE bot_settings SET bot_status = 'stopped' WHERE bot_status IS NULL`,
  `UPDATE bot_settings SET bluesky_ignore_before_time = NULL WHERE id = 1`,
  `UPDATE bot_settings SET bluesky_auto_post_enabled = 'true' WHERE bluesky_auto_post_enabled IS NULL`,
  `UPDATE bot_settings SET bluesky_auto_post_interval = 10 WHERE bluesky_auto_post_interval IS NULL`,
  `UPDATE bot_settings SET nostr_auto_post_enabled = 'true' WHERE nostr_auto_post_enabled IS NULL`,
  `UPDATE bot_settings SET nostr_auto_post_interval = 10 WHERE nostr_auto_post_interval IS NULL`
];

// 各テーブルを作成
tables.forEach(tableQuery => {
  try {
    sqlite.exec(tableQuery);
    console.log('テーブルを作成しました');
  } catch (error) {
    console.error('テーブル作成エラー:', error);
  }
});

// 既存のテーブルを変更
alterQueries.forEach(alterQuery => {
  try {
    sqlite.exec(alterQuery);
    console.log('テーブルを変更しました');
  } catch (error) {
    // カラムが既に存在する場合はエラーを無視
    console.log('テーブル変更をスキップしました (カラムが既に存在する可能性があります)');
  }
});

// 既存のレコードを更新
updateQueries.forEach(updateQuery => {
  try {
    sqlite.exec(updateQuery);
    console.log('レコードを更新しました');
  } catch (error) {
    console.error('レコード更新エラー:', error);
  }
});

console.log('マイグレーション完了');
