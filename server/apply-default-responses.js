import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyDefaultResponses() {
  try {
    console.log('Applying default bot responses...');
    
    // SQLファイルを読み込む
    const sqlFilePath = path.join(__dirname, 'default-responses.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // SQLステートメントを実行
    await db.run(sql);
    
    console.log('Default bot responses applied successfully!');
  } catch (error) {
    console.error('Error applying default bot responses:', error);
  } finally {
    // データベース接続を閉じる
    await db.close();
  }
}

applyDefaultResponses();
