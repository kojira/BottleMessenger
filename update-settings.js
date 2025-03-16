#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// データベースファイルのパス
const dbPath = '/app/data/bottlemessenger.db';

console.log(`SQLiteデータベースを使用: ${dbPath}`);
const db = new Database(dbPath);

// 設定を更新
console.log('設定を更新中...');
try {
  // auto_startとbot_statusを更新
  const updateResult = db.prepare(`
    UPDATE bot_settings 
    SET auto_start = 'false', 
        bot_status = 'stopped', 
        bluesky_ignore_before_time = NULL 
    WHERE id = 1
  `).run();
  
  console.log('設定の更新結果:', updateResult);
  
  // 更新された設定を確認
  const settings = db.prepare('SELECT * FROM bot_settings WHERE id = 1').get();
  console.log('更新された設定:', settings);
} catch (error) {
  console.error('設定の更新中にエラーが発生しました:', error);
}

// データベース接続を閉じる
db.close();
