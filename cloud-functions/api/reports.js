/**
 * POST  /api/reports — 学生举报可疑信息，进入管理端处理队列
 * GET   /api/reports — 管理端读取举报列表
 * PATCH /api/reports — 管理端处理举报  body: { id, action: 'resolve'|'dismiss', note? }
 *
 * 举报是「开放投稿」的必要配套：平台允许同学发内容，就必须给同学一个
 * 反馈问题的通道，并让处理过程可追溯。
 */

import { ok, fail, readJson, handleError, ERRORS, newId, preflight } from '../_lib/http.js';
import { KEYS, PREFIX, getJSON, setJSON, listJSON } from '../_lib/store.js';
import { requirePermission, requireUser } from '../_lib/auth.js';
import { logAudit, ACTIONS } from '../_lib/audit.js';
import { REPORT_REASONS } from '../_lib/taxonomy.js';

const DETAIL_MAX = 200;

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const user = await requirePermission(request, 'submit:report');

    const body = await readJson(request);
    const activityId = String(body.activityId || '').trim();
    const reason = String(body.reason || '').trim();
    const detail = String(body.detail || '').trim().slice(0, DETAIL_MAX);

    if (!activityId) return fail('缺少被举报信息的 id', 400);
    if (!REPORT_REASONS[reason]) return fail('请选择举报原因', 400);

    const target = await getJSON(KEYS.activity(activityId), null);
    if (!target) return ERRORS.notFound('该信息');

    // 同一个人对同一条信息只保留一条待处理举报，避免刷队列
    const all = await listJSON(PREFIX.reports);
    const duplicated = all.find(
      (r) => r.activityId === activityId && r.reporterId === user.id && r.status === 'pending'
    );
    if (duplicated) {
      return fail('你已经举报过这条信息，管理员正在处理中', 409);
    }

    const id = `r_${newId()}`;
    const record = {
      id,
      activityId,
      activityTitle: target.title,
      activitySource: target.source,
      reason,
      reasonLabel: REPORT_REASONS[reason],
      detail,
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

    await setJSON(KEYS.report(id), record);

    await logAudit({
      actor: user,
      action: ACTIONS.REPORT_SUBMIT,
      target: { type: 'activity', id: activityId, title: target.title },
      detail: `举报原因：${record.reasonLabel}`,
    });

    return ok({ report: record }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    await requirePermission(request, 'review:queue');

    const reports = await listJSON(PREFIX.reports);
    reports.sort((a, b) => b.createdAt - a.createdAt);

    return ok({
      reports,
      pending: reports.filter((r) => r.status === 'pending').length,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPatch(context) {
  try {
    const { request } = context;
    const user = await requirePermission(request, 'review:decide');

    const body = await readJson(request);
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();

    if (!['resolve', 'dismiss'].includes(action)) {
      return fail('未知的处理动作', 400);
    }

    const report = await getJSON(KEYS.report(id), null);
    if (!report) return ERRORS.notFound('该举报');

    const updated = {
      ...report,
      status: action === 'resolve' ? 'resolved' : 'dismissed',
      resolvedAt: Date.now(),
      resolvedBy: user.id,
      resolverName: user.displayName || user.username,
      resolveNote: String(body.note || '').trim().slice(0, DETAIL_MAX),
    };

    await setJSON(KEYS.report(id), updated);

    await logAudit({
      actor: user,
      action: ACTIONS.REPORT_RESOLVE,
      target: { type: 'report', id, title: report.activityTitle },
      detail: action === 'resolve' ? '举报成立，已处理' : '举报不成立，已忽略',
    });

    return ok({ report: updated });
  } catch (error) {
    return handleError(error);
  }
}

export { requireUser, preflight as onRequestOptions };
