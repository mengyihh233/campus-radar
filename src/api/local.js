/**
 * api/local.js — 纯静态模式的数据层
 *
 * 本应用既支持「前端 + 远端后端」，也支持「纯静态托管」两种运行方式。
 * 纯静态模式下，这一层用 localStorage 实现与远端后端完全相同的接口契约：
 * 多角色权限、投稿审核、举报闭环、收藏、审计日志一应俱全。
 *
 * 设计约束与取舍：
 *   1. 接口形状与远端实现严格一致，因此视图层无需感知运行模式。
 *   2. 密码同样使用 PBKDF2-SHA256 派生后存储，不落明文 —— 但必须清楚：
 *      纯前端环境无法阻止使用者读取自己的 localStorage，
 *      这里的目标是「不制造额外的明文泄露面」，而不是提供真正的服务端安全。
 *   3. 数据只保存在当前浏览器。换浏览器 / 清缓存即回到初始状态，
 *      这对于演示与单机使用是合理的，但不适合真实的多用户协作。
 */

import { ACTIVITIES } from '../data/activities.js';
import { evaluateSubmission } from '../core/scan.js';
import { evalCan, PERMISSION_MAP, ALL_PERMISSIONS } from '../data/permissions.js';
import { REPORT_REASONS } from '../data/taxonomy.js';
import { ApiError } from './error.js';

const DB_KEY = 'campus-radar.db.v1';
const SESSION_KEY = 'campus-radar.token';
const PBKDF2_ITERATIONS = 100000;

/** 演示账号：让评审可以立刻进入两种角色观察审核闭环 */
const DEMO_ACCOUNTS = [
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

/* ==========================================================================
 * 基础工具
 * ========================================================================== */

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Web Crypto 只在安全上下文中可用（https、localhost、file://）。
 * 若不可用则给出可执行的指引，而不是抛一个用户看不懂的 TypeError。
 */
function requireWebCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new ApiError(
      '当前环境不支持 Web Crypto，无法安全处理密码。请通过 https 或 http://localhost 访问本页面。',
      { status: 0, code: 'NO_WEBCRYPTO' }
    );
  }
  return subtle;
}

async function hashPassword(password, salt) {
  const subtle = requireWebCrypto();
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256
  );
  return toHex(bits);
}

function randomId(bytes = 16) {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    // 极老的浏览器兜底：仅用于生成非敏感的会话标识
    return Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join(
      ''
    );
  }
  const buffer = new Uint8Array(bytes);
  source.getRandomValues(buffer);
  return toHex(buffer);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function resolveAuthorName(item) {
  if (item.publisher) return item.publisher;
  if (item.source === 'student') return '同学发布';
  if (item.source === 'college') return '学院';
  return '校方';
}

/* ==========================================================================
 * 数据库
 * ========================================================================== */

let cache = null;

async function buildUser({ username, password, role, displayName, org }) {
  const salt = randomId(16);
  return {
    id: `u_${randomId(8)}`,
    username,
    displayName: displayName || username,
    role,
    org: org || null,
    salt,
    passwordHash: await hashPassword(password, salt),
    status: 'active',
    createdAt: Date.now(),
  };
}

async function createSeedDatabase() {
  const users = [];
  for (const account of DEMO_ACCOUNTS) {
    users.push(await buildUser(account));
  }

  const baseTime = new Date('2026-09-19T08:00:00').getTime();
  const activities = ACTIVITIES.map((item) => ({
    ...item,
    origin: 'seed',
    reviewStatus: 'approved',
    authorId: null,
    authorName: resolveAuthorName(item),
    authorRole: item.source === 'student' ? 'student' : 'school',
    createdAt: baseTime + (item.addedAt || 0) * 1000,
    reviewedAt: baseTime,
    reviewedBy: 'system',
    reviewerName: '系统',
    reviewNote: '',
    reviewCheck: null,
  }));

  return {
    version: 1,
    activities,
    users,
    sessions: {},
    favorites: {},
    reports: [],
    audit: [
      {
        id: `audit-seed`,
        at: baseTime,
        actorId: 'system',
        actorName: '系统',
        actorRole: 'system',
        action: 'system.seed',
        actionLabel: '初始化内置数据',
        target: null,
        detail: `载入 ${activities.length} 条内置校园信息与 ${users.length} 个演示账号`,
        meta: null,
      },
    ],
  };
}

async function getDb() {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.activities) && Array.isArray(parsed.users)) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    // 数据损坏或不可访问时重建
  }

  cache = await createSeedDatabase();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (error) {
    // 容量超限或隐私模式：数据将只存在于内存中，本次会话仍可正常使用
    console.warn('[campus-radar] 本地存储写入失败，本次会话数据不会持久化', error);
  }
}

/** 把内存数据库重置为初始状态 */
export async function resetLocalDatabase() {
  cache = await createSeedDatabase();
  persist();
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 忽略 */
  }
}

/* ==========================================================================
 * 会话
 * ========================================================================== */

function readToken() {
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

async function currentUser(db) {
  const token = readToken();
  if (!token) return null;

  const session = db.sessions[token];
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) {
    delete db.sessions[token];
    persist();
    return null;
  }

  const user = db.users.find((u) => u.id === session.uid && u.status === 'active');
  if (!user) return null;
  return { ...publicUser(user), token };
}

function publicUser(user) {
  if (!user) return null;
  const { salt, passwordHash, ...rest } = user;
  return rest;
}

function requireUser(viewer) {
  if (!viewer) {
    throw new ApiError('请先登录后再进行此操作', { status: 401, code: 'UNAUTHORIZED' });
  }
  return viewer;
}

function requirePermission(viewer, permission) {
  const user = requireUser(viewer);
  if (!evalCan(user.role, permission)) {
    throw new ApiError('当前身份没有执行该操作的权限', { status: 403, code: 'FORBIDDEN' });
  }
  return user;
}

/** 按权限矩阵整理前端需要的布尔值 */
function permissionFlags(role) {
  const flags = {};
  const mapping = {
    useList: 'use:list',
    submitPost: 'submit:post',
    submitReport: 'submit:report',
    reviewQueue: 'review:queue',
    reviewDecide: 'review:decide',
    publishOfficial: 'publish:official',
    moderateRemove: 'moderate:remove',
    viewAudit: 'view:audit',
    viewDashboard: 'view:dashboard',
  };
  for (const [key, permission] of Object.entries(mapping)) {
    flags[key] = evalCan(role, permission);
  }
  return flags;
}

/* ==========================================================================
 * 统计
 * ========================================================================== */

function buildStats(activities, reports) {
  const byReview = {};
  const bySource = {};
  const byRisk = {};
  const byCategory = {};

  for (const item of activities) {
    byReview[item.reviewStatus] = (byReview[item.reviewStatus] || 0) + 1;
    bySource[item.source] = (bySource[item.source] || 0) + 1;
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    const risk = item.riskLevel || 'none';
    byRisk[risk] = (byRisk[risk] || 0) + 1;
  }

  const reportByStatus = {};
  for (const r of reports) {
    reportByStatus[r.status] = (reportByStatus[r.status] || 0) + 1;
  }

  const userPosts = activities.filter((a) => a.origin === 'user');
  const decided = userPosts.filter((a) =>
    ['approved', 'rejected', 'removed', 'needs_info'].includes(a.reviewStatus)
  );
  const approvedUserPosts = userPosts.filter((a) => a.reviewStatus === 'approved');

  return {
    total: activities.length,
    seedCount: activities.length - userPosts.length,
    userPostCount: userPosts.length,
    byReview,
    bySource,
    byRisk,
    byCategory,
    reportByStatus,
    reportsPending: reportByStatus.pending || 0,
    approvalRate: decided.length
      ? Math.round((approvedUserPosts.length / decided.length) * 100)
      : null,
  };
}

/* ==========================================================================
 * 审计
 * ========================================================================== */

const ACTION_LABELS = {
  'user.register': '注册账号',
  'user.login': '登录',
  'post.submit': '提交投稿',
  'post.approve': '审核通过',
  'post.reject': '驳回投稿',
  'post.needs_info': '要求补充材料',
  'post.remove': '下架内容',
  'post.restore': '恢复上架',
  'post.update': '修改内容',
  'post.delete': '删除投稿',
  'report.submit': '提交举报',
  'report.resolve': '处理举报',
  'system.seed': '初始化内置数据',
};

function logAudit(db, { actor, action, target, detail, meta }) {
  db.audit.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    actorId: actor?.id || 'system',
    actorName: actor?.displayName || actor?.username || '系统',
    actorRole: actor?.role || 'system',
    action,
    actionLabel: ACTION_LABELS[action] || action,
    target: target || null,
    detail: detail || '',
    meta: meta || null,
  });
  if (db.audit.length > 400) db.audit.length = 400;
}

/* ==========================================================================
 * 对外接口
 * ========================================================================== */

export const localApi = {
  /* ---------------------------------------------------------------- 首屏 */
  async bootstrap() {
    const db = await getDb();
    const me = await currentUser(db);
    const role = me ? me.role : 'guest';

    const isReviewer = evalCan(role, 'review:queue');
    const isAuditor = evalCan(role, 'view:audit');

    const activities = db.activities.filter((item) => {
      if (item.reviewStatus === 'approved') return true;
      if (!me) return false;
      if (me.role === 'admin') return true;
      return item.authorId === me.id;
    });

    const reports = isReviewer ? db.reports : db.reports.filter((r) => r.reporterId === me?.id);

    return {
      ok: true,
      viewer: me,
      role,
      permissions: permissionFlags(role),
      activities,
      favorites: me ? db.favorites[me.id] || [] : [],
      reports,
      audit: isAuditor ? db.audit.slice(0, 100) : [],
      stats: evalCan(role, 'view:dashboard') ? buildStats(db.activities, db.reports) : null,
      demoAccounts: me ? null : DEMO_ACCOUNTS.map((a) => ({ ...a })),
      serverTime: Date.now(),
      mode: 'local',
    };
  },

  /* ---------------------------------------------------------------- 身份 */
  async login(username, password) {
    const db = await getDb();
    const name = String(username || '').trim();
    const pass = String(password || '');

    const user = db.users.find(
      (u) => String(u.username).toLowerCase() === name.toLowerCase()
    );

    if (!user) {
      throw new ApiError('用户名或密码不正确', { status: 401, code: 'BAD_CREDENTIALS' });
    }

    const hash = await hashPassword(pass, user.salt);
    if (!timingSafeEqual(hash, user.passwordHash)) {
      throw new ApiError('用户名或密码不正确', { status: 401, code: 'BAD_CREDENTIALS' });
    }

    const token = randomId(32);
    db.sessions[token] = {
      token,
      uid: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
    };

    logAudit(db, {
      actor: user,
      action: 'user.login',
      detail: `登录成功（${user.role === 'admin' ? '管理端' : '学生端'}）`,
    });

    persist();
    try {
      localStorage.setItem(SESSION_KEY, token);
    } catch {
      /* 隐私模式下降级为内存会话 */
    }

    return { ok: true, token, viewer: publicUser(user) };
  },

  async register({ username, password, displayName, adminCode }) {
    const db = await getDb();
    const name = String(username || '').trim();
    const pass = String(password || '');

    if (!/^[A-Za-z0-9_\u4e00-\u9fa5]{2,20}$/.test(name)) {
      throw new ApiError('用户名需为 2—20 位中文、字母、数字或下划线', { status: 400 });
    }
    if (pass.length < 6) {
      throw new ApiError('密码至少需要 6 位', { status: 400 });
    }
    if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
      throw new ApiError('该用户名已被注册，请换一个或直接登录', { status: 409 });
    }

    let role = 'student';
    const code = String(adminCode || '').trim();
    if (code) {
      if (code !== 'RADAR-ADMIN') {
        throw new ApiError('管理员邀请码不正确', { status: 403 });
      }
      role = 'admin';
    }

    const user = await buildUser({
      username: name,
      password: pass,
      role,
      displayName: displayName || name,
    });
    db.users.push(user);

    const token = randomId(32);
    db.sessions[token] = {
      token,
      uid: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
    };

    logAudit(db, {
      actor: publicUser(user),
      action: 'user.register',
      detail: `注册新账号（${role === 'admin' ? '管理端' : '学生端'}）`,
    });

    persist();
    try {
      localStorage.setItem(SESSION_KEY, token);
    } catch {
      /* 忽略 */
    }

    return { ok: true, token, viewer: publicUser(user) };
  },

  async logout() {
    const db = await getDb();
    const token = readToken();
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      persist();
    }
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* 忽略 */
    }
    return { ok: true, loggedOut: true };
  },

  /* ---------------------------------------------------------------- 投稿 */
  async createPost(payload) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requirePermission(me, 'submit:post');

    const title = String(payload.title || '').trim().slice(0, 60);
    if (!title) throw new ApiError('请填写活动名称', { status: 400 });

    const normalized = normalizePayload(payload);
    const existing = db.activities.filter((a) => a.origin === 'user' || true);
    const check = evaluateSubmission(normalized, { existing });

    const isAdmin = user.role === 'admin';

    // 与远端后端保持同样的门禁：命中高危特征直接拒绝
    if (check.blocker && !isAdmin) {
      throw new ApiError('内容包含高风险特征，已阻止提交，请根据提示修改后再试', {
        status: 422,
        code: 'RISKY_CONTENT',
        payload: { check },
      });
    }

    const targetSource = isAdmin
      ? payload.source === 'college'
        ? 'college'
        : 'school'
      : 'student';

    const now = Date.now();
    const record = {
      id: `p_${randomId(8)}`,
      ...normalized,
      origin: 'user',
      source: targetSource,
      publisher: isAdmin ? String(payload.publisher || user.org || '校方').slice(0, 30) : null,
      authorId: user.id,
      authorName: user.displayName || user.username,
      authorRole: user.role,
      authorOrg: user.org || null,
      createdAt: now,
      reviewStatus: isAdmin ? 'approved' : 'pending',
      reviewedAt: isAdmin ? now : null,
      reviewedBy: isAdmin ? user.id : null,
      reviewerName: isAdmin ? user.displayName || user.username : null,
      reviewNote: '',
      reviewCheck: check,
      riskLevel: check.risks.some((r) => r.severity === 'danger')
        ? 'danger'
        : check.risks.some((r) => r.severity === 'warn')
          ? 'warn'
          : null,
      riskFlags: check.risks.map((r) => r.label),
      missing: check.missing,
      notices: [],
      changeLog: [],
      addedAt: now,
    };

    db.activities.push(record);

    logAudit(db, {
      actor: user,
      action: 'post.submit',
      target: { type: 'activity', id: record.id, title: record.title },
      detail: isAdmin
        ? `以${targetSource === 'college' ? '学院' : '校方'}身份直接发布`
        : '提交投稿，等待审核',
      meta: { score: check.score, risks: check.risks.length, duplicates: check.duplicates.length },
    });

    persist();
    return { ok: true, item: record, check };
  },

  async updatePost(id, payload) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requireUser(me);

    const item = db.activities.find((a) => a.id === id);
    if (!item) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    const isAdmin = user.role === 'admin';
    if (item.authorId !== user.id && !isAdmin) {
      throw new ApiError('当前身份没有执行该操作的权限', { status: 403 });
    }
    if (!isAdmin && !['pending', 'needs_info', 'rejected'].includes(item.reviewStatus)) {
      throw new ApiError('已上架的信息不能由发布者直接改动，请联系管理员下架后再修改', {
        status: 400,
      });
    }

    const patch = normalizePayload(payload, true);
    Object.assign(item, patch);

    const existing = db.activities.filter((a) => a.id !== id);
    const check = evaluateSubmission(item, { existing });

    if (check.blocker && !isAdmin) {
      throw new ApiError('修改后的内容仍包含高风险特征，请调整后再提交', {
        status: 422,
        code: 'RISKY_CONTENT',
        payload: { check },
      });
    }

    item.authorEditedAt = Date.now();
    item.reviewCheck = check;
    item.missing = check.missing;
    item.riskLevel = check.risks.some((r) => r.severity === 'danger')
      ? 'danger'
      : check.risks.some((r) => r.severity === 'warn')
        ? 'warn'
        : null;
    item.riskFlags = check.risks.map((r) => r.label);

    if (!isAdmin) {
      item.reviewStatus = 'pending';
      item.reviewNote = '';
    }

    logAudit(db, {
      actor: user,
      action: 'post.update',
      target: { type: 'activity', id, title: item.title },
      detail: '修改后重新提交审核',
    });

    persist();
    return { ok: true, item, check };
  },

  async reviewPost(id, action, note) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requirePermission(me, 'review:decide');

    const item = db.activities.find((a) => a.id === id);
    if (!item) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    const transitions = {
      approve: { status: 'approved', audit: 'post.approve', needNote: false, label: '通过审核' },
      reject: { status: 'rejected', audit: 'post.reject', needNote: true, label: '驳回' },
      needs_info: {
        status: 'needs_info',
        audit: 'post.needs_info',
        needNote: true,
        label: '要求补充材料',
      },
      remove: { status: 'removed', audit: 'post.remove', needNote: true, label: '下架' },
      restore: { status: 'approved', audit: 'post.restore', needNote: false, label: '恢复上架' },
    };

    const transition = transitions[action];
    if (!transition) throw new ApiError('未知的操作类型', { status: 400 });

    if ((action === 'remove' || action === 'restore') && !evalCan(user.role, 'moderate:remove')) {
      throw new ApiError('当前身份没有执行该操作的权限', { status: 403 });
    }

    if (item.authorId && item.authorId === user.id && item.origin === 'user') {
      throw new ApiError('不能审核自己提交的内容', { status: 403 });
    }

    const reviewNote = String(note || '').trim().slice(0, 300);
    if (transition.needNote && !reviewNote) {
      throw new ApiError(`「${transition.label}」需要填写理由，便于发布者理解原因`, { status: 400 });
    }

    item.reviewStatus = transition.status;
    item.reviewedAt = Date.now();
    item.reviewedBy = user.id;
    item.reviewerName = user.displayName || user.username;
    item.reviewNote = reviewNote;

    // 内容被处理时，关联的待处理举报一并结案
    for (const report of db.reports) {
      if (report.activityId === id && report.status === 'pending') {
        report.status = 'resolved';
        report.resolvedAt = Date.now();
        report.resolvedBy = user.id;
        report.resolverName = user.displayName || user.username;
      }
    }

    logAudit(db, {
      actor: user,
      action: transition.audit,
      target: { type: 'activity', id, title: item.title },
      detail: reviewNote || transition.label,
    });

    persist();
    return { ok: true, item };
  },

  async deletePost(id) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requireUser(me);

    const index = db.activities.findIndex((a) => a.id === id);
    if (index === -1) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    const item = db.activities[index];
    const isAdmin = user.role === 'admin';

    if (item.authorId !== user.id && !isAdmin) {
      throw new ApiError('当前身份没有执行该操作的权限', { status: 403 });
    }
    if (!isAdmin && !['pending', 'needs_info', 'rejected'].includes(item.reviewStatus)) {
      throw new ApiError('已上架的信息无法直接删除，请先联系管理员下架', { status: 400 });
    }

    db.activities.splice(index, 1);

    logAudit(db, {
      actor: user,
      action: 'post.delete',
      target: { type: 'activity', id, title: item.title },
      detail: isAdmin ? '管理员删除内容' : '发布者删除自己的投稿',
    });

    persist();
    return { ok: true, removed: id };
  },

  /* ---------------------------------------------------------------- 收藏 */
  async toggleFavorite(id) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requirePermission(me, 'use:list');

    const target = db.activities.find((a) => a.id === id);
    if (!target) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    const visible =
      target.reviewStatus === 'approved' || target.authorId === user.id || user.role === 'admin';
    if (!visible) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    const list = db.favorites[user.id] || [];
    const exists = list.includes(id);
    const ids = exists ? list.filter((x) => x !== id) : [id, ...list];
    db.favorites[user.id] = ids;

    persist();
    return { ok: true, ids, favorited: !exists };
  },

  /* ---------------------------------------------------------------- 举报 */
  async submitReport({ activityId, reason, detail }) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requirePermission(me, 'submit:report');

    const target = db.activities.find((a) => a.id === activityId);
    if (!target) throw new ApiError('该信息不存在', { status: 404, code: 'NOT_FOUND' });

    if (!REPORT_REASONS.some((r) => r.key === reason)) {
      throw new ApiError('请选择举报原因', { status: 400 });
    }

    const duplicated = db.reports.find(
      (r) => r.activityId === activityId && r.reporterId === user.id && r.status === 'pending'
    );
    if (duplicated) {
      throw new ApiError('你已经举报过这条信息，管理员正在处理中', { status: 409 });
    }

    const reasonMeta = REPORT_REASONS.find((r) => r.key === reason);
    const record = {
      id: `r_${randomId(8)}`,
      activityId,
      activityTitle: target.title,
      activitySource: target.source,
      reason,
      reasonLabel: reasonMeta.label,
      detail: String(detail || '').trim().slice(0, 200),
      reporterId: user.id,
      reporterName: user.displayName || user.username,
      reporterRole: user.role,
      status: 'pending',
      createdAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null,
      resolverName: null,
      resolveNote: '',
    };

    db.reports.push(record);

    logAudit(db, {
      actor: user,
      action: 'report.submit',
      target: { type: 'activity', id: activityId, title: target.title },
      detail: `举报原因：${record.reasonLabel}`,
    });

    persist();
    return { ok: true, report: record };
  },

  async resolveReport({ id, action, note }) {
    const db = await getDb();
    const me = await currentUser(db);
    const user = requirePermission(me, 'review:decide');
    if (!['resolve', 'dismiss'].includes(action)) {
      throw new ApiError('未知的处理动作', { status: 400 });
    }

    const report = db.reports.find((r) => r.id === id);
    if (!report) throw new ApiError('该举报不存在', { status: 404, code: 'NOT_FOUND' });

    report.status = action === 'resolve' ? 'resolved' : 'dismissed';
    report.resolvedAt = Date.now();
    report.resolvedBy = user.id;
    report.resolverName = user.displayName || user.username;
    report.resolveNote = String(note || '').trim().slice(0, 200);

    logAudit(db, {
      actor: user,
      action: 'report.resolve',
      target: { type: 'report', id, title: report.activityTitle },
      detail: action === 'resolve' ? '举报成立，已处理' : '举报不成立，已忽略',
    });

    persist();
    return { ok: true, report };
  },

  /** 管理端读取举报队列 */
  async loadReports() {
    const db = await getDb();
    const me = await currentUser(db);
    requirePermission(me, 'review:queue');

    const reports = [...db.reports].sort((a, b) => b.createdAt - a.createdAt);
    return {
      ok: true,
      reports,
      pending: reports.filter((r) => r.status === 'pending').length,
    };
  },
};

/* ==========================================================================
 * 载荷整理（与远端后端保持一致）
 * ========================================================================== */

function isoOrNull(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 16);
}

function normalizePayload(payload, isPatch = false) {
  const text = (v, max = 300) => String(v ?? '').trim().slice(0, max);

  const result = {
    title: text(payload.title, 60),
    category: payload.category || 'other',
    summary: text(payload.summary, 400),
    start: isoOrNull(payload.start),
    end: isoOrNull(payload.end),
    timeText: text(payload.timeText, 80) || null,
    recurrence: text(payload.recurrence, 80) || null,
    place: text(payload.place, 60),
    deadline: isoOrNull(payload.deadline),
    deadlineText: text(payload.deadlineText, 80) || null,
    audience: payload.audience || 'all',
    audienceText: text(payload.audienceText, 60) || null,
    requirement: text(payload.requirement, 200),
    commitment: text(payload.commitment, 60) || null,
    capacity: Number.isFinite(Number(payload.capacity)) && Number(payload.capacity) > 0
      ? Math.floor(Number(payload.capacity))
      : null,
    contact: text(payload.contact, 120) || null,
    raw: text(payload.raw, 800) || null,
  };

  if (isPatch) {
    for (const key of Object.keys(result)) {
      if (payload[key] === undefined) delete result[key];
    }
  }

  return result;
}

/** 供 UI 展示「当前运行模式」 */
export const LOCAL_MODE_INFO = {
  mode: 'local',
  label: '本机演示模式',
  description:
    '数据保存在当前浏览器的本地存储中，不需要服务器。账号、投稿、审核、举报功能完整可用，但数据不会跨设备同步。',
};

export { ALL_PERMISSIONS, PERMISSION_MAP, DEMO_ACCOUNTS };
