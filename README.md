# Bluesky & Nostr Message Relay Bot 🌊

[English](#english) | [日本語](#japanese)

## English {#english}

A cross-platform message relay bot that bridges Bluesky and Nostr social networks, enabling seamless communication between these decentralized platforms.

### Features

- **Cross-Platform Messaging**: Relay messages between Bluesky and Nostr
- **Bottle Mail System**: Send and receive "bottle mail" messages across platforms
- **Real-time Notifications**: Get instant notifications when your messages receive replies (Note: Bluesky notifications use polling with 30-second intervals)
- **Multi-Language Support**: Full support for both Japanese and English
- **Interactive Commands**: Simple and intuitive command system
- **Dynamic Statistics**: Track message trends and user engagement
- **Secure Communication**: End-to-end encrypted messaging using platform-native protocols

### Commands

- `/new [message]` or `/流す [メッセージ]` - Create a new bottle mail
- `/check` or `/拾う` - Check for unread bottle mail
- `/reply [ID] [message]` or `/返信 [ID] [メッセージ]` - Reply to a bottle mail
- `/list` or `/リスト` - List your sent bottle mails
- `/stats` - View your statistics
- `/help` or `/ヘルプ` - Display help information

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure your environment variables:
   - `BLUESKY_HANDLE`: Your Bluesky account handle
   - `BLUESKY_PASSWORD`: Your Bluesky account password
   - `NOSTR_PRIVATE_KEY`: Your Nostr private key
   - `NOSTR_RELAYS`: JSON array of Nostr relay URLs
4. Start the server: `npm run dev`

### Dashboard Access

The dashboard is intended for personal use only and does not include authentication. Please ensure you deploy it in a secure environment and do not expose it to public access.

### Development Guide

1. **Database Setup**
   - Uses PostgreSQL for data persistence
   - Run `npm run db:push` to sync schema changes

2. **API Documentation**
   - Backend runs on Express.js
   - WebSocket connections for real-time updates (Nostr only)
   - RESTful endpoints for command processing
   - Bluesky uses polling with 30-second intervals

3. **Testing**
   - Run `npm test` for unit tests

### Technology Stack

- TypeScript/Node.js
- @atproto/api for Bluesky integration
- nostr-tools for Nostr protocol
- Express.js for API endpoints
- React + shadcn/ui for dashboard

### Troubleshooting

- If the bot disconnects, check your network connection and relay status
- Enable debug logging by setting `DEBUG=true`

## 日本語 {#japanese}

BlueskyとNostrのソーシャルネットワークを橋渡しする、クロスプラットフォームメッセージリレーボットです。これらの分散型プラットフォーム間でシームレスなコミュニケーションを実現します。

### 特徴

- **クロスプラットフォームメッセージング**: BlueskyとNostr間でメッセージを中継
- **ボトルメールシステム**: プラットフォームを越えてボトルメールを送受信
- **リアルタイム通知**: メッセージへの返信をすぐに通知（※Blueskyは30秒間隔のポーリング方式）
- **多言語対応**: 日本語と英語の完全サポート
- **インタラクティブなコマンド**: シンプルで直感的なコマンドシステム
- **動的な統計情報**: メッセージの傾向とユーザーエンゲージメントを追跡
- **安全な通信**: プラットフォームネイティブのプロトコルを使用したエンドツーエンドの暗号化メッセージング

### コマンド

- `/new [メッセージ]` または `/流す [メッセージ]` - 新しいボトルメールを作成
- `/check` または `/拾う` - 未読のボトルメールを確認
- `/reply [ID] [メッセージ]` または `/返信 [ID] [メッセージ]` - ボトルメールに返信
- `/list` または `/リスト` - 送信したボトルメールの一覧を表示
- `/stats` - 統計情報を表示
- `/help` または `/ヘルプ` - ヘルプ情報を表示

### セットアップ手順

1. リポジトリをクローン
2. 依存関係をインストール: `npm install`
3. 環境変数を設定:
   - `BLUESKY_HANDLE`: Blueskyアカウントのハンドル
   - `BLUESKY_PASSWORD`: Blueskyアカウントのパスワード
   - `NOSTR_PRIVATE_KEY`: Nostrの秘密鍵
   - `NOSTR_RELAYS`: NostrリレーURLのJSON配列
4. サーバーを起動: `npm run dev`

### ダッシュボードについて

ダッシュボードは個人利用を目的としており、認証機能は実装されていません。セキュアな環境にデプロイし、一般公開は避けてください。

### 開発ガイド

1. **データベースのセットアップ**
   - PostgreSQLを使用してデータを永続化
   - `npm run db:push`でスキーマの変更を同期

2. **API仕様**
   - バックエンドはExpress.jsで実装
   - WebSocketによるリアルタイム更新（Nostrのみ）
   - RESTfulエンドポイントでコマンドを処理
   - Blueskyは30秒間隔のポーリング方式を使用

3. **テスト**
   - `npm test`でユニットテストを実行

### 技術スタック

- TypeScript/Node.js
- @atproto/api (Bluesky連携用)
- nostr-tools (Nostrプロトコル用)
- Express.js (APIエンドポイント用)
- React + shadcn/ui (ダッシュボード用)

### トラブルシューティング

- ボットが切断された場合は、ネットワーク接続とリレーの状態を確認
- `DEBUG=true`を設定してデバッグログを有効化