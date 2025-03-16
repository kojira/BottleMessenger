#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

// variantプロパティの値を確認
console.log(`variant: ${themeJson.variant}`);

// 異なるvariant値でテスト
const variants = ['default', 'rounded', 'square', 'classic', 'modern', 'flat'];
console.log('異なるvariant値でテスト:');
for (const variant of variants) {
  const testTheme = { ...themeJson, variant };
  fs.writeFileSync(themePath, JSON.stringify(testTheme, null, 2));
  console.log(`variant: ${variant} でテーマファイルを更新`);
}

console.log('デバッグ完了');
