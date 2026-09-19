/**
 * _lib/auth.js — 身份与会话
 *
 * 密码使用 PBKDF2-SHA256（10 万次迭代，每用户独立 salt）派生后存储，不落明文。
 * 会话为服务端 token，存于 Blob，带过期时间。
 *
 * 说明：这是面向校园场景的轻量实现，不依赖第三方鉴权服务。
 * 生产环境还应补充：登录失败限流、二次验证、HTTPS 强制、密码复杂度策略。
 */

import { KEYS, PREFIX, getJSON, setJSON, remove, listJSON } from './store.js';

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14; // 14 天

/* --------------------------------------------------------------------------
 * 权限矩阵（与前端 taxonomy 保持一致）
 * ------------------------------------------------------------------------ */
const PERMISSIONS = {
  'browse:public': ['guest', 'student', 'admin'],
  'use:list': ['student', 'admin'],
  'submit:post': ['student', 'admin'],
  'submit:report': ['student', 'admin'],
  'review:queue': ['admin'],
  'review:decide': ['admin'],
  'publish:official': ['admin'],
  'moderate:remove': ['admin'],
  'view:audit': ['admin'],
  'view:dashboard': ['admin'],
  'view:own-submissions': ['student', 'admin'],
};

export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

/* --------------------------------------------------------------------------
 * 基础工具
 * ------------------------------------------------------------------------ */

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 密码哈希：PBKDF2-SHA256 */
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256
  );
  return toHex(bits);
}

/** 恒定时间比较，避免通过响应时间推断哈希 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 加密安全随机串 */
export function randomId(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

/* --------------------------------------------------------------------------
 * 用户
 * ------------------------------------------------------------------------ */

export const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{2,20}$/;

export async function findUserByName(username) {
  if (!username) return null;
  const users = await listJSON(PREFIX.users);
  const lower = String(username).toLowerCase();
  return users.find((u) => String(u.username).toLowerCase() === lower) || null;
}

export async function findUserById(uid) {
  if (!uid) return null;
  return getJSON(KEYS.user(uid));
}

export async function createUser({ username, password, role = 'student', displayName, org }) {
  const salt = randomId(16);
  const user = {
    id: `u_${randomId(8)}`,
    username: String(username).trim(),
    displayName: String(displayName || username).trim().slice(0, 24),
    role,
    org: org || null,
    salt,
    passwordHash: await hashPassword(password, salt),
    status: 'active',
    createdAt: Date.now(),
  };
  await setJSON(KEYS.user(user.id), user);
  return user;
}

export async function verifyPassword(user, password) {
  if (!user || !user.salt || !user.passwordHash) return false;
  const hash = await hashPassword(password, user.salt);
  return timingSafeEqual(hash, user.passwordHash);
}

/** 移除敏感字段后返回给前端 */
export function publicUser(user) {
  if (!user) return null;
  const { salt, passwordHash, ...rest } = user;
  return rest;
}

/* --------------------------------------------------------------------------
 * 会话
 * ------------------------------------------------------------------------ */

export async function createSession(user) {
  const token = randomId(32);
  const now = Date.now();
  const session = {
    token,
    uid: user.id,
    username: user.username,
    role: user.role,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  };
  await setJSON(KEYS.session(token), session);
  return session;
}

export async function destroySession(token) {
  if (token) await remove(KEYS.session(token));
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/** 从请求解析当前用户，未登录返回 null */
export async function currentUser(request) {
  const token = bearerToken(request);
  if (!token) return null;

  const session = await getJSON(KEYS.session(token));
  if (!session) return null;

  if (session.expiresAt && session.expiresAt < Date.now()) {
    await remove(KEYS.session(token));
    return null;
  }

  const user = await findUserById(session.uid);
  if (!user || user.status !== 'active') return null;

  return { ...publicUser(user), token };
}

/** 要求已登录，否则抛出可用于响应的错误标记 */
export async function requireUser(request) {
  const user = await currentUser(request);
  if (!user) {
    const err = new Error('UNAUTHORIZED');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return user;
}

/** 要求具备某权限 */
export async function requirePermission(request, permission) {
  const user = await requireUser(request);
  const role = user.role || 'student';
  if (!can(role, permission)) {
    const err = new Error('FORBIDDEN');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return user;
}
