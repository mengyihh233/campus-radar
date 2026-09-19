/**
 * tools/check-exports.mjs — 校验具名导入是否真实存在
 *
 * ES Modules 的一个重要陷阱：
 *   从一个模块 import 一个不存在的具名导出时，多数打包器和浏览器
 *   不会报错，而是在运行到那一行时才抛出「undefined is not a function」，
 *   甚至静默地把 undefined 传给下游，导致很难定位的白屏。
 *
 * 这个脚本在提交前静态地把「import 的名字」与「目标模块 export 的名字」对一遍，
 * 因此能拦住一大类只有真机运行时才暴露的问题。
 *
 * 用法：node tools/check-exports.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'cloud-functions'];

/* --------------------------------------------------------------------------
 * 收集文件
 * ------------------------------------------------------------------------ */

function collect(dir, out = []) {
  const absolute = join(projectRoot, dir);
  if (!existsSync(absolute)) return out;

  for (const entry of readdirSync(absolute)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(absolute, entry);
    if (statSync(full).isDirectory()) collect(relative(projectRoot, full), out);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) out.push(full);
  }
  return out;
}

/* --------------------------------------------------------------------------
 * 解析导出名
 * ------------------------------------------------------------------------ */

/** 提取一个模块对外暴露的全部具名导出 */
function collectExports(source) {
  const names = new Set();
  names.add('default');

  // export function foo / export async function foo / export class Foo
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }

  // export const foo / let / var
  for (const m of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }

  // export { a, b as c }
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const alias = piece.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
      if (alias) names.add(alias[1]);
      else {
        const plain = piece.match(/^([A-Za-z_$][\w$]*)/);
        if (plain) names.add(plain[1]);
      }
    }
  }

  // export * from '...' —— 无法静态确定，标记为「不可判定」
  const hasStarExport = /export\s*\*\s*from/.test(source);

  return { names, hasStarExport };
}

/* --------------------------------------------------------------------------
 * 解析导入
 * ------------------------------------------------------------------------ */

/** 提取 import 语句里的具名导入 */
function collectImports(source) {
  const results = [];

  // import { a, b as c } from '...'
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const specifier = m[2];
    const items = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((piece) => {
        // 形如 `original as alias`，导入后使用的名字是 alias
        const alias = piece.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
        const name = alias ? alias[1] : piece.match(/^([A-Za-z_$][\w$]*)/)?.[1];
        return name;
      })
      .filter(Boolean);
    results.push({ specifier, names: items });
  }

  return results;
}

/* --------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------ */

const files = [];
for (const dir of SCAN_DIRS) collect(dir, files);

const exportCache = new Map();

function exportsOf(absolutePath) {
  if (!exportCache.has(absolutePath)) {
    exportCache.set(absolutePath, collectExports(readFileSync(absolutePath, 'utf8')));
  }
  return exportCache.get(absolutePath);
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const target = resolve(dirname(fromFile), specifier);
  for (const candidate of [target, `${target}.js`, join(target, 'index.js')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const problems = [];
let checkedImports = 0;
let checkedNames = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  for (const { specifier, names } of collectImports(source)) {
    const target = resolveSpecifier(file, specifier);
    if (!target) continue; // 非相对导入交给 check-imports 处理

    checkedImports += 1;
    const { names: exported, hasStarExport } = exportsOf(target);
    if (hasStarExport) continue; // 有 re-export 时无法静态判定

    for (const name of names) {
      checkedNames += 1;
      if (!exported.has(name)) {
        problems.push({
          file: relative(projectRoot, file),
          specifier,
          target: relative(projectRoot, target),
          name,
        });
      }
    }
  }
}

console.log(
  `[check-exports] 检查了 ${checkedImports} 条相对导入、${checkedNames} 个具名引用`
);

if (problems.length) {
  console.log(`\n发现 ${problems.length} 处引用了不存在的导出：`);
  for (const p of problems) {
    console.log(`  ✗ ${p.file}`);
    console.log(`      从 '${p.specifier}' 导入的 \`${p.name}\` 在 ${p.target} 中不存在`);
  }
  process.exit(1);
}

console.log('[check-exports] 全部通过 ✓');
