# Docker Development Guide

このプロジェクトはDockerを使用して開発およびデプロイすることができます。

## 開発モード

開発モードでは、ホストマシンのソースコードの変更がコンテナ内に自動的に反映されます。これにより、コンテナを再ビルドすることなく開発を進めることができます。

### 開発モードの起動

```bash
# 開発モードでコンテナを起動（初回または変更後はビルドが必要）
docker compose up -d --build

# ログを確認
docker compose logs -f
```

開発モードでは以下の機能が有効になります：

- ホストのプロジェクトディレクトリ全体がコンテナにマウントされ、変更が即座に反映されます
- TypeScriptファイルが直接実行されるため、ビルド不要です
- ホットリロードが有効になり、コードの変更時に自動的にサーバーが再起動します

### 開発モードの停止

```bash
docker compose down
```

## 本番モード

本番モードでは、アプリケーションがビルドされ、最適化された状態で実行されます。

### 本番モードの起動

```bash
# NODE_ENV環境変数を明示的に設定して本番モードで起動
NODE_ENV=production docker compose up -d --build

# または docker-compose.override.yml を無視して起動
docker compose -f docker-compose.yml up -d --build
```

### 本番モードの停止

```bash
docker compose down
```

## データベース

SQLiteデータベースは `/app/data` ディレクトリに保存されます。

- **開発モード**: データベースファイルは `./data` ディレクトリにマウントされ、ホスト側からアクセスできます。
- **本番モード**: データベースファイルは名前付きボリューム `sqlite-data` に保存され、コンテナを再起動してもデータが保持されます。

ホスト側の `./data` ディレクトリにアクセスすることで、開発中にデータベースファイルを直接確認・編集することができます。

## 環境変数

以下の環境変数を設定することで、アプリケーションの動作をカスタマイズできます：

- `NODE_ENV`: `development` または `production`（デフォルトは `production`）
- `SQLITE_DB_PATH`: SQLiteデータベースのパス（デフォルトは `/app/data`）
- `BLUESKY_HANDLE`: Blueskyアカウントのハンドル
- `BLUESKY_PASSWORD`: Blueskyアカウントのパスワード
- `NOSTR_PRIVATE_KEY`: Nostrアカウントの秘密鍵
- `NOSTR_RELAYS`: Nostrリレーのリスト（JSON配列形式）

## トラブルシューティング

### ファイルの変更が反映されない

開発モードで実行している場合、ホストマシンでのファイル変更はコンテナ内に自動的に反映されるはずです。もし変更が反映されない場合は、以下を確認してください：

1. `docker-compose.override.yml` が存在し、正しく設定されていることを確認
2. コンテナが開発モードで実行されていることを確認（`docker compose ps` で確認）
3. 必要に応じてコンテナを再起動（`docker compose restart`）

### TypeScriptファイルの変更が反映されない

TypeScriptファイルを変更した場合、サーバーは自動的に再起動するはずですが、もし変更が反映されない場合は、以下のコマンドでコンテナを再起動してください：

```bash
docker compose restart
```

### theme.jsonファイルのエラー

`Error: Failed to read theme file: ENOENT: no such file or directory, open './theme.json'` というエラーが発生した場合は、theme.jsonファイルが存在することを確認してください。

また、theme.jsonファイルの形式が正しくない場合も、エラーが発生します。theme.jsonファイルは以下の形式である必要があります：

```json
{
  "name": "default",
  "variant": "professional",
  "appearance": "light",
  "radius": 0.5,
  "primary": "#007bff",
  "primary-foreground": "#ffffff",
  "secondary": "#6c757d",
  "secondary-foreground": "#ffffff",
  "background": "#ffffff",
  "foreground": "#000000",
  "muted": "#f8f9fa",
  "muted-foreground": "#6c757d",
  "accent": "#fd7e14",
  "accent-foreground": "#ffffff",
  "destructive": "#dc3545",
  "destructive-foreground": "#ffffff",
  "border": "#dee2e6",
  "input": "#e9ecef",
  "ring": "#007bff"
}
```

注意: `variant`プロパティは`professional`、`tint`、または`vibrant`のいずれかである必要があります。

問題が発生した場合は、詳細なデバッグログが表示されるようになっています。これにより、問題の原因を特定しやすくなります。

theme.jsonファイルを修正した後、コンテナを再起動してください：

```bash
docker compose restart
```

### マイグレーションエラーが発生する場合

データベースマイグレーションでエラーが発生する場合は、以下のコマンドでコンテナ内でマイグレーションを手動実行してください：

```bash
docker compose exec app npx tsx server/migrate.ts
```

### パーミッションエラー

データディレクトリのパーミッションエラーが発生した場合は、以下のコマンドを実行してください：

```bash
docker compose down
docker volume rm bottlemessenger_sqlite-data
docker compose up -d
```

これにより、データボリュームが再作成され、適切なパーミッションが設定されます。

node_modulesディレクトリのパーミッションエラーが発生した場合は、開発モードではrootユーザーとして実行するように設定されています。もし問題が解決しない場合は、以下のコマンドを実行してください：

```bash
docker compose exec app chmod -R 777 /app/node_modules
```

エントリポイントスクリプトのパーミッションエラー（`exec ./docker-entrypoint.sh: permission denied`）が発生した場合は、以下のコマンドを実行してください：

```bash
chmod +x docker-entrypoint.sh
docker compose restart
```

または、docker-compose.override.ymlファイルに以下の設定が含まれていることを確認してください：

```yaml
command: sh -c "chmod +x /app/docker-entrypoint.sh && ./docker-entrypoint.sh"
```

### esbuildプラットフォームエラー

`You installed esbuild for another platform than the one you're currently using.` というエラーが発生した場合は、ホストマシンとコンテナのプラットフォームが異なるために発生しています。この問題を解決するために、以下の設定が行われています：

1. `docker-compose.override.yml`ファイルで`/app/node_modules`をマウントから除外
2. `docker-entrypoint.sh`ファイルで依存関係を自動的にインストール

もし問題が解決しない場合は、以下のコマンドを実行してコンテナ内で依存関係を再インストールしてください：

```bash
docker compose exec app npm ci
docker compose restart
```
