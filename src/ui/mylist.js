/**
 * ui/mylist.js — 我的清单
 *
 * 不只是「收藏列表」：这里同时做时间冲突检测。
 * 材料里 9月21日 19:00—20:30 撞了三场活动，
 * 如果都加入了清单，这里会直接告诉用户撞车了。
 *
 * 结构说明：列表行拆成「可点击主体」+「独立操作区」两部分，
 * 而不是把星标按钮嵌在一个大 button 里 —— 交互元素嵌套会让键盘
 * 用户无法用 Enter 触发收藏，也会让焦点落在两个互相包含的元素上。
 */

import { state } from '../core/store.js';
import { decorateAll } from '../core/derive.js';
import { findConflicts, groupConflictsByDay } from '../core/conflict.js';
import { icon } from './icons.js';
import { esc } from './dom.js';
import { formatFull, formatClock, formatDate, stamp, dayLabel } from '../core/time.js';
import { statusBadge, sourceBadge, emptyState } from './card.js';

/* ==========================================================================
 * 区块标题
 * ========================================================================== */

function blockHead({ iconName, tone = 'accent', title, count, hint }) {
  return `
    <div class="block-head">
      <span class="block-head__mark block-head__mark--${tone}">${icon(iconName, 14)}</span>
      <h2 class="block-head__title">${esc(title)}</h2>
      ${count !== undefined ? `<span class="block-head__count">${count}</span>` : ''}
      <span class="block-head__line"></span>
      ${hint ? `<span class="block-head__hint">${esc(hint)}</span>` : ''}
    </div>
  `;
}

/* ==========================================================================
 * 时间冲突
 * ========================================================================== */

function conflictBlock(conflicts) {
  if (!conflicts.length) return '';

  const groups = groupConflictsByDay(conflicts);

  const groupsHtml = groups
    .map(
      (group) => `
      <div class="conflict">
        <div class="conflict__head">
          <span class="conflict__date">${esc(formatDate(group.date))}</span>
          <span class="conflict__label">${esc(dayLabel(group.date, Date.now()) || '')}</span>
          <span class="conflict__badge">${group.items.length} 场重叠</span>
        </div>
        <div class="conflict__pairs">
          ${group.conflicts
            .map(
              (c) => `
            <div class="conflict-pair">
              <button type="button" class="conflict-pair__item" data-action="open" data-id="${esc(
                c.a.id
              )}">
                <span class="conflict-pair__time">${esc(
                  c.a.start ? formatClock(c.a.start) : '待定'
                )}</span>
                <span class="conflict-pair__title">${esc(c.a.title)}</span>
              </button>
              <span class="conflict-pair__vs">撞车</span>
              <button type="button" class="conflict-pair__item" data-action="open" data-id="${esc(
                c.b.id
              )}">
                <span class="conflict-pair__time">${esc(
                  c.b.start ? formatClock(c.b.start) : '待定'
                )}</span>
                <span class="conflict-pair__title">${esc(c.b.title)}</span>
              </button>
              ${
                c.estimated
                  ? `<span class="conflict-pair__note">${icon(
                      'info',
                      11
                    )}<span>其中至少一场未给出结束时间，按 90 分钟估算</span></span>`
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
    )
    .join('');

  return `
    <section class="block">
      ${blockHead({
        iconName: 'alert',
        tone: 'warn',
        title: '时间冲突提醒',
        count: `${conflicts.length} 组`,
        hint: '校园活动大多不支持补看，建议提前取舍',
      })}
      <div class="conflict-list">${groupsHtml}</div>
    </section>
  `;
}

/* ==========================================================================
 * 清单行
 * ========================================================================== */

function rowTemplate(item, ctx) {
  const next = item._status.next;
  const showCountdown = next && next.at > ctx.now;
  const faved = ctx.favorites.includes(item.id);

  return `
    <div class="row" style="--state-color:${esc(item._status.color)}">
      <span class="row__bar" aria-hidden="true"></span>

      <button type="button" class="row__main" data-action="open" data-id="${esc(item.id)}">
        <span class="row__title">${esc(item.title)}</span>
        <span class="row__meta">
          <span class="row__meta-item">${icon('clock', 12)}<span>${esc(
            item._time || '时间未注明'
          )}</span></span>
          ${
            item.place
              ? `<span class="row__meta-item">${icon('map-pin', 12)}<span>${esc(
                  item.place
                )}</span></span>`
              : ''
          }
          ${
            showCountdown
              ? `<span class="row__meta-item row__meta-item--urgent">${icon('bolt', 12)}<span>${esc(
                  next.label
                )} ${esc(item._status.countdown?.text || '')}</span></span>`
              : ''
          }
        </span>
      </button>

      <div class="row__tail">
        ${statusBadge(item)}
        <button
          type="button"
          class="icon-btn icon-btn--star"
          data-action="favorite"
          data-id="${esc(item.id)}"
          aria-pressed="${faved}"
          aria-label="${faved ? '从清单移除' : '加入清单'}"
          title="${faved ? '从清单移除' : '加入清单'}"
        >
          ${icon('star', 16, { fill: faved })}
        </button>
      </div>
    </div>
  `;
}

/* ==========================================================================
 * 我发布的投稿
 * ========================================================================== */

const REVIEW_STYLE = {
  approved: { label: '已通过 · 已上架', tone: 'ok', icon: 'check' },
  pending: { label: '待审核', tone: 'warn', icon: 'clock' },
  needs_info: { label: '需要补充材料', tone: 'info', icon: 'help' },
  rejected: { label: '已驳回', tone: 'danger', icon: 'x' },
  removed: { label: '已下架', tone: 'danger', icon: 'trash' },
};

function myPostsBlock() {
  const viewer = state.viewer;
  if (!viewer) return '';

  const mine = state.activities
    .filter((item) => item.authorId === viewer.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!mine.length) return '';

  const rows = mine
    .map((item) => {
      const status = REVIEW_STYLE[item.reviewStatus] || REVIEW_STYLE.pending;
      const editable = ['pending', 'needs_info', 'rejected'].includes(item.reviewStatus);

      return `
        <div class="post-row">
          <div class="post-row__body">
            <button type="button" class="post-row__title" data-action="open" data-id="${esc(
              item.id
            )}">${esc(item.title)}</button>
            <div class="post-row__meta">
              <span class="badge badge--${status.tone}">${icon(status.icon, 11)}${esc(
                status.label
              )}</span>
              ${item.createdAt ? `<span class="post-row__time">${esc(stamp(item.createdAt))}</span>` : ''}
              ${
                item.reviewerName
                  ? `<span class="post-row__time">处理人 ${esc(item.reviewerName)}</span>`
                  : ''
              }
            </div>
            ${
              item.reviewNote
                ? `<div class="post-row__note">${icon('info', 12)}<span>${esc(
                    item.reviewNote
                  )}</span></div>`
                : ''
            }
          </div>
          <div class="post-row__actions">
            <button type="button" class="btn btn--sm" data-action="open" data-id="${esc(
              item.id
            )}">查看</button>
            ${
              editable
                ? `<button type="button" class="btn btn--sm" data-action="edit-post" data-id="${esc(
                    item.id
                  )}">修改</button>
                   <button type="button" class="btn btn--sm btn--danger" data-action="delete-post" data-id="${esc(
                     item.id
                   )}" aria-label="删除">${icon('trash', 13)}</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="block">
      ${blockHead({
        iconName: 'file',
        tone: 'info',
        title: '我发布的投稿',
        count: `${mine.length} 条`,
        hint: '未通过的内容只有你自己可见',
      })}
      <div class="post-list">${rows}</div>
    </section>
  `;
}

/* ==========================================================================
 * 视图
 * ========================================================================== */

export function mylistView() {
  const ctx = { now: state.ui.now, favorites: state.favorites };
  const decorated = decorateAll(state.activities, ctx.now);
  const saved = decorated.filter((item) => state.favorites.includes(item.id));
  const myPostsHtml = myPostsBlock();

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
      ${conflictBlock(conflicts)}

      <section class="block">
        ${blockHead({
          iconName: 'star',
          tone: 'accent',
          title: '已加入清单',
          count: `${sorted.length} 条`,
          hint: urgent.length
            ? `${urgent.length} 条 24 小时内到期`
            : '按最近的截止时间排序',
        })}
        <div class="rows">${sorted.map((item) => rowTemplate(item, ctx)).join('')}</div>
      </section>

      ${myPostsHtml}
    </div>
  `;
}
