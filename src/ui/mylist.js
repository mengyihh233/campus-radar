/**
 * ui/mylist.js — 我的清单
 *
 * 不只是「收藏列表」：这里做时间冲突检测。
 * 材料里 9月21日 19:00—20:30 撞了三场活动，
 * 如果都加入了清单，这里会直接告诉用户撞车了。
 */

import { state } from '../core/store.js';
import { decorateAll } from '../core/derive.js';
import { findConflicts, groupConflictsByDay } from '../core/conflict.js';
import { icon } from './icons.js';
import { esc } from './dom.js';
import { formatFull, formatClock, formatDate, stamp } from '../core/time.js';
import { statusBadge, sourceBadge, emptyState } from './card.js';

/** 冲突提醒区块 */
function conflictSectionHtml(conflicts) {
  if (!conflicts.length) return '';

  const groups = groupConflictsByDay(conflicts);

  const groupsHtml = groups
    .map(
      (group) => `
      <div class="conflict-card">
        <div class="conflict-card__head">
          ${icon('alert', 15)}
          <span>${esc(formatDate(group.date))} 有 ${group.items.length} 场活动时间重叠</span>
          <span class="toolbar__spacer"></span>
          <span class="conflict-card__when">${esc(group.dayKey)}</span>
        </div>
        ${group.conflicts
          .map(
            (c) => `
          <div class="conflict-pair">
            <button type="button" class="conflict-pair__item" data-action="open" data-id="${esc(c.a.id)}">
              <span class="conflict-pair__time">${esc(
                c.a.start ? formatClock(c.a.start) : '待定'
              )}</span>
              <span class="conflict-pair__title">${esc(c.a.title)}</span>
            </button>
            <button type="button" class="conflict-pair__item" data-action="open" data-id="${esc(c.b.id)}">
              <span class="conflict-pair__time">${esc(
                c.b.start ? formatClock(c.b.start) : '待定'
              )}</span>
              <span class="conflict-pair__title">${esc(c.b.title)}</span>
            </button>
            ${
              c.estimated
                ? `<span class="field__hint">${icon('info', 11)} 其中至少一场未给出结束时间，按 90 分钟估算。</span>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
    )
    .join('');

  return `
    <div class="slot">
      <div class="slot__head">
        <span class="slot__title">${icon('alert', 15)}时间冲突提醒</span>
        <span class="slot__count">${conflicts.length} 组</span>
        <span class="slot__line"></span>
      </div>
      <p class="field__hint" style="margin:-8px 0 12px">
        下面这些信息的时间段有重叠。校园活动大多不支持补看，建议提前取舍。
      </p>
      ${groupsHtml}
    </div>
  `;
}

/** 收藏行 */
function rowHtml(item, ctx) {
  const next = item._status.next;
  const showCd = next && next.at > ctx.now;

  return `
    <button
      type="button"
      class="row-item"
      data-action="open"
      data-id="${esc(item.id)}"
      style="--state-color:${esc(item._status.color)}"
    >
      <span class="row-item__state"></span>
      <span class="row-item__body">
        <span class="row-item__title">${esc(item.title)}</span>
        <span class="row-item__meta">
          ${item._time ? `<span>${esc(item._time)}</span>` : '<span>时间未注明</span>'}
          ${item.place ? `<span class="tl-item__dot"></span><span>${esc(item.place)}</span>` : ''}
          ${
            showCd
              ? `<span class="tl-item__dot"></span><span class="countdown">${esc(
                  next.label
                )} ${esc(item._status.countdown?.text || '')}</span>`
              : ''
          }
        </span>
      </span>
      <span class="row-item__right">
        ${statusBadge(item)}
        <span class="icon-btn" data-action="favorite" data-id="${esc(item.id)}" role="button" tabindex="0" aria-label="取消收藏" aria-pressed="true">
          ${icon('star', 15)}
        </span>
      </span>
    </button>
  `;
}

/** 我发布的投稿，含审核状态与驳回理由 */
function myPostsSection() {
  const viewer = state.viewer;
  if (!viewer) return '';

  const mine = state.activities
    .filter((item) => item.authorId === viewer.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!mine.length) return '';

  const rows = mine
    .map((item) => {
      const statusMap = {
        approved: { label: '已通过 · 已上架', tone: 'ok', icon: 'check' },
        pending: { label: '待审核', tone: 'warn', icon: 'clock' },
        needs_info: { label: '需要补充材料', tone: 'info', icon: 'help' },
        rejected: { label: '已驳回', tone: 'danger', icon: 'x' },
        removed: { label: '已下架', tone: 'danger', icon: 'trash' },
      };
      const status = statusMap[item.reviewStatus] || statusMap.pending;

      return `
        <div class="mypost">
          <div class="mypost__body">
            <button type="button" class="mypost__title" data-action="open" data-id="${esc(
              item.id
            )}" style="text-align:left">${esc(item.title)}</button>
            <div class="mypost__meta">
              <span class="badge badge--${status.tone}">${icon(status.icon, 11)}${esc(status.label)}</span>
              ${item.createdAt ? `<span>提交于 ${esc(stamp(item.createdAt))}</span>` : ''}
              ${
                item.reviewerName
                  ? `<span>处理人：${esc(item.reviewerName)}</span>`
                  : ''
              }
            </div>
            ${
              item.reviewNote
                ? `<div class="mypost__note">处理意见：${esc(item.reviewNote)}</div>`
                : ''
            }
          </div>
          <div class="row-item__right">
            <button type="button" class="btn btn--sm" data-action="open" data-id="${esc(
              item.id
            )}">查看</button>
            ${
              ['pending', 'needs_info', 'rejected'].includes(item.reviewStatus)
                ? `<button type="button" class="btn btn--sm" data-action="edit-post" data-id="${esc(
                    item.id
                  )}">修改</button>
                   <button type="button" class="btn btn--sm btn--danger" data-action="delete-post" data-id="${esc(
                     item.id
                   )}">删除</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="slot">
      <div class="slot__head">
        <span class="slot__title">${icon('file', 15)}我发布的投稿</span>
        <span class="slot__count">${mine.length} 条</span>
        <span class="slot__line"></span>
      </div>
      <div class="rowlist" style="display:block">${rows}</div>
    </div>
  `;
}

export function mylistView() {
  const ctx = { now: state.ui.now, favorites: state.favorites };
  const decorated = decorateAll(state.activities, ctx.now);
  const saved = decorated.filter((item) => state.favorites.includes(item.id));
  const myPostsHtml = myPostsSection();

  if (!saved.length) {
    return `
      <div class="mylist">
        ${myPostsHtml}
        ${emptyState({
          title: '清单还是空的',
          text: '在「发现」页点卡片右上角的星标，就能把感兴趣的活动加到这里。加入之后，系统会自动帮你检查时间冲突。',
          actionLabel: '去发现页看看',
          action: 'go-discover',
        })}
      </div>
    `;
  }

  // 按下一个关键时间点排序，最早要行动的排最前
  const sorted = [...saved].sort((a, b) => {
    const na = a._status.next?.at ?? Number.MAX_SAFE_INTEGER;
    const nb = b._status.next?.at ?? Number.MAX_SAFE_INTEGER;
    return na - nb;
  });

  const conflicts = findConflicts(saved);
  const urgent = sorted.filter((item) => {
    const next = item._status.next;
    return next && next.at > ctx.now && next.at - ctx.now <= 24 * 60 * 60 * 1000;
  });

  return `
    <div class="mylist">
      ${conflictSectionHtml(conflicts)}

      <div class="slot">
        <div class="slot__head">
          <span class="slot__title">${icon('star', 15)}已加入清单</span>
          <span class="slot__count">${sorted.length} 条</span>
          <span class="slot__line"></span>
          ${
            urgent.length
              ? `<span class="badge badge--warn">${icon('clock', 11)}${urgent.length} 条 24 小时内到期</span>`
              : ''
          }
        </div>
        <div class="rowlist">
          ${sorted.map((item) => rowHtml(item, ctx)).join('')}
        </div>
      </div>

      ${myPostsHtml}
    </div>
  `;
}

export { formatFull };
