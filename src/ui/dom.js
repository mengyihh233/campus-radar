/**
 * ui/dom.js — 极简 DOM 工具
 *
 * 采用「字符串模板 + 事件委托」而非虚拟 DOM：
 * 本应用是数据密集型列表，渲染规模可控（数十条），
 * 这样能保持零依赖与可读性。
 *
 * ⚠️ 所有用户可控内容必须经过 esc() 转义。用户发布的信息会直接进入列表，
 *    这是本应用唯一的 XSS 面，务必不要绕过。
 */

/** HTML 转义 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/** 设置元素内容 */
export function render(target, html) {
  if (typeof target === 'string') target = qs(target);
  if (!target) return null;
  target.innerHTML = html;
  return target;
}

/**
 * 事件委托：在容器上挂一次监听，通过 data-action 分发。
 * 避免每次重渲染都要重新绑定大量监听器。
 */
export function delegate(root, eventName, handler) {
  if (typeof root === 'string') root = qs(root);
  if (!root) return () => {};
  const listener = (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !root.contains(trigger)) return;
    handler(event, trigger.dataset.action, trigger);
  };
  root.addEventListener(eventName, listener);
  return () => root.removeEventListener(eventName, listener);
}

/** 判断是否在移动端断点 */
export function isMobile() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

/** 是否偏好减少动效 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 焦点陷阱：用于抽屉/弹层 */
export function trapFocus(container) {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = qsa(selector, container).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

/** 滚动锁定（打开抽屉时防止背景滚动） */
let lockCount = 0;
export function lockScroll() {
  lockCount += 1;
  document.body.style.overflow = 'hidden';
}
export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}

/** 把时间戳格式化成 input[type=datetime-local] 需要的格式 */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

/** 防抖 */
export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
