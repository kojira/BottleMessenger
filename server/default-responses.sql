-- デフォルトの応答メッセージを挿入するSQL

-- 既存のレコードを削除（オプション）
-- DELETE FROM bot_responses;

-- Blueskyプラットフォームのデフォルト応答
INSERT INTO bot_responses (platform, response_type, message, created_at, updated_at)
VALUES 
  ('bluesky', 'help', '使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('bluesky', 'bottle_sent', 'ボトルメールを放流しました！🌊', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'bottle_received', 'ボトルメール #{id}

{content}

from {platform}{replies}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'reply_sent', '返信を送信しました！', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'reply_notification', 'ボトルメール #{id} に返信がありました:

{content}

from {platform}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'list', 'あなたのボトルメール一覧:
{bottleList}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'error', 'エラーが発生しました。もう一度お試しください。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'error_message_too_long', 'メッセージは140文字以内にしてください。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('bluesky', 'stats', '📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('bluesky', 'auto_post', '📊 Blueskyボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Nostrプラットフォームのデフォルト応答
INSERT INTO bot_responses (platform, response_type, message, created_at, updated_at)
VALUES 
  ('nostr', 'help', '使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('nostr', 'bottle_sent', 'ボトルメールを放流しました！🌊', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'bottle_received', 'ボトルメール #{id}

{content}

from {platform}{replies}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'reply_sent', '返信を送信しました！', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'reply_notification', 'ボトルメール #{id} に返信がありました:

{content}

from {platform}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'list', 'あなたのボトルメール一覧:
{bottleList}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'error', 'エラーが発生しました。もう一度お試しください。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'error_message_too_long', 'メッセージは140文字以内にしてください。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  ('nostr', 'stats', '📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('nostr', 'auto_post', '📊 Nostrボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
