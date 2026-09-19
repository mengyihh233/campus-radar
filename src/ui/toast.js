/**
 * ui/toast.js — 轻量提示
 *
 * 用于操作结果的即时反馈（收藏成功、提交完成、审核通过等）。
 * 不做自动消失以外的交互，避免打断用户当前动作。
 */

import { qs, esc } from './dom.js';
import { icon } from './icons.js';

const ICON_MAP = {
  ok: 'check',
  warn: 'alert',
  danger: 'alert-circle',
  info: 'info',
};

const DEFAULT_DURATION = 3200;
const MAX_VISIBLE = 3;

/**
 * 显示一条提示
 * @param {string} message
 * @param {object} [options]
 * @param {'ok'|'warn'|'danger'|'info'} [options.type]
 * @param {number} [options.duration] 毫秒，0 表示不自动关闭
 * @param {{label:string, onClick:Function}} [options.action]
 */
export function toast(message, options = {}) {
  const { type = 'info', duration = DEFAULT_DURATION, action = null } = options;
  const root = qs('#toast-root');
  if (!root) return () => {};

  // 最多同时显示 3 条，超出时移除最旧的
  const existing = [...root.children];
  if (existing.length >= MAX_VISIBLE) existing.slice(0, existing.length - MAX_VISIBLE + 1).forEach((el) => el.remove());

  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.setAttribute('role', type === 'danger' ? 'alert' : 'status');

  const actionHtml = action
    ? `<button type="button" class="toast__action" data-toast-action>${esc(action.label)}</button>`
    : '';

  node.innerHTML = `
    <span class="toast__icon">${icon(ICON_MAP[type] || 'info', 16)}</span>
    <span class="toast__text">${esc(message)}</span>
    ${actionHtml}
  `;

  if (action) {
    node.querySelector('[data-toast-action]')?.addEventListener('click', () => {
      remove();
      action.onClick?.();
    });
  }

  root.appendChild(node);

  let timer = null;
  if (duration > 0) timer = setTimeout(remove, duration);

  function remove() {
    if (timer) clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 220);
  }

  return remove;
}

export const toastOk = (message, options = {}) => toast(message, { ...options, type: 'ok' });
export const toastWarn = (message, options = {}) => toast(message, { ...options, type: 'warn' });
export const toastError = (message, options = {}) => toast(message, { ...options, type: 'danger' });
export const toastInfo = (message, options = {}) => toast(message, { ...options, type: 'info' });
