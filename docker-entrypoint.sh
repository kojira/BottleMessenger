#!/bin/sh
set -e

# Ensure the SQLite data directory exists and has correct permissions
mkdir -p /app/data
chmod 755 /app/data
touch /app/data/bottlemessenger.db
chmod 644 /app/data/bottlemessenger.db

echo "データベースパス: ${SQLITE_DB_PATH:-/app/data}"
echo "データベースファイル: /app/data/bottlemessenger.db"
ls -la /app/data

# Check if we're in development or production mode
if [ "$NODE_ENV" = "development" ]; then
  echo "開発モードで実行中..."
  
  # Install dependencies if node_modules doesn't exist or is empty
  if [ ! -d "/app/node_modules" ] || [ -z "$(ls -A /app/node_modules)" ]; then
    echo "node_modulesが存在しないか空です。依存関係をインストールします..."
    npm ci
  fi
  
  # Ensure theme.json exists and has the correct format
  if [ ! -f "/app/theme.json" ]; then
    echo "theme.jsonが存在しません。theme.jsonを作成します..."
    cat > /app/theme.json << EOL
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
EOL
  fi
  
  # theme.jsonの存在を確認
  if [ -f "/app/theme.json" ]; then
    echo "theme.jsonが存在します"
  else
    echo "theme.jsonが存在しません"
  fi
  
  
  # Run migration script directly from source
  echo "データベースマイグレーションを実行中..."
  npx tsx server/migrate.ts
  
  # Apply default bot responses
  echo "デフォルトのBot応答メッセージを適用中..."
  npx tsx server/apply-default-responses.ts
  
  # 開発サーバーを起動
  echo "開発サーバーを起動中..."
  exec npm run dev
else
  # Run custom migration script instead of drizzle-kit
  echo "データベースマイグレーションを実行中..."
  node dist/migrate.js
  
  # Apply default bot responses
  echo "デフォルトのBot応答メッセージを適用中..."
  node dist/apply-default-responses.js

  # Start the application
  echo "アプリケーションを起動中..."
  exec npm run start
fi
