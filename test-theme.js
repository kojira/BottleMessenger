#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テーマファイルのパス
const themePath = path.join(process.cwd(), 'theme.json');

// テーマファイルの内容を読み込む
console.log(`テーマファイル ${themePath} を読み込み中...`);
let themeContent;
try {
  themeContent = fs.readFileSync(themePath, 'utf8');
  console.log('テーマファイルの内容:');
  console.log(themeContent);
} catch (err) {
  console.error(`テーマファイルの読み込みエラー: ${err.message}`);
  process.exit(1);
}

// テーマファイルをJSONとしてパース
let themeJson;
try {
  themeJson = JSON.parse(themeContent);
  console.log('テーマJSONのパース成功');
} catch (err) {
  console.error(`テーマJSONのパースエラー: ${err.message}`);
  process.exit(1);
}

// 異なるvariant値でテスト
const variants = ['professional', 'tint', 'vibrant'];
console.log('異なるvariant値でテスト:');

// 元のテーマJSONを保存
const originalTheme = { ...themeJson };

// 各variantでテスト
for (const variant of variants) {
  console.log(`variant: ${variant} でテスト中...`);
  
  // テーマJSONを更新
  themeJson.variant = variant;
  
  // ファイルに書き込み
  try {
    fs.writeFileSync(themePath, JSON.stringify(themeJson, null, 2));
    console.log(`variant: ${variant} でテーマファイルを更新しました`);
    
    // テーマプラグインをシミュレート
    try {
      // テーマプラグインのパッケージパス
      const pluginPath = path.join(process.cwd(), 'node_modules', '@replit', 'vite-plugin-shadcn-theme-json');
      
      // パッケージが存在するか確認
      if (fs.existsSync(pluginPath)) {
        console.log(`パッケージパス ${pluginPath} が存在します`);
        
        // パッケージのメインファイルを取得
        const packageJsonPath = path.join(pluginPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const mainFile = packageJson.main || 'dist/index.js';
        const mainFilePath = path.join(pluginPath, mainFile);
        
        console.log(`メインファイル: ${mainFilePath}`);
        
        // パッケージをロード
        if (fs.existsSync(mainFilePath)) {
          console.log(`メインファイルが存在します`);
          
          // パッケージをロード
          try {
            // ESMでは動的importを使用
            const pluginModule = await import(pluginPath);
            const plugin = pluginModule.default;
            console.log(`パッケージをロードしました: ${typeof plugin}`);
            
            // プラグインを初期化
            if (typeof plugin === 'function') {
              try {
                const instance = plugin();
                console.log(`プラグインを初期化しました: ${typeof instance}`);
                
                // buildStartメソッドをシミュレート
                if (instance && typeof instance.buildStart === 'function') {
                  try {
                    instance.buildStart();
                    console.log(`buildStartメソッドを実行しました: 成功`);
                  } catch (err) {
                    console.error(`buildStartメソッドの実行エラー: ${err.message}`);
                    console.error(err.stack);
                  }
                } else {
                  console.log(`buildStartメソッドが見つかりません`);
                }
              } catch (err) {
                console.error(`プラグインの初期化エラー: ${err.message}`);
                console.error(err.stack);
              }
            } else {
              console.log(`パッケージは関数ではありません: ${typeof plugin}`);
            }
          } catch (err) {
            console.error(`パッケージのロードエラー: ${err.message}`);
            console.error(err.stack);
          }
        } else {
          console.error(`メインファイルが存在しません: ${mainFilePath}`);
        }
      } else {
        console.error(`パッケージパス ${pluginPath} が存在しません`);
      }
    } catch (err) {
      console.error(`テーマプラグインのシミュレーションエラー: ${err.message}`);
      console.error(err.stack);
    }
  } catch (err) {
    console.error(`テーマファイルの書き込みエラー: ${err.message}`);
  }
}

// 元のテーマJSONに戻す
fs.writeFileSync(themePath, JSON.stringify(originalTheme, null, 2));
console.log('元のテーマファイルに戻しました');

console.log('テスト完了');
