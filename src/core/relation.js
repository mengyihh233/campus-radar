/**
 * relation.js — 信息修订链
 *
 * 校园通知最常见的坑：一条活动发出后又被「补充通知」改期、改地点。
 * 新生看到的是旧版本，按旧信息跑到错的地方。
 *
 * 这里把补充通知合并进主信息，并把变更点显式列出。
 */

/**
 * 建立「被修订」索引：主信息 id → 修订详情
 * @param {Array} activities 全部信息（含补充通知）
 */
export function buildRevisionIndex(activities) {
  const index = new Map();

  for (const item of activities) {
    if (!item.supersededBy) continue;

    // 找到做出修订的那条补充通知
    const notice = activities.find((a) => a.id === item.supersededBy) || null;

    index.set(item.id, {
      noticeId: item.supersededBy,
      noticeTitle: notice?.title || '补充通知',
      noticeRaw: notice?.raw || '',
      changeLog: Array.isArray(item.changeLog) ? item.changeLog : [],
      hasChanges: Array.isArray(item.changeLog) && item.changeLog.length > 0,
    });
  }

  return index;
}

/**
 * 补充通知本身不进入主列表，而是被合并展示。
 * 这里把补充通知挑出来，用于「材料原文」区域的对照展示。
 */
export function splitNotices(activities) {
  const notices = activities.filter((a) => a.isNotice);
  const primary = activities.filter((a) => !a.isNotice);
  return { primary, notices };
}

/** 取某条信息对应的补充通知原文 */
export function findNoticeFor(item, activities) {
  if (!item.supersededBy) return null;
  return activities.find((a) => a.id === item.supersededBy) || null;
}

/**
 * 修订摘要：给卡片用的一句话提示
 */
export function revisionSummary(revision) {
  if (!revision || !revision.hasChanges) return null;
  return {
    label: '已更新',
    detail: `${revision.changeLog.length} 项变更`,
    noticeId: revision.noticeId,
  };
}
