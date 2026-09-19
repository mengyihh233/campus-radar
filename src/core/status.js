/**
 * status.js — 活动状态机
 *
 * 校园信息最容易误导读者的地方，就是把「已结束」「报名已截止」「可候补」
 * 「报名≠录取」这些完全不同的处境糊成一句「进行中」。
 * 这里把状态拆成互斥的 10 种，并给出排序依据。
 */

import { STATUS, STATE_COLOR } from '../data/taxonomy.js';
import { ts, HOUR, DAY, formatFull, countdown, formatDate, formatClock } from './time.js';

/** 无结束时间的一次性活动，默认按 2 小时估算持续时间 */
const ASSUMED_DURATION = 2 * HOUR;
/** 「即将开始」的时间窗口 */
const SOON_WINDOW = 6 * HOUR;
/** 「报名即将截止」的时间窗口 */
const URGENT_WINDOW = 24 * HOUR;

/**
 * 计算活动状态，返回 STATUS 中的 key。
 */
export function computeStatus(act, now = Date.now()) {
  const start = ts(act.start);
  const end = ts(act.end);
  const dl = ts(act.deadline);

  /* ---- 1. 时间轴：已经开始的活动 ---- */
  if (start !== null && start <= now) {
    const effectiveEnd = end !== null ? end : start + ASSUMED_DURATION;
    if (now <= effectiveEnd) return 'ongoing';
    return act.replayAt ? 'replay' : 'ended';
  }

  /* ---- 2. 有报名截止时间 ---- */
  if (dl !== null) {
    if (dl < now) {
      // 报名通道已关闭，但活动尚未开始
      return act.waitlist ? 'waitlist' : 'closed';
    }
    if (dl - now <= URGENT_WINDOW) return 'deadline';
    if (start !== null && start - now <= SOON_WINDOW) return 'soon';
    return 'open';
  }

  /* ---- 3. 没有报名截止时间，但有开始时间 ---- */
  if (start !== null) {
    if (start - now <= SOON_WINDOW) return 'soon';
    // 有名额限制意味着需要占位，视为「报名开放」而非单纯「待开始」
    if (act.capacity) return 'open';
    return 'upcoming';
  }

  /* ---- 4. 没有任何时间信息 ---- */
  const recurring = typeof act.recurrence === 'string' && act.recurrence.includes('长期');
  if (recurring || act.category === 'resource') return 'longterm';

  return 'tbd';
}

/**
 * 状态 + 附加上下文（倒计时、下一个关键时间点）。
 */
export function resolveStatus(act, now = Date.now()) {
  const key = computeStatus(act, now);
  const meta = STATUS[key] || STATUS.tbd;
  const next = nextMilestone(act, now);
  const cd = next ? countdown(next.at, now, { prefix: false }) : null;

  return {
    key,
    ...meta,
    color: STATE_COLOR[meta.tone] || STATE_COLOR.muted,
    next,
    countdown: cd,
  };
}

/**
 * 下一个关键时间点。
 * 返回 { at, label, kind } 或 null。
 *
 * 优先级：报名截止（未过）> 活动开始 > 资源有效期
 */
export function nextMilestone(act, now = Date.now()) {
  const candidates = [];

  const dl = ts(act.deadline);
  if (dl !== null) {
    candidates.push({ at: dl, label: '报名截止', kind: 'deadline' });
  }

  const start = ts(act.start);
  if (start !== null) {
    candidates.push({ at: start, label: '活动开始', kind: 'start' });
  }

  const expiry = ts(act.expiryAt);
  if (expiry !== null) {
    candidates.push({ at: expiry, label: '链接有效期至', kind: 'expiry' });
  }

  const future = candidates.filter((c) => c.at > now);
  if (future.length) {
    // 报名截止优先于活动开始（即使活动更早，用户也先需要知道报名窗口）
    const deadline = future.find((c) => c.kind === 'deadline');
    if (deadline) return deadline;
    future.sort((a, b) => a.at - b.at);
    return future[0];
  }

  // 全部已过：返回最近过去的那个，用于「已截止」显示
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0];
}

/**
 * 状态相关的自然语言补充说明。
 * 例如报名截止已过但活动未开始，要明确告诉用户「现在还能不能去」。
 */
export function statusHint(act, status, now = Date.now()) {
  const start = ts(act.start);
  const dl = ts(act.deadline);

  switch (status.key) {
    case 'ongoing':
      return { tone: 'danger', text: '活动正在进行中' };
    case 'soon': {
      const cd = countdown(start, now, { prefix: false });
      return { tone: 'warn', text: cd ? `${cd.text}后开始` : '即将开始' };
    }
    case 'deadline': {
      const cd = countdown(dl, now, { prefix: false });
      return { tone: 'warn', text: cd ? `报名通道将在 ${cd.text}后关闭` : '报名即将截止' };
    }
    case 'open':
      return null;
    case 'waitlist':
      return { tone: 'info', text: '正常报名已结束，现场仍有余位时可候补入场' };
    case 'closed':
      return { tone: 'muted', text: '报名已结束，活动尚未开始' };
    case 'upcoming':
      return null;
    case 'longterm':
      return { tone: 'info', text: act.expiryAt ? '长期开放，但当前批次有有效期' : '长期开放' };
    case 'replay': {
      const replay = act.replayAt ? formatDate(act.replayAt) : null;
      return {
        tone: 'muted',
        text: replay ? `已经结束，回放预计 ${replay} 上线` : '已经结束，回放时间待定',
      };
    }
    case 'ended':
      return { tone: 'muted', text: '活动已经结束' };
    case 'tbd':
      return { tone: 'warn', text: '发布方未给出明确的时间安排' };
    default:
      return null;
  }
}

/**
 * 排序键：先按状态紧急度，再按下一个时间点。
 */
export function sortKey(act, now = Date.now()) {
  const key = computeStatus(act, now);
  const meta = STATUS[key] || STATUS.tbd;
  const next = nextMilestone(act, now);

  // 已过期的，用「过去多远」倒序，让刚结束的排在前面
  let timeRank;
  if (next) {
    timeRank = next.at > now ? next.at : now - next.at + 1e12;
  } else {
    timeRank = Number.MAX_SAFE_INTEGER;
  }

  return { order: meta.order, timeRank };
}

/** 比较器：紧急优先 */
export function compareByUrgency(a, b, now = Date.now()) {
  const ka = sortKey(a, now);
  const kb = sortKey(b, now);
  if (ka.order !== kb.order) return ka.order - kb.order;
  return ka.timeRank - kb.timeRank;
}

/** 比较器：时间顺序（按开始时间，没有开始时间的排最后） */
export function compareByTime(a, b, now = Date.now()) {
  const sa = ts(a.start);
  const sb = ts(b.start);
  if (sa === null && sb === null) return (a.addedAt || 0) - (b.addedAt || 0);
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sa - sb;
}

/** 比较器：最新录入 */
export function compareByLatest(a, b) {
  return (b.addedAt || 0) - (a.addedAt || 0);
}

/**
 * 当前时间是否落在「今天」的时间范围内（用于「今天」快捷筛选）
 */
export function touchesToday(act, now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayStart = today.getTime();
  const dayEnd = dayStart + DAY;

  const points = [ts(act.start), ts(act.deadline), ts(act.expiryAt)].filter((t) => t !== null);
  return points.some((t) => t >= dayStart && t < dayEnd);
}

/** 是否在 48 小时内有关键节点 */
export function hasMilestoneWithin(act, now, windowMs) {
  const next = nextMilestone(act, now);
  if (!next) return false;
  const diff = next.at - now;
  return diff > 0 && diff <= windowMs;
}

/** 活动时间的可读描述（卡片主行使用） */
export function timeText(act, now = Date.now()) {
  const status = resolveStatus(act, now);
  const start = ts(act.start);
  const end = ts(act.end);

  if (act.timeText) return act.timeText;

  if (start === null) {
    if (act.deadlineText) return act.deadlineText;
    return '时间未注明';
  }

  const sameDay = end !== null && new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) {
    return `${formatFull(start)} — ${formatClock(end)}`;
  }
  return formatFull(start);
}

export { SOON_WINDOW, URGENT_WINDOW, ASSUMED_DURATION };
