import fs from 'fs';
import path from 'path';
import { db } from './db';
import { botResponses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function applyDefaultResponses() {
  try {
    console.log('Applying default bot responses...');
    
    // デフォルトの応答メッセージを定義
    const defaultResponses = [
      // Blueskyプラットフォームのデフォルト応答
      {
        platform: 'bluesky',
        responseType: 'help',
        message: `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`
      },
      {
        platform: 'bluesky',
        responseType: 'bottle_sent',
        message: 'ボトルメールを放流しました！🌊'
      },
      {
        platform: 'bluesky',
        responseType: 'bottle_received',
        message: `ボトルメール #{id}

{content}

from {platform}{replies}`
      },
      {
        platform: 'bluesky',
        responseType: 'reply_sent',
        message: '返信を送信しました！'
      },
      {
        platform: 'bluesky',
        responseType: 'reply_notification',
        message: `ボトルメール #{id} に返信がありました:

{content}

from {platform}`
      },
      {
        platform: 'bluesky',
        responseType: 'list',
        message: `あなたのボトルメール一覧:
{bottleList}`
      },
      {
        platform: 'bluesky',
        responseType: 'error',
        message: 'エラーが発生しました。もう一度お試しください。'
      },
      {
        platform: 'bluesky',
        responseType: 'stats',
        message: `📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}`
      },
      
      // Nostrプラットフォームのデフォルト応答
      {
        platform: 'nostr',
        responseType: 'help',
        message: `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`
      },
      {
        platform: 'nostr',
        responseType: 'bottle_sent',
        message: 'ボトルメールを放流しました！🌊'
      },
      {
        platform: 'nostr',
        responseType: 'bottle_received',
        message: `ボトルメール #{id}

{content}

from {platform}{replies}`
      },
      {
        platform: 'nostr',
        responseType: 'reply_sent',
        message: '返信を送信しました！'
      },
      {
        platform: 'nostr',
        responseType: 'reply_notification',
        message: `ボトルメール #{id} に返信がありました:

{content}

from {platform}`
      },
      {
        platform: 'nostr',
        responseType: 'list',
        message: `あなたのボトルメール一覧:
{bottleList}`
      },
      {
        platform: 'nostr',
        responseType: 'error',
        message: 'エラーが発生しました。もう一度お試しください。'
      },
      {
        platform: 'nostr',
        responseType: 'stats',
        message: `📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}`
      }
    ];
    
    // 各応答メッセージを挿入
    for (const response of defaultResponses) {
      // 既存のレコードを確認
      const existing = await db.select().from(botResponses)
        .where(
          and(
            eq(botResponses.platform, response.platform),
            eq(botResponses.responseType, response.responseType)
          )
        );
      
      if (existing.length === 0) {
        // 存在しない場合は挿入
        await db.insert(botResponses).values({
          platform: response.platform,
          responseType: response.responseType,
          message: response.message,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Added ${response.platform} ${response.responseType} response`);
      } else {
        console.log(`Skipped existing ${response.platform} ${response.responseType} response`);
      }
    }
    
    console.log('Default bot responses applied successfully!');
  } catch (error) {
    console.error('Error applying default bot responses:', error);
  }
}

applyDefaultResponses();
