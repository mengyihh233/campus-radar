/**
 * conflict.js — 时间冲突检测
 *
 * 材料里 9月21日 19:00—20:30 这一个半小时，挤了三场活动
 * （01 训练营首训、11 科研入门、14 Git 工作坊）。
 * 新生如果都收藏了，很可能报名之后才发现撞车。
 */

import { ts, DAY, formatDate } from './time.js';
import { dayKey } from './time.js';

/** 材料未给出结束时间时，用 90 分钟估算，并在结果里标注为「估算」 */
const ASSUMED_DURATION = 90 * 60 * 1000;
/** 超过这个间隔一定不是同一天的连续活动 */
const MAX_SPAN = 12 * 60 * 60 * 1000;

/** 把一条信息转成可比较的时间区间 */
function toSlot(item) {
  const start = ts(item.start);
  if (start === null) return null;
  const end = ts(item.end);
  return {
    item,
    start,
    end: end !== null ? end : start + ASSUMED_DURATION,
    estimated: end === null,
  };
}

/**
 * 找出收藏列表里的时间冲突。
 * @param {Array} items 待检测的信息
 * @returns {Array<{ a, b, when, estimated }>}
 */
export function findConflicts(items) {
  const slots = items.map(toSlot).filter(Boolean);
  const results = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];

      // 相隔太远的不可能是冲突
      if (Math.abs(a.start - b.start) > MAX_SPAN) continue;

      // 区间重叠判定
      if (a.start < b.end && b.start < a.end) {
        results.push({
          a: a.item,
          b: b.item,
          dayKey: dayKey(a.start),
          when: describeOverlap(a, b),
          estimated: a.estimated || b.estimated,
        });
      }
    }
  }

  // 按日期分组排序，同一天内按时间
  results.sort((x, y) => x.a.start.localeCompare(y.a.start) || x.a.title.localeCompare(y.a.title));
  return results;
}

function clockOf(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function describeOverlap(a, b) {
  const day = formatDate(new Date(a.start).toISOString());
  const rangeA = `${clockOf(a.start)}—${clockOf(a.end)}${a.estimated ? '(估)' : ''}`;
  const rangeB = `${clockOf(b.start)}—${clockOf(b.end)}${b.estimated ? '(估)' : ''}`;
  return `${day} · ${rangeA} 与 ${rangeB}`;
}

/**
 * 把冲突按日期归组，便于「我的清单」分区展示。
 */
export function groupConflictsByDay(conflicts) {
  const map = new Map();
  for (const c of conflicts) {
    if (!map.has(c.dayKey)) map.set(c.dayKey, []);
    map.get(c.dayKey).push(c);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      dayKey: key,
      date: list[0].a.start,
      conflicts: list,
      // 涉及的信息去重
      items: dedupeById(list.flatMap((c) => [c.a, c.b])),
    }))
    .sort((x, y) => x.dayKey.localeCompare(y.dayKey));
}

function dedupeById(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** 统计某一天的活动密度，用于提示「这天很挤」 */
export function densityByDay(items) {
  const map = new Map();
  for (const item of items) {
    const start = ts(item.start);
    if (start === null) continue;
    const key = dayKey(start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export { ASSUMED_DURATION };
