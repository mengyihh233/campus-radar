/**
 * time.js — 时间解析与格式化
 *
 * 所有输入均为本地时间字符串 "YYYY-MM-DDTHH:mm"，
 * new Date('2026-09-19T19:00') 会被浏览器按本地时区解析，符合校园场景。
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 字符串 → 时间戳；无效返回 null */
export function ts(value) {
  if (!value) return null;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/** 字符串 → Date；无效返回 null */
export function parse(value) {
  const t = ts(value);
  return t === null ? null : new Date(t);
}

/** 时间戳 → "9月21日" */
export function formatDate(value) {
  const d = parse(value);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 时间戳 → "周一" */
export function formatWeekday(value) {
  const d = parse(value);
  if (!d) return '';
  return WEEKDAYS[d.getDay()];
}

/** 时间戳 → "19:30" */
export function formatClock(value) {
  const d = parse(value);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "9月21日 周一 19:30" */
export function formatFull(value) {
  const d = parse(value);
  if (!d) return '';
  return `${formatDate(value)} ${formatWeekday(value)} ${formatClock(value)}`;
}

/** 时间段文字："19:00—20:30"；只有起点则返回 "19:00" */
export function formatTimeRange(startValue, endValue) {
  const s = formatClock(startValue);
  const e = formatClock(endValue);
  if (s && e) return `${s}—${e}`;
  return s || '';
}

/** 当天 00:00 的时间戳 */
export function startOfDay(value) {
  const t = typeof value === 'number' ? value : ts(value);
  if (t === null) return null;
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 日期分组键："2026-09-21" */
export function dayKey(value) {
  const d = parse(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** 是否同一天 */
export function isSameDay(a, b) {
  const ka = dayKey(a);
  const kb = dayKey(b);
  return Boolean(ka) && ka === kb;
}

/** 相对今天的自然语言标签："今天" / "明天" / "昨天" */
export function dayLabel(value, now = Date.now()) {
  const target = startOfDay(value);
  const today = startOfDay(now);
  if (target === null || today === null) return '';
  const diff = Math.round((target - today) / DAY);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff === 2) return '后天';
  if (diff > 2 && diff <= 6) return `${diff} 天后`;
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} 天前`;
  return '';
}

/**
 * 距离目标时间的相对描述（不带方向）。
 * 返回 { text, urgency }，urgency ∈ over | danger | urgent | normal
 */
export function countdown(targetValue, now = Date.now(), opts = {}) {
  const target = ts(targetValue);
  if (target === null) return null;

  const diff = target - now;
  const prefix = opts.prefix !== false;

  if (diff <= 0) {
    const past = -diff;
    return {
      ms: diff,
      urgency: 'over',
      text: `${prefix ? '已过去 ' : ''}${humanize(past)}`,
      short: humanize(past),
    };
  }

  let urgency = 'normal';
  if (diff <= DAY) urgency = 'danger';
  else if (diff <= 3 * DAY) urgency = 'urgent';

  return {
    ms: diff,
    urgency,
    text: `${prefix ? '还有 ' : ''}${humanize(diff)}`,
    short: humanize(diff),
  };
}

/** 毫秒 → "3天2小时" */
export function humanize(ms) {
  if (ms < MIN) return '不到 1 分钟';
  if (ms < HOUR) return `${Math.floor(ms / MIN)} 分钟`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.floor((ms % HOUR) / MIN);
    return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  }
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  if (d >= 30) return `${d} 天`;
  return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`;
}

/** 毫秒 → 紧凑形式，用于空间紧张处："2天3时" */
export function humanizeShort(ms) {
  if (ms <= 0) return '已结束';
  if (ms < MIN) return '<1分';
  if (ms < HOUR) return `${Math.floor(ms / MIN)}分`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}时`;
  return `${Math.floor(ms / DAY)}天${Math.floor((ms % DAY) / HOUR)}时`;
}

/** 当前时间的中文完整表示，用于顶栏 */
export function nowLabel(now = Date.now()) {
  const d = new Date(now);
  return {
    clock: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    date: `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`,
  };
}

/** 时间戳 → 审计日志用的完整时间 */
export function stamp(value = Date.now()) {
  const d = new Date(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

export { MIN, HOUR, DAY, WEEKDAYS };
