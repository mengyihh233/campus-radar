/**
 * ui/discover.js — 发现页
 *
 * 主入口：把后端返回的全部信息，按用户当前关注点筛出来、排好序、
 * 并明确指出「为什么只剩这几条」。
 */

import { state } from '../core/store.js';
import { selectVisible, groupByDay } from '../core/derive.js';
import { cardTemplate, timelineItemTemplate, emptyState } from './card.js';
import { icon } from './icons.js';
import { esc } from './dom.js';
import {
  QUICK_FILTERS,
  SOURCES,
  CATEGORIES,
  STATUS,
  SORTS,
} from '../data/taxonomy.js';

/* ==========================================================================
 * 工具条
 * ========================================================================== */

function toolbarHtml(count) {
  const { ui } = state;

  return `
    <div class="toolbar">
      <span class="toolbar__count">共 <b>${count}</b> 条信息</span>
      <span class="toolbar__spacer"></span>

      <div class="seg" role="group" aria-label="排序方式">
        ${Object.values(SORTS)
          .map(
            (s) => `
          <button
            type="button"
            class="seg__btn"
            data-action="set-sort"
            data-value="${esc(s.key)}"
            aria-pressed="${ui.sort === s.key}"
          >${esc(s.label)}</button>
        `
          )
          .join('')}
      </div>

      <div class="seg" role="group" aria-label="展示方式">
        <button type="button" class="seg__btn" data-action="set-layout" data-value="cards" aria-pressed="${
          ui.layout === 'cards'
        }" title="卡片视图">${icon('list', 13)}<span>列表</span></button>
        <button type="button" class="seg__btn" data-action="set-layout" data-value="timeline" aria-pressed="${
          ui.layout === 'timeline'
        }" title="时间线视图">${icon('calendar', 13)}<span>时间线</span></button>
      </div>
    </div>
  `;
}

/* ==========================================================================
 * 活跃筛选回显
 * ========================================================================== */

function describeFilter(group, value) {
  switch (group) {
    case 'source':
      return SOURCES[value]?.label || value;
    case 'category':
      return CATEGORIES[value]?.label || value;
    case 'status':
      return STATUS[value]?.label || value;
    case 'quick':
      return QUICK_FILTERS.find((q) => q.key === value)?.label || value;
    default:
      return value;
  }
}

function activeFiltersHtml() {
  const { filters, search, freshmanMode } = state.ui;
  const tags = [];

  for (const group of ['quick', 'source', 'category', 'status']) {
    for (const value of filters[group]) {
      tags.push({
        group,
        value,
        label: describeFilter(group, value),
      });
    }
  }

  const hasSearch = search.trim().length > 0;

  if (!tags.length && !hasSearch && !freshmanMode) return '';

  return `
    <div class="active-filters">
      <span class="active-filters__label">筛选中</span>
      ${
        freshmanMode
          ? `<span class="tag-x" data-action="clear-freshman" role="button" tabindex="0" title="关闭新生模式">
               ${icon('graduation-cap', 11)}新生模式${icon('x', 11)}
             </span>`
          : ''
      }
      ${tags
        .map(
          (t) => `
        <button type="button" class="tag-x" data-action="remove-filter" data-group="${esc(
          t.group
        )}" data-value="${esc(t.value)}">
          ${esc(t.label)}${icon('x', 11)}
        </button>
      `
        )
        .join('')}
      ${
        hasSearch
          ? `<button type="button" class="tag-x" data-action="remove-search">
               “${esc(search)}”${icon('x', 11)}
             </button>`
          : ''
      }
      <span class="toolbar__spacer"></span>
      <button type="button" class="btn btn--sm btn--ghost" data-action="clear-all">全部清除</button>
    </div>
  `;
}

/* ==========================================================================
 * 内容
 * ========================================================================== */

function cardsHtml(items, ctx) {
  if (!items.length) return emptyHtml();
  return `<div class="grid">${items
    .map((item, index) => cardTemplate(item, index, ctx))
    .join('')}</div>`;
}

function timelineHtml(items, ctx) {
  if (!items.length) return emptyHtml();

  const { groups, undated } = groupByDay(items, ctx.now);

  const groupsHtml = groups
    .map((group) => {
      const isToday = group.label === '今天';
      return `
        <div class="tl-day${isToday ? ' is-today' : ''}">
          <div class="tl-day__head">
            <span class="tl-day__date">${esc(group.dateText)}</span>
            <span class="tl-day__label">${esc(group.label || '')} · ${group.items.length} 场</span>
          </div>
          <div class="tl-day__items">
            ${group.items
              .map((item, index) => timelineItemTemplate(item, index, ctx))
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  const undatedHtml = undated.length
    ? `
      <div class="tl-day">
        <div class="tl-day__head">
          <span class="tl-day__date">时间待定</span>
          <span class="tl-day__label">${undated.length} 条</span>
        </div>
        <div class="tl-day__items">
          ${undated.map((item, index) => timelineItemTemplate(item, index, ctx)).join('')}
        </div>
      </div>
    `
    : '';

  return `<div class="timeline">${groupsHtml}${undatedHtml}</div>`;
}

function emptyHtml() {
  const { filters, search, freshmanMode } = state.ui;
  const hasFilter =
    filters.source.length ||
    filters.category.length ||
    filters.status.length ||
    filters.quick.length ||
    search.trim() ||
    freshmanMode;

  if (hasFilter) {
    return emptyState({
      title: '没有符合当前条件的信息',
      text: '当前筛选条件组合起来没有结果。可以试试清除部分条件，或者关闭新生模式看看全部信息。',
      actionLabel: '清除全部筛选',
      action: 'clear-all',
    });
  }

  return emptyState({
    title: '暂时没有信息',
    text: '平台上还没有任何已上架的信息。如果你是管理员，可以到「发布」页发布第一条通知。',
  });
}

/**
 * 渲染发现页
 */
export function discoverView() {
  const items = selectVisible(state);
  const ctx = {
    favorites: state.favorites,
    now: state.ui.now,
  };

  const content =
    state.ui.layout === 'timeline' ? timelineHtml(items, ctx) : cardsHtml(items, ctx);

  return `
    ${toolbarHtml(items.length)}
    ${activeFiltersHtml()}
    ${content}
  `;
}
