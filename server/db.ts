import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// SQLiteデータベースのパス
// Docker環境では '/app/data' を使用し、ローカル環境ではプロジェクトの 'data' ディレクトリを使用
const isDocker = process.env.DOCKER === 'true';
const dbDir = isDocker ? '/app/data' : path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'bottlemessenger.db');

// データディレクトリが存在することを確認
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`SQLiteデータベースを使用: ${dbPath}`);

// データベース接続を作成
const sqlite = new Database(dbPath);

// Drizzleデータベースインスタンスを作成
export const db = drizzle(sqlite, { schema });
