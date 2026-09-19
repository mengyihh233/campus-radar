/**
 * _lib/audit.js — 操作审计日志
 *
 * 每一次审核、发布、下架、举报处理都留痕。
 * 校园信息平台一旦允许开放投稿，就必须回答「这条内容是谁放进来的、谁批准的」。
 */

import { KEYS, PREFIX, setJSON, listJSON } from './store.js';

export const ACTIONS = {
  USER_REGISTER: 'user.register',
  USER_LOGIN: 'user.login',
  POST_SUBMIT: 'post.submit',
  POST_APPROVE: 'post.approve',
  POST_REJECT: 'post.reject',
  POST_NEEDS_INFO: 'post.needs_info',
  POST_REMOVE: 'post.remove',
  POST_RESTORE: 'post.restore',
  POST_UPDATE: 'post.update',
  REPORT_SUBMIT: 'report.submit',
  REPORT_RESOLVE: 'report.resolve',
  SEED_INIT: 'system.seed',
};

export const ACTION_LABELS = {
  'user.register': '注册账号',
  'user.login': '登录',
  'post.submit': '提交投稿',
  'post.approve': '审核通过',
  'post.reject': '驳回投稿',
  'post.needs_info': '要求补充材料',
  'post.remove': '下架内容',
  'post.restore': '恢复上架',
  'post.update': '修改内容',
  'report.submit': '提交举报',
  'report.resolve': '处理举报',
  'system.seed': '初始化内置数据',
};

/** 写入一条审计记录 */
export async function logAudit({ actor, action, target, detail, meta }) {
  const now = Date.now();
  const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  const entry = {
    id,
    at: now,
    actorId: actor?.id || 'system',
    actorName: actor?.displayName || actor?.username || '系统',
    actorRole: actor?.role || 'system',
    action,
    actionLabel: ACTION_LABELS[action] || action,
    target: target || null,
    detail: detail || '',
    meta: meta || null,
  };

  try {
    await setJSON(KEYS.audit(id), entry);
  } catch {
    // 审计写入失败不应阻断主流程
  }
  return entry;
}

/** 读取审计日志，最新在前 */
export async function listAudit(limit = 120) {
  const rows = await listJSON(PREFIX.audit);
  rows.sort((a, b) => b.at - a.at);
  return rows.slice(0, limit);
}
