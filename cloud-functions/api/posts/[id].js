/**
 * PATCH /api/posts/:id — 审核决定 / 作者修改 / 下架
 * DELETE /api/posts/:id — 删除投稿
 *
 * 审核动作与权限的对应关系集中在这里，前端按钮的显示与否只是体验，
 * 真正的权限判定发生在服务端。
 */

import { ok, fail, readJson, handleError, ERRORS, preflight } from '../../_lib/http.js';
import { KEYS, getJSON, setJSON, remove, PREFIX, listJSON } from '../../_lib/store.js';
import { requirePermission, requireUser, can } from '../../_lib/auth.js';
import { evaluateSubmission } from '../../_lib/scan.js';
import { logAudit, ACTIONS } from '../../_lib/audit.js';
import { EDITABLE_BY_AUTHOR, DELETABLE_BY_AUTHOR } from '../../_lib/taxonomy.js';

const NOTE_MAX = 300;

function note(value) {
  return String(value ?? '').trim().slice(0, NOTE_MAX);
}

/** 审核类动作 → 目标状态 + 审计动作 */
const REVIEW_TRANSITIONS = {
  approve: { status: 'approved', audit: ACTIONS.POST_APPROVE, requiresNote: false, label: '通过审核' },
  reject: { status: 'rejected', audit: ACTIONS.POST_REJECT, requiresNote: true, label: '驳回' },
  needs_info: {
    status: 'needs_info',
    audit: ACTIONS.POST_NEEDS_INFO,
    requiresNote: true,
    label: '要求补充材料',
  },
  remove: { status: 'removed', audit: ACTIONS.POST_REMOVE, requiresNote: true, label: '下架' },
  restore: { status: 'approved', audit: ACTIONS.POST_RESTORE, requiresNote: false, label: '恢复上架' },
};

export async function onRequestPatch(context) {
  try {
    const { request, params } = context;
    const id = params.id;

    const item = await getJSON(KEYS.activity(id));
    if (!item) return ERRORS.notFound('该信息');

    const body = await readJson(request);
    const action = String(body.action || '');

    /* ================= 审核类动作 ================= */
    if (REVIEW_TRANSITIONS[action]) {
      const transition = REVIEW_TRANSITIONS[action];
      const user = await requirePermission(request, 'review:decide');

      // 下架与恢复属于内容治理，需要单独的权限
      if ((action === 'remove' || action === 'restore') && !can(user.role, 'moderate:remove')) {
        return ERRORS.forbidden();
      }

      // 不能审核自己发布的内容（管理员直接发布走的是另一条路径）
      if (item.authorId && item.authorId === user.id && item.origin === 'user') {
        return fail('不能审核自己提交的内容', 403);
      }

      const reviewNote = note(body.note);
      if (transition.requiresNote && !reviewNote) {
        return fail(`「${transition.label}」需要填写理由，便于发布者理解原因`, 400);
      }

      const now = Date.now();
      const updated = {
        ...item,
        reviewStatus: transition.status,
        reviewedAt: now,
        reviewedBy: user.id,
        reviewerName: user.displayName || user.username,
        reviewNote,
      };

      await setJSON(KEYS.activity(id), updated);

      // 处理关联举报：一旦信息被处理，对应举报自动标记为已处理
      await resolveRelatedReports(id, user, transition.status === 'removed' ? 'resolved' : 'resolved');

      await logAudit({
        actor: user,
        action: transition.audit,
        target: { type: 'activity', id, title: item.title },
        detail: reviewNote || transition.label,
      });

      return ok({ item: updated });
    }

    /* ================= 作者修改并重新提交 ================= */
    if (action === 'update') {
      const user = await requireUser(request);
      const isAdmin = user.role === 'admin';

      if (item.authorId !== user.id && !isAdmin) {
        return ERRORS.forbidden();
      }
      if (!isAdmin && !EDITABLE_BY_AUTHOR.includes(item.reviewStatus)) {
        return fail('已上架的信息不能由发布者直接改动，请联系管理员下架后再修改', 400);
      }

      const wasRejected = ['rejected', 'needs_info'].includes(item.reviewStatus);

      const patch = sanitizePatch(body);
      const merged = { ...item, ...patch };

      const existing = await listJSON(PREFIX.activities);
      const check = evaluateSubmission(merged, {
        existing: existing.filter((a) => a.id !== id),
      });

      if (check.blocker && !isAdmin) {
        return fail('修改后的内容仍包含高风险特征，请调整后再提交', 422, { check });
      }

      const now = Date.now();
      const updated = {
        ...merged,
        authorEditedAt: now,
        reviewCheck: check,
        missing: check.missing,
        riskLevel: check.risks.some((r) => r.severity === 'danger')
          ? 'danger'
          : check.risks.some((r) => r.severity === 'warn')
            ? 'warn'
            : null,
        riskFlags: check.risks.map((r) => r.label),
        // 修改后重新回到待审核队列（管理员除外）
        reviewStatus: isAdmin ? item.reviewStatus : 'pending',
        reviewNote: wasRejected ? '' : item.reviewNote,
      };

      await setJSON(KEYS.activity(id), updated);

      await logAudit({
        actor: user,
        action: ACTIONS.POST_UPDATE,
        target: { type: 'activity', id, title: updated.title },
        detail: '修改后重新提交审核',
      });

      return ok({ item: updated, check });
    }

    return fail('未知的操作类型', 400, { allowed: Object.keys(REVIEW_TRANSITIONS).concat('update') });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestDelete(context) {
  try {
    const { request, params } = context;
    const id = params.id;

    const item = await getJSON(KEYS.activity(id));
    if (!item) return ERRORS.notFound('该信息');

    const user = await requireUser(request);
    const isAdmin = user.role === 'admin';

    if (item.authorId !== user.id && !isAdmin) {
      return ERRORS.forbidden();
    }
    if (!isAdmin && !DELETABLE_BY_AUTHOR.includes(item.reviewStatus)) {
      return fail('已上架的信息无法直接删除，请先联系管理员下架', 400);
    }

    await remove(KEYS.activity(id));

    await logAudit({
      actor: user,
      action: ACTIONS.POST_REMOVE,
      target: { type: 'activity', id, title: item.title },
      detail: isAdmin ? '管理员删除内容' : '发布者删除自己的投稿',
    });

    return ok({ removed: id });
  } catch (error) {
    return handleError(error);
  }
}

/** 只允许修改用户可编辑的字段 */
function sanitizePatch(body) {
  const allowed = [
    'title',
    'category',
    'summary',
    'start',
    'end',
    'timeText',
    'recurrence',
    'place',
    'deadline',
    'deadlineText',
    'audience',
    'audienceText',
    'requirement',
    'commitment',
    'capacity',
    'contact',
    'raw',
  ];
  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  return patch;
}

/** 内容被处理后，把指向它的待处理举报一并结案 */
async function resolveRelatedReports(activityId, user, status) {
  try {
    const reports = await listJSON(PREFIX.reports);
    const related = reports.filter((r) => r.activityId === activityId && r.status === 'pending');
    await Promise.all(
      related.map((r) =>
        setJSON(KEYS.report(r.id), {
          ...r,
          status,
          resolvedAt: Date.now(),
          resolvedBy: user.id,
          resolverName: user.displayName || user.username,
        })
      )
    );
  } catch {
    // 举报联动失败不影响审核主流程
  }
}

export { preflight as onRequestOptions };
