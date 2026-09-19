/**
 * GET /api/bootstrap
 *
 * 单次请求完成首屏所需的全部数据，避免前端多次往返：
 *   - 内置信息与用户发布（按当前身份过滤可见性）
 *   - 当前登录者与角色
 *   - 我的收藏
 *   - 举报（管理员看全部，学生看自己提交的）
 *   - 审计日志与看板统计（仅管理员）
 *   - 演示账号（仅未登录时返回，供评审快速切换身份）
 */

import { ok, handleError, preflight } from '../_lib/http.js';
import { ensureSeeded, DEMO_ACCOUNTS } from '../_lib/bootstrap.js';
import { PREFIX, KEYS, listJSON, getJSON } from '../_lib/store.js';
import { currentUser, can, publicUser } from '../_lib/auth.js';
import { listAudit } from '../_lib/audit.js';

/** 计算管理端看板统计 */
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
    // 投稿通过率：已处理完毕的投稿中通过的比例
    approvalRate: decided.length ? Math.round((approvedUserPosts.length / decided.length) * 100) : null,
  };
}

export async function onRequestGet(context) {
  try {
    await ensureSeeded();

    const { request } = context;
    const me = await currentUser(request);
    const role = me ? me.role : 'guest';

    const isReviewer = can(role, 'review:queue');
    const isAuditor = can(role, 'view:audit');

    const [activities, reports, audit, favoritesDoc] = await Promise.all([
      listJSON(PREFIX.activities),
      isReviewer ? listJSON(PREFIX.reports) : Promise.resolve([]),
      isAuditor ? listAudit(100) : Promise.resolve([]),
      me ? getJSON(KEYS.favorites(me.id), null) : Promise.resolve(null),
    ]);

    // 收藏在存储里是 { ids, updatedAt } 文档，对外统一降级成 id 数组，
    // 避免前端需要理解存储结构（这里曾经因为契约不一致出过一次 bug）
    const favorites =
      favoritesDoc && Array.isArray(favoritesDoc.ids) ? favoritesDoc.ids : [];

    /* ---- 可见性过滤：上架信息人人可见；未上架的只对作者与管理员可见 ---- */
    const visible = activities.filter((item) => {
      if (item.reviewStatus === 'approved') return true;
      if (!me) return false;
      if (me.role === 'admin') return true;
      return item.authorId === me.id;
    });

    /* ---- 举报：管理员看全部，学生只看自己提交的 ---- */
    const visibleReports = isReviewer
      ? reports
      : reports.filter((r) => r.reporterId === me?.id);

    /* ---- 演示账号仅在未登录时下发 ---- */
    const demoAccounts = me
      ? null
      : DEMO_ACCOUNTS.map((a) => ({
          username: a.username,
          password: a.password,
          role: a.role,
          displayName: a.displayName,
        }));

    return ok({
      viewer: me || null,
      role,
      permissions: {
        useList: can(role, 'use:list'),
        submitPost: can(role, 'submit:post'),
        submitReport: can(role, 'submit:report'),
        reviewQueue: isReviewer,
        reviewDecide: can(role, 'review:decide'),
        publishOfficial: can(role, 'publish:official'),
        moderateRemove: can(role, 'moderate:remove'),
        viewAudit: isAuditor,
        viewDashboard: can(role, 'view:dashboard'),
      },
      activities: visible,
      favorites,
      reports: visibleReports,
      audit,
      stats: can(role, 'view:dashboard') ? buildStats(activities, reports) : null,
      demoAccounts,
      serverTime: Date.now(),
    });
  } catch (error) {
    return handleError(error);
  }
}

export { preflight as onRequestOptions };
