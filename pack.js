#!/usr/bin/env node
/**
 * 把单文件原型打成一个可以直接丢进 Capacitor WebView 的 www/index.html。
 *
 *   1. 读 app/prototype.html（仓库里那份原型；找不到就回退到上一层的 课表工具.html）
 *   2. 在 </body> 前插两个脚本：shell.js（原生外壳适配）、notify.js（本地通知）
 *   3. 写到 www/index.html
 *
 * 原型本身不用改，打包产物随时可以用原型重新生成。
 * 用法： node tools/pack.js [源文件路径]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const local = path.join(root, 'app', 'prototype.html');
const external = path.join(root, '..', '课表工具.html');
const src = process.argv[2] || (fs.existsSync(local) ? local : external);
const outDir = path.join(root, 'www');
const out = path.join(outDir, 'index.html');

const TAG = '\n<!-- Capacitor 外壳：原生状态栏适配 + 本地通知排程 -->\n' +
  '<script src="shell.js"></script>\n' +
  '<script src="notify.js"></script>\n';

if (!fs.existsSync(src)) {
  console.error('找不到原型文件：' + src);
  console.error('把 课表工具.html 放到 app/prototype.html，或用 node tools/pack.js <路径> 指定');
  process.exit(1);
}

let html = fs.readFileSync(src, 'utf8');

if (html.includes('src="notify.js"')) {
  console.log('已经打过包了，跳过注入');
} else {
  if (!html.includes('</body>')) throw new Error('源文件里找不到 </body>，确认路径对不对：' + src);
  html = html.replace('</body>', TAG + '</body>');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log('源：', path.relative(root, src));
console.log('打包完成 →', path.relative(root, out), '(' + Buffer.byteLength(html) + ' bytes)');
