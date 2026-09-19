/**
 * ui/sidebar.js — 筛选侧栏
 *
 * 筛选维度按「用户决策顺序」排列：
 *   快捷场景（我现在能参加 / 48 小时内 / 适合新生）
 *   → 来源（这条信息谁发的，可不可信）
 *   → 类别
 *   → 状态（还来不来得及）
 */

import { state, toggleFilter, setFilters } from '../core/store.js';
import { decorateAll, buildFacets } from '../core/derive.js';
import { icon } from './icons.js';
import { render, delegate, esc } from './dom.js';
import { IS_LOCAL } from '../config.js';
import {
  SOURCES,
  SOURCE_ORDER,
  CATEGORIES,
  CATEGORY_ORDER,
  STATUS,
  STATUS_ORDER,
  QUICK_FILTERS,
} from '../data/taxonomy.js';

/* 状态筛选只暴露用户真正会主动查找的几种 */
const FILTERABLE_STATUS = [
  'ongoing',
  'soon',
  'deadline',
  'open',
  'upcoming',
  'longterm',
  'replay',
  'tbd',
];

function groupBlock({ title, group, options, counts, selected }) {
  const hasSelection = selected.length > 0;

  return `
    <div class="filter-group">
      <div class="filter-group__head">
        <span>${esc(title)}</span>
        <button
          type="button"
          class="filter-group__reset"
          data-action="reset-group"
          data-group="${esc(group)}"
          ${hasSelection ? '' : 'tabindex="-1" aria-hidden="true"'}
        >清除</button>
      </div>
      <div class="filter-list">
        ${options
          .map((option) => {
            const pressed = selected.includes(option.key);
            const count = counts[option.key] || 0;
            const dot = option.dot
              ? `<span class="filter-item__dot" style="background:${esc(option.dot)}"></span>`
              : '';
            return `
              <button
                type="button"
                class="filter-item"
                data-action="filter"
                data-group="${esc(group)}"
                data-value="${esc(option.key)}"
                aria-pressed="${pressed}"
              >
                ${dot}
                <span class="filter-item__label">${esc(option.label)}</span>
                <span class="filter-item__count">${count}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function template() {
  const { activities, ui } = state;
  const decorated = decorateAll(activities, ui.now);
  const facets = buildFacets(decorated);

  const modeLabel = IS_LOCAL ? '数据保存在本机' : '数据保存在云端';
  const modeDesc = IS_LOCAL
    ? '账号、投稿、审核记录都存在当前浏览器中，不会上传到任何服务器。清除浏览器数据会回到初始状态。'
    : '账号与内容由远端服务统一保存，可跨设备同步。';

  const quickOptions = QUICK_FILTERS.map((q) => ({
    key: q.key,
    label: q.label,
  }));

  const quickCounts = {};
  for (const q of QUICK_FILTERS) {
    quickCounts[q.key] = countQuick(decorated, q.key, state);
  }

  const sourceOptions = SOURCE_ORDER.map((key) => ({
    key,
    label: SOURCES[key].label,
    dot: SOURCES[key].dot,
  }));

  const categoryOptions = CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORIES[key].label,
  }));

  const statusOptions = FILTERABLE_STATUS.map((key) => ({
    key,
    label: STATUS[key].label,
  }));

  const activeCount =
    ui.filters.source.length +
    ui.filters.category.length +
    ui.filters.status.length +
    ui.filters.quick.length;

  return `
    <div class="sidebar-head">
      <span class="sidebar-head__title">筛选</span>
      ${
        activeCount
          ? `<button type="button" class="btn btn--sm btn--ghost" data-action="reset-all">${icon(
              'refresh',
              13
            )}<span>全部清除 (${activeCount})</span></button>`
          : ''
      }
    </div>

    ${groupBlock({
      title: '快捷场景',
      group: 'quick',
      options: quickOptions,
      counts: quickCounts,
      selected: ui.filters.quick,
    })}

    ${groupBlock({
      title: '信息来源',
      group: 'source',
      options: sourceOptions,
      counts: facets.source,
      selected: ui.filters.source,
    })}

    ${groupBlock({
      title: '信息类别',
      group: 'category',
      options: categoryOptions,
      counts: facets.category,
      selected: ui.filters.category,
    })}

    ${groupBlock({
      title: '当前状态',
      group: 'status',
      options: statusOptions,
      counts: facets.status,
      selected: ui.filters.status,
    })}

    <div class="sidebar-note">
      <strong>关于信息来源</strong><br />
      校方与学院发布的信息经过统一渠道下发；同学发布的内容由学生自主提交，平台会先做风险扫描再人工审核。
      遇到要求添加私人微信、承诺「零门槛日结」的内容，请保持警惕。
      <br /><br />
      <strong>${esc(modeLabel)}</strong><br />
      ${esc(modeDesc)}
    </div>
  `;
}

/** 快捷筛选命中数 */
function countQuick(decorated, key, currentState) {
  const now = currentState.ui.now;
  const favorites = currentState.favorites;

  return decorated.filter((item) => {
    switch (key) {
      case 'now':
        return ['ongoing', 'soon', 'deadline', 'open'].includes(item._statusKey);
      case 'urgent': {
        const next = item._status.next;
        if (!next) return false;
        const diff = next.at - now;
        return diff > 0 && diff <= 2 * 24 * 60 * 60 * 1000;
      }
      case 'freshman':
        return item._freshmanFriendly;
      case 'verified':
        return item.source !== 'student';
      case 'saved':
        return favorites.includes(item.id);
      case 'today': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + 24 * 60 * 60 * 1000;
        return [item.start, item.deadline].some((v) => {
          if (!v) return false;
          const t = new Date(v).getTime();
          return t >= start && t < end;
        });
      }
      default:
        return false;
    }
  }).length;
}

export function mountSidebar(root, handlers = {}) {
  render(root, template());

  delegate(root, 'click', (event, action, trigger) => {
    switch (action) {
      case 'filter': {
        const group = trigger.dataset.group;
        const value = trigger.dataset.value;
        if (group === 'quick' && value === 'saved' && state.role === 'guest') {
          handlers.onRequireAuth?.('收藏功能需要先登录');
          return;
        }
        toggleFilter(group, value);
        // 筛选后若是移动端浮层，自动收起
        if (window.matchMedia('(max-width: 1023px)').matches) {
          document.querySelector('.app-sidebar')?.classList.remove('is-open');
        }
        break;
      }

      case 'reset-group': {
        const group = trigger.dataset.group;
        setFilters({ [group]: [] });
        break;
      }

      case 'reset-all':
        handlers.onResetAll?.();
        break;

      default:
        break;
    }
  });

  return {
    refresh() {
      render(root, template());
    },
  };
}
