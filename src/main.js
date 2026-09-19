/**
 * main.js — 应用入口
 *
 * 负责四件事：
 *   1. 启动时从后端拉取全量数据
 *   2. 根据当前身份决定可见视图
 *   3. 把用户操作转成 API 调用，并把结果同步回界面
 *   4. 维护界面刷新节奏（状态变化 / 定时器）
 *
 * 关于「发布页不随状态重建」：编辑中的表单属于用户未保存的输入，
 * 不能因为别处的状态变化被清空，因此这里是唯一豁免重建的视图。
 */

import { api, setToken, clearToken } from './api/client.js';
import {
  state,
  setState,
  setUI,
  setFilters,
  clearFilters,
  subscribe,
  availableViews,
  resetSession,
} from './core/store.js';
import { decorateAll } from './core/derive.js';
import { qs, delegate, esc, render } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toastOk, toastError, toastWarn, toastInfo } from './ui/toast.js';
import { mountHeader, refreshAuthArea, refreshSearch } from './ui/header.js';
import { mountSidebar } from './ui/sidebar.js';
import { discoverView } from './ui/discover.js';
import { mylistView } from './ui/mylist.js';
import { publishView, bindPublish, startEdit, resetDraft } from './ui/publish.js';
import { reviewView, setReviewTab, getReviewTab, openDecisionModal } from './ui/review.js';
import { dashboardView } from './ui/dashboard.js';
import { openDetail, closeDetail, isDetailOpen, openReport } from './ui/detail.js';
import { openAuthModal } from './ui/auth.js';

let sidebarApi = null;
let lastRenderedView = null;
let nowTimer = null;

/* ==========================================================================
 * 主题
 * ========================================================================== */

function readTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  setUI({ theme });
  try {
    localStorage.setItem('campus-radar.theme', theme);
  } catch {
    /* 忽略 */
  }
}

function toggleTheme() {
  const next = readTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/* ==========================================================================
 * 数据
 * ========================================================================== */

function applyBootstrap(data) {
  setState({
    ready: true,
    loading: false,
    offline: false,
    error: null,
    viewer: data.viewer || null,
    role: data.role || 'guest',
    permissions: data.permissions || {},
    activities: Array.isArray(data.activities) ? data.activities : [],
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    reports: Array.isArray(data.reports) ? data.reports : [],
    audit: Array.isArray(data.audit) ? data.audit : [],
    stats: data.stats || null,
    demoAccounts: Array.isArray(data.demoAccounts) ? data.demoAccounts : null,
    serverTime: data.serverTime || Date.now(),
  });
}

async function load() {
  const data = await api.bootstrap();
  applyBootstrap(data);
  return data;
}

/** 重新拉取全量数据，用于审核、发布等写操作之后 */
async function reload() {
  try {
    await load();
  } catch (error) {
    toastError(error.message);
  }
}

/* ==========================================================================
 * 渲染
 * ========================================================================== */

function renderSkeleton() {
  const main = qs('#main');
  render(
    main,
    `
    <div class="grid">
      ${Array.from({ length: 6 })
        .map(
          () => `
        <div class="card" style="--state-color:var(--border-2)">
          <div class="skeleton" style="height:18px;width:56%"></div>
          <div class="skeleton" style="height:14px;width:88%;margin-top:14px"></div>
          <div class="skeleton" style="height:14px;width:62%;margin-top:8px"></div>
          <div class="skeleton" style="height:12px;width:38%;margin-top:20px"></div>
        </div>`
        )
        .join('')}
    </div>
  `
  );
}

function renderErrorState() {
  const main = qs('#main');
  render(
    main,
    `
    <div class="empty">
      <span class="empty__icon">${icon('alert', 26)}</span>
      <span class="empty__title">数据加载失败</span>
      <p class="empty__text">
        ${esc(state.error || '未知错误')}
        <br /><br />
        如果当前是本机演示模式，通常是因为浏览器禁用了本地存储或 Web Crypto。
        可以尝试：换用 Chrome / Edge 打开、退出无痕模式、或通过
        <code class="mono">http://localhost</code> 访问而不是直接双击文件。
      </p>
      <button type="button" class="btn btn--primary" data-action="retry">${icon(
        'refresh',
        14
      )}<span>重试</span></button>
    </div>
  `
  );
}

function tabsHtml() {
  const views = availableViews();
  return `
    <div class="tabs" role="tablist">
      ${views
        .map(
          (v) => `
        <button
          type="button"
          class="tab"
          role="tab"
          data-action="switch-view"
          data-value="${esc(v.key)}"
          aria-selected="${state.ui.view === v.key}"
        >
          ${icon(v.icon, 13)}<span>${esc(v.label)}</span>
        </button>
      `
        )
        .join('')}
    </div>
  `;
}

function viewContent() {
  switch (state.ui.view) {
    case 'mine':
      return state.role === 'guest'
        ? `<div class="empty"><span class="empty__title">需要登录</span><p class="empty__text">登录后可以使用清单、投稿等功能。</p></div>`
        : mylistView();

    case 'publish':
      return state.role === 'guest'
        ? `<div class="empty"><span class="empty__title">需要登录</span><p class="empty__text">登录后才能发布信息。</p></div>`
        : publishView();

    case 'review':
      return state.permissions.reviewQueue
        ? reviewView()
        : `<div class="empty"><span class="empty__title">没有权限</span><p class="empty__text">审核台仅对管理端开放。</p></div>`;

    case 'dashboard':
      return state.permissions.viewDashboard
        ? dashboardView()
        : `<div class="empty"><span class="empty__title">没有权限</span><p class="empty__text">管理概览仅对管理端开放。</p></div>`;

    default:
      return discoverView();
  }
}

function renderMain() {
  const main = qs('#main');
  if (!main) return;

  const scrollY = window.scrollY;

  render(main, `${tabsHtml()}<div id="view-root">${viewContent()}</div>`);

  restoreScroll(scrollY);
  lastRenderedView = state.ui.view;

  // 发布页需要单独绑定表单逻辑
  if (state.ui.view === 'publish' && state.role !== 'guest') {
    bindPublish(main, {
      onSubmit: submitPost,
      onNeedAuth: () => openAuth(),
    });
  }
}

function restoreScroll(y) {
  if (y > 0) {
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

function syncHeaderBits() {
  const header = qs('#app-header');
  if (!header) return;
  refreshAuthArea(header);
  refreshSearch(header);
}

function syncSidebarOpen() {
  const sidebar = qs('#app-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('is-open', state.ui.sidebarOpen);
}

function renderAll() {
  renderMain();
  sidebarApi?.refresh();
  syncHeaderBits();
  syncSidebarOpen();
}

/* ==========================================================================
 * 详情
 * ========================================================================== */

function findDecorated(id) {
  return decorateAll(state.activities, state.ui.now).find((item) => item.id === id);
}

function detailContext() {
  return {
    favorites: state.favorites,
    role: state.role,
    viewer: state.viewer,
    permissions: state.permissions,
    onAction: handleDetailAction,
  };
}

function openItem(id) {
  const item = findDecorated(id);
  if (!item) return;
  openDetail(item, detailContext());
}

function handleDetailAction(action, id) {
  switch (action) {
    case 'favorite':
      toggleFavorite(id);
      break;
    case 'report':
      promptReport(id);
      break;
    case 'need-auth':
      openAuth();
      break;
    case 'edit-post': {
      const item = state.activities.find((a) => a.id === id);
      if (item) {
        closeDetail();
        startEdit(item);
      }
      break;
    }
    case 'delete-post':
      confirmDelete(id);
      break;
    case 'go-review':
      closeDetail();
      setReviewTab('pending');
      setUI({ view: 'review' });
      break;
    default:
      break;
  }
}

/** 只更新抽屉底部按钮，避免整个抽屉重绘 */
function syncDetailFavorite(id) {
  const root = qs('#drawer-root');
  const button = root?.querySelector('.drawer__foot [data-action="favorite"]');
  if (!button) return;

  const faved = state.favorites.includes(id);
  button.classList.toggle('btn--primary', faved);
  const label = button.querySelector('span');
  if (label) label.textContent = faved ? '已在清单中' : '加入我的清单';
}

/* ==========================================================================
 * 写操作
 * ========================================================================== */

async function toggleFavorite(id) {
  if (state.role === 'guest') {
    toastWarn('收藏需要先登录');
    openAuth();
    return;
  }

  try {
    const result = await api.toggleFavorite(id);
    setState({ favorites: result.ids });
    syncDetailFavorite(id);
    toastOk(result.favorited ? '已加入我的清单' : '已从清单移除');
  } catch (error) {
    toastError(error.message);
  }
}

async function submitPost(draft, editingId) {
  const payload = {
    ...draft,
    capacity: draft.capacity ? Number(draft.capacity) : null,
  };

  if (editingId) {
    const result = await api.updatePost(editingId, payload);
    toastOk(
      result.item.reviewStatus === 'pending'
        ? '修改已提交，等待重新审核'
        : '修改已保存'
    );
  } else {
    const result = await api.createPost(payload);
    if (result.item.reviewStatus === 'approved') {
      toastOk('已发布并上架');
    } else {
      toastOk('已提交，等待管理员审核', {
        action: { label: '查看我的投稿', onClick: () => setUI({ view: 'mine' }) },
      });
    }
    void resetDraft;
  }

  await reload();
  renderMain();
}

async function confirmDelete(id) {
  const item = state.activities.find((a) => a.id === id);
  if (!item) return;

  const confirmed = window.confirm(`确定要删除「${item.title}」吗？此操作不可撤销。`);
  if (!confirmed) return;

  try {
    await api.deletePost(id);
    closeDetail();
    await reload();
    toastOk('已删除');
  } catch (error) {
    toastError(error.message);
  }
}

function promptReport(id) {
  const item = findDecorated(id);
  if (!item) return;
  if (state.role === 'guest') {
    toastWarn('举报需要先登录');
    openAuth();
    return;
  }

  openReport(item, async ({ reason, detail }) => {
    try {
      await api.submitReport({ activityId: id, reason, detail });
      toastOk('举报已提交，管理员会尽快处理');
    } catch (error) {
      toastError(error.message);
      throw error;
    }
  });
}

/** 审核动作 */
function reviewAction(id, action) {
  const item = state.activities.find((a) => a.id === id);
  if (!item) return;

  const config = {
    approve: {
      title: '通过审核',
      requireNote: false,
      confirmLabel: '确认通过并上架',
      tone: 'primary',
      placeholder: '例如：信息完整，符合校内活动发布规范',
      lead: `「${item.title}」将通过审核，对全部同学可见。`,
    },
    reject: {
      title: '驳回投稿',
      requireNote: true,
      confirmLabel: '确认驳回',
      tone: 'danger',
      placeholder: '例如：缺少主办方信息，无法核实真实性',
      lead: `「${item.title}」将被驳回，发布者可以看到你填写的理由。`,
    },
    needs_info: {
      title: '要求补充材料',
      requireNote: true,
      confirmLabel: '发送补充要求',
      tone: 'primary',
      placeholder: '例如：请补充活动地点与报名方式',
      lead: `「${item.title}」将标记为「需补充」，发布者补充后可重新提交。`,
    },
    remove: {
      title: '下架内容',
      requireNote: true,
      confirmLabel: '确认下架',
      tone: 'danger',
      placeholder: '例如：内容含商业推广，违反发布规范',
      lead: `「${item.title}」将从公开列表移除。`,
    },
    restore: {
      title: '恢复上架',
      requireNote: false,
      confirmLabel: '确认恢复',
      tone: 'primary',
      placeholder: '例如：已确认信息无误',
      lead: `「${item.title}」将重新出现在公开列表中。`,
    },
  }[action];

  if (!config) return;

  openDecisionModal({
    ...config,
    onConfirm: async (note) => {
      await api.reviewPost(id, action, note);
      await reload();
      toastOk('处理完成');
    },
  });
}

/** 处理举报 */
function reportAction(reportId, action) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) return;

  openDecisionModal({
    title: action === 'resolve' ? '判定举报成立' : '忽略这条举报',
    requireNote: false,
    confirmLabel: action === 'resolve' ? '确认成立' : '确认忽略',
    tone: action === 'resolve' ? 'danger' : 'primary',
    placeholder: '记录处理说明，便于日后追溯',
    lead:
      action === 'resolve'
        ? `「${report.activityTitle}」被举报「${report.reasonLabel}」。若内容确有问题，建议同时前往审核台将其下架。`
        : `将忽略对「${report.activityTitle}」的这条举报。`,
    onConfirm: async (note) => {
      await api.resolveReport({ id: reportId, action, note });
      await reload();
      toastOk('已处理');
    },
  });
}

/* ==========================================================================
 * 身份
 * ========================================================================== */

function openAuth() {
  openAuthModal({
    onLogin: async ({ username, password }) => {
      const result = await api.login(username, password);
      setToken(result.token);
      await reload();
      toastOk(`欢迎回来，${result.viewer.displayName || result.viewer.username}`);
    },
    onRegister: async (payload) => {
      const result = await api.register(payload);
      setToken(result.token);
      await reload();
      toastOk(
        result.viewer.role === 'admin'
          ? '管理端账号创建成功'
          : '账号创建成功，欢迎加入'
      );
    },
  });
}

async function logout() {
  try {
    await api.logout();
  } catch {
    /* 会话可能已过期，忽略 */
  }
  clearToken();
  closeDetail();
  resetSession();
  renderAll();
  try {
    await reload();
  } catch {
    /* 忽略 */
  }
  toastInfo('已退出登录');
}

/* ==========================================================================
 * 事件
 * ========================================================================== */

function bindGlobalEvents() {
  const main = qs('#main');

  delegate(main, 'click', (event, action, trigger) => {
    switch (action) {
      case 'open':
        openItem(trigger.dataset.id);
        break;

      case 'favorite':
        event.stopPropagation();
        toggleFavorite(trigger.dataset.id);
        break;

      case 'switch-view':
        setUI({ view: trigger.dataset.value, sidebarOpen: false });
        break;

      case 'set-sort':
        setUI({ sort: trigger.dataset.value });
        break;

      case 'set-layout':
        setUI({ layout: trigger.dataset.value });
        break;

      case 'remove-filter': {
        const group = trigger.dataset.group;
        const value = trigger.dataset.value;
        setFilters({
          [group]: state.ui.filters[group].filter((v) => v !== value),
        });
        break;
      }

      case 'remove-search':
        setUI({ search: '' });
        break;

      case 'clear-freshman':
        setUI({ freshmanMode: false });
        break;

      case 'clear-all':
        clearFilters();
        setUI({ freshmanMode: false });
        break;

      case 'go-discover':
        setUI({ view: 'discover' });
        break;

      case 'retry':
        setState({ loading: true });
        boot();
        break;

      case 'review-tab':
        setReviewTab(trigger.dataset.value);
        renderMain();
        break;

      case 'approve':
      case 'reject':
      case 'needs_info':
      case 'remove':
      case 'restore':
        reviewAction(trigger.dataset.id, action);
        break;

      case 'resolve-report':
        reportAction(trigger.dataset.id, 'resolve');
        break;

      case 'dismiss-report':
        reportAction(trigger.dataset.id, 'dismiss');
        break;

      case 'edit-post': {
        const item = state.activities.find((a) => a.id === trigger.dataset.id);
        if (item) {
          closeDetail();
          startEdit(item);
        }
        break;
      }

      case 'delete-post':
        confirmDelete(trigger.dataset.id);
        break;

      default:
        break;
    }
  });

  /* 卡片键盘可达性：Enter / Space 打开详情 */
  delegate(main, 'keydown', (event, action, trigger) => {
    if (action !== 'open') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openItem(trigger.dataset.id);
    }
  });

  /* 全局快捷键 */
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (event.key === '/' && !typing) {
      event.preventDefault();
      qs('#global-search')?.focus();
    }
  });

  /* 移动端遮罩：点击侧栏以外区域收起 */
  document.addEventListener('click', (event) => {
    if (!state.ui.sidebarOpen) return;
    const sidebar = qs('#app-sidebar');
    const toggle = qs('[data-action="open-filters"]');
    if (sidebar?.contains(event.target)) return;
    if (toggle?.contains(event.target)) return;
    setUI({ sidebarOpen: false });
  });
}

/* ==========================================================================
 * 启动
 * ========================================================================== */

async function boot() {
  renderSkeleton();

  try {
    const data = await load();
    if (data.viewer) {
      // 已有会话
    }
  } catch (error) {
    setState({
      ready: true,
      loading: false,
      offline: true,
      error: error.message,
    });
    renderErrorState();
    return;
  }

  renderAll();
}

function mountShell() {
  const header = qs('#app-header');
  const sidebar = qs('#app-sidebar');

  mountHeader(header, {
    onAuth: openAuth,
    onLogout: logout,
    onUserMenu: () => setUI({ view: 'mine' }),
    onFreshmanChange: () => {
      renderMain();
      sidebarApi?.refresh();
    },
    onToggleTheme: toggleTheme,
  });

  sidebarApi = mountSidebar(sidebar, {
    onRequireAuth: (message) => {
      toastWarn(message);
      openAuth();
    },
    onResetAll: () => {
      clearFilters();
      setUI({ freshmanMode: false });
    },
  });

  bindGlobalEvents();

  /* 状态变化 → 重绘；唯一例外是发布页，避免清空用户未保存的输入 */
  subscribe(() => {
    sidebarApi?.refresh();
    syncSidebarOpen();

    if (state.ui.view === 'publish' && lastRenderedView === 'publish') {
      return;
    }

    // 只在切换视图时播放入场动画。
    // 收藏、筛选、排序同样会重建列表，若每次都重播动画，界面会持续闪烁。
    state.ui.animate = state.ui.view !== lastRenderedView;

    renderMain();
  });

  /* 每分钟刷新一次「现在」，让倒计时保持准确 */
  if (nowTimer) clearInterval(nowTimer);
  nowTimer = setInterval(() => {
    if (state.ui.view === 'publish') return;
    setUI({ now: Date.now() });
  }, 60000);
}

function start() {
  mountShell();
  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

export { boot, renderAll };
