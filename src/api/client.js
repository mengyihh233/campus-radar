/**
 * api/client.js — 接口层入口
 *
 * 对上层（视图与入口文件）暴露唯一的 api 对象，
 * 内部根据运行模式选择实现：
 *
 *   local  → api/local.js       直接读写 localStorage，无需服务器
 *   remote → 本文档下方的实现    请求远端后端（EdgeOne Makers 云函数）
 *
 * 两种实现的接口签名完全一致，因此视图层无需感知运行模式。
 */

import { IS_LOCAL, API_BASE, configWarning } from '../config.js';
import { localApi } from './local.js';
import { ApiError } from './error.js';

/* ==========================================================================
 * 会话令牌（两种模式共用同一个存储键）
 * ========================================================================== */

const TOKEN_KEY = 'campus-radar.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下降级为单次会话有效 */
  }
}

export function clearToken() {
  setToken(null);
}

/* ==========================================================================
 * 远端实现
 * ========================================================================== */

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const url = API_BASE ? `${API_BASE}${path}` : path;

  let response;
  try {
    response = await fetch(url, { method: options.method || 'GET', headers, body });
  } catch {
    throw new ApiError(
      configWarning() || '无法连接后端服务，请确认服务已启动且地址配置正确',
      { status: 0, code: 'OFFLINE' }
    );
  }

  let data = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => '');
    if (text.trimStart().startsWith('<!doctype') || text.trimStart().startsWith('<html')) {
      throw new ApiError(
        `接口 ${path} 未返回 JSON，路由可能未命中（请确认云函数路由配置）`,
        { status: response.status, code: 'NOT_JSON' }
      );
    }
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(data.error || `请求失败（HTTP ${response.status}）`, {
      status: response.status,
      code: data.code || null,
      payload: data,
    });
  }

  return data;
}

const remoteApi = {
  bootstrap: () => request('/api/bootstrap'),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  createPost: (payload) => request('/api/posts', { method: 'POST', body: payload }),
  updatePost: (id, payload) =>
    request(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { action: 'update', ...payload },
    }),
  reviewPost: (id, action, note) =>
    request(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { action, note },
    }),
  deletePost: (id) => request(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggleFavorite: (id) => request('/api/favorites', { method: 'POST', body: { id } }),
  submitReport: (payload) => request('/api/reports', { method: 'POST', body: payload }),
  loadReports: () => request('/api/reports'),
  resolveReport: (payload) => request('/api/reports', { method: 'PATCH', body: payload }),
};

/* ==========================================================================
 * 导出
 * ========================================================================== */

export const api = IS_LOCAL ? localApi : remoteApi;

export { ApiError, IS_LOCAL };
