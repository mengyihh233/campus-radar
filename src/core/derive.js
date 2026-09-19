/**
 * core/derive.js — 视图模型
 *
 * 把后端返回的原始记录，加工成界面直接可用的形状：
 * 状态、倒计时、修订链、风险、来源、类别、缺失项。
 * 所有派生字段以 _ 开头，与原始字段区分开。
 */

import {
  resolveStatus,
  timeText,
  statusHint,
  compareByUrgency,
  compareByTime,
  compareByLatest,
  hasMilestoneWithin,
  touchesToday,
  computeStatus,
} from './status.js';
import { buildRevisionIndex } from './relation.js';
import {
  SOURCES,
  CATEGORIES,
  RISK_LEVELS,
  AUDIENCES,
  REVIEW_STATUS,
  isFreshmanEligible,
} from '../data/taxonomy.js';
import { DAY, ts, formatDate, formatClock, dayLabel, countdown } from './time.js';

/* ==========================================================================
 * 装饰
 * ========================================================================== */

export function decorate(item, context) {
  const { now, revisions } = context;
  const status = resolveStatus(item, now);

  return {
    ...item,
    _status: status,
    _statusKey: status.key,
    _revision: revisions.get(item.id) || null,
    _source: SOURCES[item.source] || SOURCES.school,
    _category: CATEGORIES[item.category] || CATEGORIES.other,
    _audience: AUDIENCES[item.audience] || AUDIENCES.all,
    _risk: item.riskLevel ? RISK_LEVELS[item.riskLevel] : null,
    _review: item.reviewStatus ? REVIEW_STATUS[item.reviewStatus] : null,
    _time: timeText(item, now),
    _hint: statusHint(item, status, now),
    _freshmanFriendly: isFreshmanFriendly(item),
    _deadlineCd: item.deadline ? countdown(item.deadline, now, { prefix: false }) : null,
  };
}

export function decorateAll(items, now = Date.now()) {
  const revisions = buildRevisionIndex(items);
  const context = { now, revisions };
  return items.map((item) => decorate(item, context));
}

/* ==========================================================================
 * 新生适配
 * ========================================================================== */

/** 判断一条信息对大一新生是否真正可参与 */
export function isFreshmanFriendly(item) {
  if (item.audience === 'sophomore_plus') return false;
  if (item.audience === 'freshman' || item.audience === 'freshman_soph') return true;
  const text = [item.requirement, item.audienceText, item.summary, item.raw]
    .filter(Boolean)
    .join(' ');
  return /零基础|不限基础|欢迎零基础|面向全校|无需报名|不限专业|不限/.test(text);
}

/** 明确不适合当前身份的原因（用于解释为什么被隐藏） */
export function ineligibleReason(item) {
  if (item.audience === 'sophomore_plus') return '仅限大二及以上学生';
  return null;
}

/* ==========================================================================
 * 快捷筛选谓词
 * ========================================================================== */

const QUICK_PREDICATES = {
  now: (item, ctx) =>
    ['ongoing', 'soon', 'deadline', 'open'].includes(item._statusKey) &&
    isFreshmanEligibleFor(item, ctx),
  urgent: (item, ctx) => hasMilestoneWithin(item, ctx.now, 2 * DAY),
  freshman: (item) => item._freshmanFriendly,
  verified: (item) => item.source !== 'student',
  saved: (item, ctx) => ctx.favorites.includes(item.id),
  today: (item, ctx) => touchesToday(item, ctx.now),
};

function isFreshmanEligibleFor(item, ctx) {
  if (!ctx.freshmanMode) return true;
  return item.audience !== 'sophomore_plus';
}

/* ==========================================================================
 * 筛选与排序
 * ========================================================================== */

function matchesSearch(item, keyword) {
  if (!keyword) return true;
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    item.title,
    item.summary,
    item.place,
    item.requirement,
    item.recurrence,
    item.audienceText,
    item.publisher,
    item.raw,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * 对已装饰的列表应用全部筛选条件。
 * @param {Array} items 已装饰的信息
 * @param {object} ui 界面状态
 * @param {object} ctx { now, favorites }
 */
export function applyFilters(items, ui, ctx) {
  const { filters, search, freshmanMode } = ui;
  const context = { ...ctx, freshmanMode };

  return items.filter((item) => {
    // 新生模式：默认隐藏明确不适合大一的信息
    if (freshmanMode && !isFreshmanEligible(item.audience)) return false;

    if (filters.source.length && !filters.source.includes(item.source)) return false;
    if (filters.category.length && !filters.category.includes(item.category)) return false;
    if (filters.status.length && !filters.status.includes(item._statusKey)) return false;

    if (filters.quick.length) {
      // 多个快捷条件之间是「且」的关系
      const allPass = filters.quick.every((key) => {
        const predicate = QUICK_PREDICATES[key];
        return predicate ? predicate(item, context) : true;
      });
      if (!allPass) return false;
    }

    if (!matchesSearch(item, search)) return false;

    return true;
  });
}

/** 排序 */
export function sortItems(items, sortKey, now = Date.now()) {
  const copy = [...items];
  if (sortKey === 'time') copy.sort((a, b) => compareByTime(a, b, now));
  else if (sortKey === 'latest') copy.sort(compareByLatest);
  else copy.sort((a, b) => compareByUrgency(a, b, now));
  return copy;
}

/** 一步得到最终展示列表 */
export function selectVisible(state) {
  const now = state.ui.now;
  const decorated = decorateAll(state.activities, now);
  const filtered = applyFilters(decorated, state.ui, {
    now,
    favorites: state.favorites,
  });
  return sortItems(filtered, state.ui.sort, now);
}

/* ==========================================================================
 * 时间线分组
 * ========================================================================== */

/** 按开始时间分组，用于时间线视图 */
export function groupByDay(items, now = Date.now()) {
  const groups = new Map();
  const undated = [];

  for (const item of items) {
    const start = ts(item.start);
    if (start === null) {
      undated.push(item);
      continue;
    }
    const d = new Date(start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, { key, at: start, items: [] });
    groups.get(key).items.push(item);
  }

  const list = [...groups.values()].sort((a, b) => a.at - b.at);
  for (const group of list) {
    group.items.sort((a, b) => (ts(a.start) || 0) - (ts(b.start) || 0));
    group.label = dayLabel(group.at, now);
    group.dateText = `${formatDate(group.at)}`;
  }

  return { groups: list, undated };
}

/* ==========================================================================
 * 统计
 * ========================================================================== */

/** 侧栏筛选器所需的计数 */
export function buildFacets(items) {
  const source = {};
  const category = {};
  const status = {};

  for (const item of items) {
    source[item.source] = (source[item.source] || 0) + 1;
    category[item.category] = (category[item.category] || 0) + 1;
    status[item._statusKey] = (status[item._statusKey] || 0) + 1;
  }

  return { source, category, status };
}

/** 首页概览数字 */
export function buildOverview(items, now = Date.now()) {
  let urgent = 0;
  let todayCount = 0;

  for (const item of items) {
    if (hasMilestoneWithin(item, now, DAY)) urgent += 1;
    if (touchesToday(item, now)) todayCount += 1;
  }

  return { total: items.length, urgent, today: todayCount };
}

export { computeStatus, formatClock, formatDate };
