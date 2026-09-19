/**
 * tools/check-imports.mjs — 静态校验相对 import 路径
 *
 * 纯前端工程没有类型系统兜底，模块路径写错只会在运行时白屏。
 * 这里在构建前把所有相对 import 的解析结果检查一遍。
 *
 * 用法：node tools/check-imports.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['src', 'cloud-functions', 'tools'];

const IMPORT_RE =
  /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?)\s+from\s+|import\s+|export\s+(?:[\s\S]*?)\s+from\s+)['"]([^'"]+)['"]/g;

/** 递归收集 .js 文件 */
function collect(dir, out = []) {
  const absolute = join(projectRoot, dir);
  if (!existsSync(absolute)) return out;

  for (const entry of readdirSync(absolute)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(absolute, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collect(relative(projectRoot, full), out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const problems = [];
const checked = [];

for (const dir of SCAN_DIRS) {
  for (const file of collect(dir)) {
    const source = readFileSync(file, 'utf8');
    IMPORT_RE.lastIndex = 0;

    let match;
    while ((match = IMPORT_RE.exec(source)) !== null) {
      const spec = match[1];

      // 跳过裸模块（npm 包）
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;

      // 站内绝对路径（前端从站点根引用）不参与文件系统校验
      if (spec.startsWith('/')) continue;

      const target = resolve(dirname(file), spec);
      const candidates = [target, `${target}.js`, join(target, 'index.js')];

      const found = candidates.some((candidate) => existsSync(candidate));
      checked.push(spec);

      if (!found) {
        problems.push({
          file: relative(projectRoot, file),
          spec,
          resolved: relative(projectRoot, target),
        });
      }
    }
  }
}

console.log(`[check-imports] 检查了 ${checked.length} 处相对引用`);

if (problems.length) {
  console.log(`\n发现 ${problems.length} 处无法解析的引用：`);
  for (const p of problems) {
    console.log(`  ✗ ${p.file}\n      → '${p.spec}'  (解析为 ${p.resolved})`);
  }
  process.exit(1);
}

console.log('[check-imports] 全部通过 ✓');
