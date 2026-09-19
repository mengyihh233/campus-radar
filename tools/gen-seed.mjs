/**
 * tools/gen-seed.mjs — 由前端数据源生成服务端播种数据
 *
 * 内置的 26 条校园信息只维护一份：src/data/activities.js。
 * 服务端需要的副本由本脚本生成，避免两处手工维护导致不一致。
 *
 * 用法：node tools/gen-seed.mjs
 */

import { writeFileSync } from 'node:fs';
import { ACTIVITIES } from '../src/data/activities.js';

const SEED_VERSION = 1;

const header = `/**
 * _lib/seed.js — 内置模拟校园信息（服务端播种用）
 *
 * ⚠️ 本文件由 tools/gen-seed.mjs 自动生成，请勿手工编辑。
 * 数据源：src/data/activities.js
 */

export const SEED_VERSION = ${SEED_VERSION};

/** 内置信息的数据基准日，用于生成 createdAt */
export const SEED_BASE_TIME = new Date('2026-09-19T08:00:00').getTime();

export const SEED_ACTIVITIES = `;

const footer = `;

/** 需要单独保留的补充通知 id */
export const SEED_NOTICE_IDS = ['09', '20'];
`;

const payload = `${header}${JSON.stringify(ACTIVITIES, null, 2)}${footer}`;

const target = new URL('../cloud-functions/_lib/seed.js', import.meta.url);
writeFileSync(target, payload, 'utf8');

const noticeCount = ACTIVITIES.filter((a) => a.isNotice).length;
console.log(
  `[gen-seed] 已生成 ${ACTIVITIES.length} 条信息（其中补充通知 ${noticeCount} 条） → cloud-functions/_lib/seed.js`
);
