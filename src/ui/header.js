/**
 * ui/header.js — 顶栏
 *
 * 承载三件事：搜索、身份切换、新生模式。
 * 「新生模式」是一键过滤器：把明确不适合大一的信息（如仅限大二及以上）挡在视野外。
 */

import { state, setUI, setFilters } from '../core/store.js';
import { icon } from './icons.js';
import { render, delegate, esc, qs } from './dom.js';
import { nowLabel } from '../core/time.js';
import { ROLES } from '../data/taxonomy.js';

let clockTimer = null;

function searchBox() {
  const { ui } = state;
  return `
    <div class="search ${ui.search ? 'has-value' : ''}">
      <span class="search__icon">${icon('search', 15)}</span>
      <input
        id="global-search"
        class="search__input"
        type="search"
        placeholder="搜索活动、地点、关键词…"
        autocomplete="off"
        aria-label="搜索校园信息"
        value="${esc(ui.search)}"
      />
      <kbd class="search__kbd">/</kbd>
      <button type="button" class="search__clear" data-action="clear-search" aria-label="清空搜索">
        ${icon('x', 13)}
      </button>
    </div>
  `;
}

function authArea() {
  if (!state.viewer) {
    return `<button type="button" class="btn btn--sm" data-action="open-auth">${icon('user', 14)}<span>登录</span></button>`;
  }

  const roleMeta = ROLES[state.role] || ROLES.student;
  const name = state.viewer.displayName || state.viewer.username;

  return `
    <div class="user-chip" data-action="user-menu" title="当前身份：${esc(roleMeta.label)}">
      <span class="user-chip__avatar user-chip__avatar--${esc(state.role)}">${esc(name.slice(0, 1))}</span>
      <span class="user-chip__name">${esc(name)}</span>
      <span class="user-chip__role">${esc(roleMeta.short)}</span>
    </div>
    <button type="button" class="btn btn--icon" data-action="logout" aria-label="退出登录" title="退出登录">
      ${icon('logout', 15)}
    </button>
  `;
}

function template() {
  const { ui } = state;
  return `
    <button type="button" class="brand" data-action="home" title="回到发现页">
      <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="none" stroke="#2c3746" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="5.5" fill="none" stroke="#2c3746" stroke-width="1.5"/>
        <path d="M16 16 L16 6 A10 10 0 0 1 25 11.8 Z" fill="#ffd60a" fill-opacity="0.9"/>
        <circle cx="16" cy="16" r="2" fill="#ffd60a"/>
      </svg>
      <span class="brand__text">
        <span class="brand__name">Campus Radar</span>
        <span class="brand__sub">校园机会雷达</span>
      </span>
    </button>

    ${searchBox()}

    <div class="header-right">
      <div class="clock" aria-hidden="true">
        <span class="clock__time" id="clock-time">--:--</span>
        <span class="clock__date" id="clock-date">--</span>
      </div>

      <button
        type="button"
        class="btn btn--icon"
        data-action="toggle-theme"
        aria-pressed="false"
        aria-label="切换浅色 / 深色"
        title="切换浅色 / 深色"
      >
        <span class="theme-icon theme-icon--light">${icon('sun', 15)}</span>
        <span class="theme-icon theme-icon--dark">${icon('moon', 15)}</span>
      </button>

      <button
        type="button"
        class="switch"
        data-action="toggle-freshman"
        aria-pressed="${ui.freshmanMode}"
        title="开启后隐藏仅限大二及以上等信息"
      >
        <span class="switch__track"><span class="switch__thumb"></span></span>
        <span class="switch__label">新生模式</span>
      </button>

      ${authArea()}

      <button type="button" class="btn btn--icon btn-filter-toggle" data-action="open-filters" aria-label="打开筛选">
        ${icon('filter', 16)}
      </button>
    </div>
  `;
}

function tickClock() {
  const { clock, date } = nowLabel();
  const timeEl = qs('#clock-time');
  const dateEl = qs('#clock-date');
  if (timeEl) timeEl.textContent = clock;
  if (dateEl) dateEl.textContent = date;
}

/**
 * 挂载顶栏
 * @param {HTMLElement} root
 * @param {object} handlers { onAuth, onLogout, onUserMenu, onOpenFilters, onFreshmanChange }
 */
export function mountHeader(root, handlers = {}) {
  render(root, template());

  tickClock();
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(tickClock, 30000);

  delegate(root, 'click', (event, action, trigger) => {
    switch (action) {
      case 'home':
        setUI({ view: 'discover', sidebarOpen: false });
        break;

      case 'clear-search':
        setUI({ search: '' });
        {
          const input = qs('#global-search');
          if (input) {
            input.value = '';
            input.focus();
          }
          qs('.search')?.classList.remove('has-value');
        }
        break;

      case 'toggle-freshman': {
        const next = !state.ui.freshmanMode;
        setUI({ freshmanMode: next });
        if (next) {
          // 开启时把「仅限大二及以上」的相关筛选一并清理，避免空结果
          setFilters({ quick: state.ui.filters.quick });
        }
        handlers.onFreshmanChange?.(next);
        break;
      }

      case 'toggle-theme':
        handlers.onToggleTheme?.();
        break;

      case 'open-auth':
        handlers.onAuth?.();
        break;

      case 'user-menu':
        handlers.onUserMenu?.(trigger);
        break;

      case 'logout':
        handlers.onLogout?.();
        break;

      case 'open-filters':
        setUI({ sidebarOpen: !state.ui.sidebarOpen });
        break;

      default:
        break;
    }
  });

  /* 搜索：输入即筛选 */
  const input = qs('#global-search');
  if (input) {
    input.addEventListener('input', (event) => {
      const value = event.target.value;
      qs('.search')?.classList.toggle('has-value', value.length > 0);
      setUI({ search: value, view: 'discover' });
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        input.value = '';
        qs('.search')?.classList.remove('has-value');
        setUI({ search: '' });
        input.blur();
      }
    });
  }

  return {
    destroy() {
      if (clockTimer) clearInterval(clockTimer);
    },
  };
}

/** 局部刷新身份区域（登录/登出后调用，避免整个顶栏重绘导致搜索框失焦） */
export function refreshAuthArea(root) {
  const container = root.querySelector('.header-right');
  if (!container) return;
  const chip = container.querySelector('.user-chip');
  const loginBtn = container.querySelector('[data-action="open-auth"]');
  const logoutBtn = container.querySelector('[data-action="logout"]');
  const holder = document.createElement('div');
  holder.innerHTML = authArea();
  const nextNodes = [...holder.children];

  chip?.remove();
  loginBtn?.remove();
  logoutBtn?.remove();

  const anchor = container.querySelector('.btn-filter-toggle');
  nextNodes.forEach((node) => container.insertBefore(node, anchor));

  // 同步新生模式状态
  const switchEl = container.querySelector('[data-action="toggle-freshman"]');
  if (switchEl) switchEl.setAttribute('aria-pressed', String(state.ui.freshmanMode));
}

export function refreshSearch(root) {
  const input = root.querySelector('#global-search');
  if (input && input.value !== state.ui.search) input.value = state.ui.search;
  root.querySelector('.search')?.classList.toggle('has-value', state.ui.search.length > 0);
}
