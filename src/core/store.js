/**
 * core/store.js — 前端应用状态
 *
 * 只保存「界面状态」与「服务端返回的数据快照」。
 * 业务数据的唯一权威来源是后端 Blob，前端不做任何写入假设。
 */

const listeners = new Set();

const UI_DEFAULTS = () => ({
  view: 'discover', // discover | mine | publish | review | dashboard
  search: '',
  sort: 'urgency', // urgency | time | latest
  layout: 'cards', // cards | timeline
  filters: {
    source: [],
    category: [],
    status: [],
    quick: [],
  },
  freshmanMode: false,
  sidebarOpen: false,
  now: Date.now(),
  theme: null, // light | dark；null 表示尚未加载
  /**
   * 是否播放入场动画。
   * 只在切换视图时为 true —— 否则每次收藏、筛选都会重建列表并重播动画，
   * 界面会不停地闪。
   */
  animate: true,
});

export const state = {
  /* 加载状态 */
  ready: false,
  loading: true,
  error: null,
  offline: false,

  /* 身份 */
  viewer: null,
  role: 'guest',
  permissions: {},

  /* 数据 */
  activities: [],
  favorites: [],
  reports: [],
  audit: [],
  stats: null,
  demoAccounts: null,
  serverTime: Date.now(),

  /* 界面 */
  ui: UI_DEFAULTS(),
};

/* --------------------------------------------------------------------------
 * 订阅
 * ------------------------------------------------------------------------ */

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[store] 订阅者执行出错', error);
    }
  }
}

/* --------------------------------------------------------------------------
 * 更新
 * ------------------------------------------------------------------------ */

/** 合并顶层状态 */
export function setState(patch) {
  Object.assign(state, patch);
  emit();
}

/** 合并界面状态 */
export function setUI(patch) {
  state.ui = { ...state.ui, ...patch };
  emit();
}

/** 更新筛选条件（数组型，取值为多选） */
export function setFilters(patch) {
  state.ui = { ...state.ui, filters: { ...state.ui.filters, ...patch } };
  emit();
}

/** 切换多选筛选里的某一项 */
export function toggleFilter(group, value) {
  const current = state.ui.filters[group] || [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  setFilters({ [group]: next });
}

/** 清空全部筛选 */
export function clearFilters() {
  state.ui = { ...state.ui, filters: UI_DEFAULTS().filters, search: '' };
  emit();
}

/** 重置为未登录状态 */
export function resetSession() {
  Object.assign(state, {
    ready: true,
    loading: false,
    offline: false,
    viewer: null,
    role: 'guest',
    permissions: {},
    favorites: [],
    reports: [],
    audit: [],
    stats: null,
    ui: { ...state.ui, filters: UI_DEFAULTS().filters, search: '', view: 'discover' },
  });
  emit();
}

export function isFavorited(id) {
  return state.favorites.includes(id);
}

export function canView(view) {
  const map = {
    mine: state.role !== 'guest',
    publish: state.role !== 'guest',
    review: state.permissions.reviewQueue === true,
    dashboard: state.permissions.viewDashboard === true,
  };
  return map[view] !== false;
}

/** 当前身份在界面上可见的视图列表 */
export function availableViews() {
  const views = [{ key: 'discover', label: '发现', icon: 'compass' }];
  if (state.role !== 'guest') {
    views.push({ key: 'mine', label: '我的清单', icon: 'star' });
    views.push({ key: 'publish', label: '发布', icon: 'plus' });
  }
  if (state.permissions.reviewQueue) {
    views.push({ key: 'review', label: '审核台', icon: 'clipboard' });
    views.push({ key: 'dashboard', label: '管理概览', icon: 'chart' });
  }
  return views;
}

export { UI_DEFAULTS };
