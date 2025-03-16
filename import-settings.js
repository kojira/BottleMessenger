#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { botSettings } from './shared/schema.js';

// ES Modulesでは__dirnameが利用できないため、代わりに以下を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// データディレクトリとデータベースファイルのパス
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'bottlemessenger.db');
const settingsPath = path.join(dataDir, 'settings.json');

// データベース接続を作成
console.log(`SQLiteデータベースを使用: ${dbPath}`);
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

try {
  // 設定ファイルを読み込む
  console.log(`設定ファイルを読み込み: ${settingsPath}`);
  const settingsJson = fs.readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(settingsJson);

  // 設定をデータベースに挿入または更新
  console.log('設定をデータベースに挿入または更新...');
  const result = db.insert(botSettings)
    .values(settings)
    .onConflictDoUpdate({
      target: botSettings.id,
      set: settings
    });

  console.log('設定のインポートが完了しました');
} catch (error) {
  console.error('設定のインポート中にエラーが発生しました:', error);
} finally {
  // データベース接続を閉じる
  sqlite.close();
}
