/**
 * _lib/store.js — Blob 数据访问层
 *
 * 平台不提供托管数据库，Blob 就是数据库：key 前缀即「表」，「一个记录一个文件」。
 * IRON RULE：getStore 必须带 consistency: "strong"，否则会出现「刚写入却读不到」。
 */

import { getStore } from '@edgeone/pages-blob';

const STORE_NAME = 'campus-radar';

let instance = null;

export function db() {
  if (!instance) {
    instance = getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return instance;
}

/** key 命名规范：前缀即表名 */
export const KEYS = {
  activity: (id) => `activities/${id}.json`,
  user: (uid) => `users/${uid}.json`,
  session: (token) => `sessions/${token}.json`,
  favorites: (uid) => `favorites/${uid}.json`,
  report: (id) => `reports/${id}.json`,
  audit: (id) => `audit/${id}.json`,
  meta: (name) => `meta/${name}.json`,
};

export const PREFIX = {
  activities: 'activities/',
  users: 'users/',
  sessions: 'sessions/',
  reports: 'reports/',
  audit: 'audit/',
};

/** 读取单个 JSON，不存在返回 fallback */
export async function getJSON(key, fallback = null) {
  try {
    const value = await db().get(key, { type: 'json' });
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/** 写入 JSON */
export async function setJSON(key, value, options) {
  await db().setJSON(key, value, options);
}

/** 删除 */
export async function remove(key) {
  await db().delete(key);
}

/**
 * 按前缀取出全部 JSON 记录。
 * list 默认自动翻页，这里直接全量取回后过滤空值。
 */
export async function listJSON(prefix) {
  const { blobs } = await db().list({ prefix });
  const rows = await Promise.all(
    blobs.map(async (b) => {
      try {
        return await db().get(b.key, { type: 'json' });
      } catch {
        return null;
      }
    })
  );
  return rows.filter((r) => r && typeof r === 'object');
}

/** 仅取 key 列表，适合只需要计数的场景 */
export async function listKeys(prefix) {
  const { blobs } = await db().list({ prefix });
  return blobs.map((b) => b.key);
}
