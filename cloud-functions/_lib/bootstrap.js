/**
 * _lib/bootstrap.js — 首次访问时的数据播种
 *
 * 内置的 26 条校园信息与两个演示账号在第一次请求时自动写入 Blob，
 * 之后由 meta/seeded 标记跳过。播种是幂等的，并发重复执行结果一致。
 */

import { KEYS, setJSON, getJSON } from './store.js';
import { SEED_ACTIVITIES, SEED_VERSION, SEED_BASE_TIME } from './seed.js';
import { createUser, findUserByName } from './auth.js';
import { logAudit, ACTIONS } from './audit.js';

/**
 * 演示账号。真实部署时应删除或改密；
 * 这里保留是为了让评审可以立刻进入两种角色，观察审核闭环。
 */
export const DEMO_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    displayName: '校方管理员',
    org: '学生工作处',
  },
  {
    username: 'student',
    password: 'student123',
    role: 'student',
    displayName: '2026级新生',
    org: '计算机学院',
  },
];

/** 判断内置信息对应的发布者署名 */
function resolveAuthorName(item) {
  if (item.publisher) return item.publisher;
  if (item.source === 'student') return '同学发布';
  if (item.source === 'college') return '学院';
  return '校方';
}

/**
 * 确保内置数据已写入。
 * @returns {Promise<boolean>} 本次是否执行了播种
 */
export async function ensureSeeded() {
  const flag = await getJSON(KEYS.meta('seeded'));
  if (flag && Number(flag.version) >= SEED_VERSION) return false;

  // 1. 写入内置信息
  await Promise.all(
    SEED_ACTIVITIES.map((item) => {
      const record = {
        ...item,
        origin: 'seed',
        reviewStatus: 'approved',
        authorId: null,
        authorName: resolveAuthorName(item),
        authorRole: item.source === 'student' ? 'student' : 'school',
        createdAt: SEED_BASE_TIME + (item.addedAt || 0) * 1000,
        reviewedAt: SEED_BASE_TIME,
        reviewedBy: 'system',
        reviewNote: '',
        reviewCheck: null,
      };
      return setJSON(KEYS.activity(record.id), record);
    })
  );

  // 2. 写入演示账号
  for (const account of DEMO_ACCOUNTS) {
    const exists = await findUserByName(account.username);
    if (!exists) await createUser(account);
  }

  // 3. 标记完成
  await setJSON(KEYS.meta('seeded'), {
    version: SEED_VERSION,
    at: Date.now(),
    count: SEED_ACTIVITIES.length,
  });

  await logAudit({
    action: ACTIONS.SEED_INIT,
    detail: `初始化 ${SEED_ACTIVITIES.length} 条内置校园信息与 ${DEMO_ACCOUNTS.length} 个演示账号`,
  });

  return true;
}
