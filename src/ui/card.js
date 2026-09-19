/**
 * ui/card.js — 信息卡片与时间线条目
 *
 * 卡片左侧的色条直接编码状态（进行中/即将开始/报名即将截止/…），
 * 让用户不读文字也能先扫出「哪些事现在要紧」。
 */

import { esc } from './dom.js';
import { icon } from './icons.js';
import { formatFull, formatClock, formatDate } from '../core/time.js';

const TONE_CLASS = {
  danger: 'badge--danger',
  warn: 'badge--warn',
  ok: 'badge--ok',
  info: 'badge--info',
  muted: 'badge--muted',
};

/** 状态徽章 */
export function statusBadge(item) {
  const status = item._status;
  const cls = TONE_CLASS[status.tone] || 'badge--muted';
  const live = status.live ? '<span class="pulse-dot"></span>' : '';
  return `<span class="badge ${cls}">${live}${esc(status.label)}</span>`;
}

/** 来源徽章 */
export function sourceBadge(item) {
  const source = item._source;
  const cls = TONE_CLASS[source.tone] || 'badge--muted';
  const iconName = item.source === 'student' ? 'user' : 'shield-check';
  return `<span class="badge ${cls}">${icon(iconName, 11)}${esc(source.short)}</span>`;
}

/** 依据紧急程度给倒计时上色 */
function countdownClass(urgency) {
  if (urgency === 'danger') return 'countdown--danger';
  if (urgency === 'urgent') return 'countdown--urgent';
  if (urgency === 'over') return 'countdown--over';
  return '';
}

/** 组装卡片上的信息行 */
function metaRows(item) {
  const rows = [];

  // 1. 活动时间
  const timeIcon = item._status.live ? 'radio' : 'clock';
  rows.push({
    icon: timeIcon,
    text: item._time || '时间未注明',
    tone: item._status.live ? 'urgent' : '',
  });

  // 2. 地点
  const placeText = item.place || item.placeText || '';
  if (placeText) {
    rows.push({ icon: 'map-pin', text: placeText, tone: '' });
  }

  // 3. 面向对象
  if (item.audienceText) {
    rows.push({ icon: 'users', text: item.audienceText, tone: '' });
  } else if (!placeText) {
    rows.push({ icon: 'map-pin', text: '地点未注明', tone: '', weak: true });
  }

  return rows.slice(0, 3);
}

function metaRowHtml(row) {
  const toneClass = row.tone === 'urgent' ? ' meta-row--urgent' : '';
  return `
    <div class="meta-row${toneClass}">
      <span class="meta-row__icon">${icon(row.icon, 13)}</span>
      <span class="meta-row__text">${esc(row.text)}</span>
    </div>
  `;
}

/** 卡片底部标记 */
function footFlags(item) {
  const flags = [];

  if (item._revision?.hasChanges) {
    flags.push(
      `<span class="card__flag card__flag--update">${icon('layers', 11)}已更新 · ${item._revision.changeLog.length} 项变更</span>`
    );
  }

  if (item.riskLevel === 'danger') {
    flags.push(`<span class="card__flag card__flag--danger">${icon('shield-alert', 11)}高风险提示</span>`);
  } else if (item.riskLevel === 'warn') {
    flags.push(`<span class="card__flag card__flag--warn">${icon('alert', 11)}信息待确认</span>`);
  }

  if (item.reviewStatus === 'pending') {
    flags.push(`<span class="card__flag card__flag--warn">${icon('clock', 11)}待审核</span>`);
  } else if (item.reviewStatus === 'rejected') {
    flags.push(`<span class="card__flag card__flag--danger">${icon('x', 11)}已驳回</span>`);
  } else if (item.reviewStatus === 'needs_info') {
    flags.push(`<span class="card__flag card__flag--warn">${icon('help', 11)}需补充</span>`);
  }

  if (!flags.length && item._freshmanFriendly) {
    flags.push(
      `<span class="card__flag card__flag--freshman">${icon('graduation-cap', 11)}新生可参加</span>`
    );
  }

  return flags.join('');
}

/**
 * 信息卡片
 * @param {object} item 已装饰的信息
 * @param {number} index 用于入场动画错峰
 * @param {object} ctx { favorites, now }
 */
export function cardTemplate(item, index, ctx) {
  const faved = ctx.favorites.includes(item.id);
  const risky = item.riskLevel === 'danger' ? ' is-risky' : '';
  const next = item._status.next;
  const showCountdown = next && next.at > ctx.now;

  const countdownHtml = showCountdown
    ? `<div class="meta-row meta-row--strong">
         <span class="meta-row__icon">${icon('clock', 13)}</span>
         <span class="meta-row__text">
           ${esc(next.label)}
           <span class="countdown ${countdownClass(item._status.countdown?.urgency)}">${esc(
             item._status.countdown ? item._status.countdown.text : ''
           )}</span>
         </span>
       </div>`
    : '';

  return `
    <article
      class="card enter${risky}"
      data-action="open"
      data-id="${esc(item.id)}"
      role="button"
      tabindex="0"
      aria-label="${esc(item.title)}"
      style="--state-color:${esc(item._status.color)};--i:${index}"
    >
      <div class="card__head">
        <div class="card__badges">
          ${statusBadge(item)}
          <span class="badge badge--muted">${esc(item._category.label)}</span>
        </div>
        <div class="card__actions">
          <button
            type="button"
            class="icon-btn"
            data-action="favorite"
            data-id="${esc(item.id)}"
            aria-pressed="${faved}"
            aria-label="${faved ? '取消收藏' : '加入清单'}"
            title="${faved ? '取消收藏' : '加入清单'}"
          >
            ${icon('star', 15)}
          </button>
        </div>
      </div>

      <h3 class="card__title">${esc(item.title)}</h3>
      <p class="card__summary">${esc(item.summary)}</p>

      <div class="card__meta">
        ${metaRows(item).map(metaRowHtml).join('')}
        ${countdownHtml}
      </div>

      <div class="card__foot">
        ${sourceBadge(item)}
        ${footFlags(item)}
      </div>
    </article>
  `;
}

/**
 * 时间线条目
 */
export function timelineItemTemplate(item, index, ctx) {
  const start = item.start;
  const timeText = start ? formatClock(start) : '待定';
  const tbdClass = start ? '' : ' tl-item__time--tbd';
  const faved = ctx.favorites.includes(item.id);

  return `
    <button
      type="button"
      class="tl-item enter"
      data-action="open"
      data-id="${esc(item.id)}"
      style="--i:${index}"
    >
      <span class="tl-item__time${tbdClass}">${esc(timeText)}</span>
      <span class="tl-item__body">
        <span class="tl-item__title">${esc(item.title)}</span>
        <span class="tl-item__meta">
          ${statusBadge(item)}
          <span class="tl-item__dot"></span>
          <span>${esc(item._source.short)}</span>
          ${item.place ? `<span class="tl-item__dot"></span><span>${esc(item.place)}</span>` : ''}
          ${faved ? `<span class="tl-item__dot"></span><span>已加入清单</span>` : ''}
        </span>
      </span>
    </button>
  `;
}

/** 空态 */
export function emptyState({ title, text, actionLabel, action }) {
  return `
    <div class="empty">
      <span class="empty__icon">${icon('search', 26)}</span>
      <span class="empty__title">${esc(title)}</span>
      <p class="empty__text">${esc(text)}</p>
      ${
        actionLabel
          ? `<button type="button" class="btn btn--sm" data-action="${esc(action)}">${esc(actionLabel)}</button>`
          : ''
      }
    </div>
  `;
}

/** 骨架屏 */
export function skeletonCards(count = 6) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="card" style="--state-color:var(--border-2)">
        <div class="skeleton" style="height:18px;width:58%"></div>
        <div class="skeleton" style="height:14px;width:86%;margin-top:12px"></div>
        <div class="skeleton" style="height:14px;width:64%;margin-top:8px"></div>
        <div class="skeleton" style="height:12px;width:40%;margin-top:18px"></div>
      </div>`
    )
    .join('');
}
