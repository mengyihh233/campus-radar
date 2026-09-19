/**
 * POST /api/posts — 提交一条信息
 *
 * 两条发布路径，权限与后面流程完全不同：
 *   学生端 → source 固定为 student，落库即 pending，必须经管理端审核才对外可见
 *   管理端 → 可发布校方/学院级信息，直接 approved 上架，但仍写入审计日志
 *
 * 服务端会独立跑一遍内容扫描（不信任前端预检结果），
 * 命中高危特征直接拒绝入库。
 */

import { ok, fail, readJson, handleError, ERRORS, newId, preflight } from '../_lib/http.js';
import { PREFIX, KEYS, listJSON, setJSON } from '../_lib/store.js';
import { requirePermission, publicUser } from '../_lib/auth.js';
import { evaluateSubmission } from '../_lib/scan.js';
import { logAudit, ACTIONS } from '../_lib/audit.js';
import { AUDIENCES, CATEGORIES } from '../_lib/taxonomy.js';

const MAX = {
  title: 60,
  summary: 400,
  place: 60,
  requirement: 200,
  contact: 120,
  raw: 800,
  note: 300,
};

function text(value, limit = 300) {
  return String(value ?? '').trim().slice(0, limit);
}

/** 只接受合法的日期字符串，非法值降级为 null 而不是写入脏数据 */
function isoOrNull(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 16);
}

function normalize(body) {
  const category = CATEGORIES[body.category] ? body.category : 'other';
  const audience = AUDIENCES[body.audience] ? body.audience : 'all';

  const capacity = Number(body.capacity);

  return {
    title: text(body.title, MAX.title),
    category,
    summary: text(body.summary, MAX.summary),
    start: isoOrNull(body.start),
    end: isoOrNull(body.end),
    timeText: text(body.timeText, 80) || null,
    recurrence: text(body.recurrence, 80) || null,
    place: text(body.place, MAX.place),
    deadline: isoOrNull(body.deadline),
    deadlineText: text(body.deadlineText, 80) || null,
    audience,
    audienceText: text(body.audienceText, 60) || null,
    requirement: text(body.requirement, MAX.requirement),
    commitment: text(body.commitment, 60) || null,
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null,
    contact: text(body.contact, MAX.contact) || null,
    raw: text(body.raw, MAX.raw) || null,
  };
}

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const user = await requirePermission(request, 'submit:post');

    const body = await readJson(request);
    const payload = normalize(body);

    if (!payload.title) return fail('请填写活动名称', 400);

    const existing = await listJSON(PREFIX.activities);
    const check = evaluateSubmission(payload, { existing });

    const isAdmin = user.role === 'admin';

    // 学生投稿命中高危特征：直接拦下，要求先修改
    if (check.blocker && !isAdmin) {
      return fail('内容包含高风险特征，已阻止提交，请根据提示修改后再试', 422, { check });
    }

    // 管理员可选发布到学院层级
    const targetSource = isAdmin
      ? body.source === 'college'
        ? 'college'
        : 'school'
      : 'student';

    const now = Date.now();
    const id = `p_${newId()}`;

    const record = {
      id,
      ...payload,

      origin: 'user',
      source: targetSource,
      publisher: isAdmin ? text(body.publisher, 30) || user.org || '校方' : null,

      authorId: user.id,
      authorName: user.displayName || user.username,
      authorRole: user.role,
      authorOrg: user.org || null,

      createdAt: now,

      // 管理员发布官方信息直接上架；学生投稿一律进入待审核
      reviewStatus: isAdmin ? 'approved' : 'pending',
      reviewedAt: isAdmin ? now : null,
      reviewedBy: isAdmin ? user.id : null,
      reviewerName: isAdmin ? user.displayName || user.username : null,
      reviewNote: '',
      reviewCheck: check,

      // 风险与缺失字段在入库时固化为快照，避免后续规则调整导致历史记录语义漂移
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

    await setJSON(KEYS.activity(id), record);

    await logAudit({
      actor: user,
      action: ACTIONS.POST_SUBMIT,
      target: { type: 'activity', id, title: record.title },
      detail: isAdmin
        ? `以${targetSource === 'college' ? '学院' : '校方'}身份直接发布`
        : '提交投稿，等待审核',
      meta: { score: check.score, risks: check.risks.length, duplicates: check.duplicates.length },
    });

    return ok({ item: record, check }, 201);
  } catch (error) {
    return handleError(error);
  }
}

/** GET /api/posts —— 轻量列表，用于前端局部刷新 */
export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { currentUser } = await import('../_lib/auth.js');
    const me = await currentUser(request);

    const all = await listJSON(PREFIX.activities);
    const visible = all.filter((item) => {
      if (item.reviewStatus === 'approved') return true;
      if (!me) return false;
      if (me.role === 'admin') return true;
      return item.authorId === me.id;
    });

    void publicUser; // 保留给后续扩展：返回作者公开信息
    return ok({ activities: visible, serverTime: Date.now() });
  } catch (error) {
    return handleError(error);
  }
}

export { ERRORS, preflight as onRequestOptions };
