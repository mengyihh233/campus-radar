/**
 * data/permissions.js — 权限矩阵
 *
 * 单独成文件，供数据层（local.js）、字典层（taxonomy.js）与服务端共同引用，
 * 保证「谁能做什么」只有一处定义。
 */

/** 权限 → 允许的角色列表 */
export const PERMISSION_MAP = {
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

export const ALL_PERMISSIONS = Object.keys(PERMISSION_MAP);

/** 判断某个角色是否拥有某权限 */
export function evalCan(role, permission) {
  const allowed = PERMISSION_MAP[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

/** 角色等级，用于「至少需要某级别」这类判断 */
export const ROLE_LEVEL = {
  guest: 0,
  student: 1,
  admin: 2,
};

export function atLeast(role, minimum) {
  return (ROLE_LEVEL[role] ?? -1) >= (ROLE_LEVEL[minimum] ?? 99);
}
