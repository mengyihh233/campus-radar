/**
 * ui/auth.js — 登录 / 注册
 *
 * 评审可以直接用演示账号一键进入两种角色，观察完整的审核闭环；
 * 也可以自己注册新账号。管理员身份需要邀请码。
 */

import { state } from '../core/store.js';
import { icon } from './icons.js';
import { esc, qs, delegate, lockScroll, unlockScroll, trapFocus } from './dom.js';
import { toastError } from './toast.js';

let mode = 'login';

function demoBlock() {
  const accounts = state.demoAccounts;
  if (!accounts || !accounts.length) return '';

  return `
    <div class="demo-accounts">
      <div class="demo-accounts__head">${icon('key', 12)}演示账号（点击直接填入）</div>
      <div class="demo-accounts__list">
        ${accounts
          .map(
            (acc) => `
          <button
            type="button"
            class="demo-account"
            data-action="fill-demo"
            data-username="${esc(acc.username)}"
            data-password="${esc(acc.password)}"
          >
            <span class="demo-account__role demo-account__role--${esc(acc.role)}">
              ${esc(acc.role === 'admin' ? '管理端' : '学生端')}
            </span>
            <span class="demo-account__name">${esc(acc.displayName)}</span>
            <span class="demo-account__cred mono">${esc(acc.username)} / ${esc(acc.password)}</span>
          </button>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function formHtml() {
  const isLogin = mode === 'login';

  return `
    <div class="tabs auth-tabs" role="tablist">
      <button
        type="button"
        class="tab"
        role="tab"
        data-action="switch-mode"
        data-value="login"
        aria-selected="${isLogin}"
      >登录</button>
      <button
        type="button"
        class="tab"
        role="tab"
        data-action="switch-mode"
        data-value="register"
        aria-selected="${!isLogin}"
      >注册</button>
    </div>

    <form class="auth-form" id="auth-form" novalidate>
      <div class="field">
        <label class="field__label" for="auth-username">用户名</label>
        <input id="auth-username" name="username" class="input" autocomplete="username" placeholder="2—20 位中文、字母、数字或下划线" />
      </div>

      ${
        isLogin
          ? ''
          : `<div class="field">
               <label class="field__label" for="auth-display">显示名称</label>
               <input id="auth-display" name="displayName" class="input" maxlength="24" placeholder="例如：2026级 张同学" />
             </div>`
      }

      <div class="field">
        <label class="field__label" for="auth-password">密码</label>
        <input id="auth-password" name="password" type="password" class="input" autocomplete="${
          isLogin ? 'current-password' : 'new-password'
        }" placeholder="至少 6 位" />
      </div>

      ${
        isLogin
          ? ''
          : `<div class="field">
               <label class="field__label" for="auth-admin-code">管理员邀请码</label>
               <input id="auth-admin-code" name="adminCode" class="input" placeholder="留空则注册为学生账号" />
               <span class="field__hint">仅学院 / 学工处老师需要填写。学生请留空。</span>
             </div>`
      }

      <div id="auth-error" class="field__error" hidden></div>

      <button type="submit" class="btn btn--primary btn--block">
        ${icon(isLogin ? 'logout' : 'user', 14)}
        <span>${isLogin ? '登录' : '创建账号'}</span>
      </button>
    </form>

    ${isLogin ? demoBlock() : ''}
  `;
}

/**
 * 打开登录/注册弹层
 * @param {object} handlers { onLogin(credentials), onRegister(payload) }
 */
export function openAuthModal(handlers) {
  const root = qs('#drawer-root');
  mode = 'login';

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-layer';

  const paint = () => {
    wrapper.innerHTML = `
      <div class="drawer-scrim is-open" data-action="close-auth"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header class="modal__head">
          <h3 class="modal__title" id="auth-title" style="font-size:15px">
            Campus Radar · ${mode === 'login' ? '登录' : '注册'}
          </h3>
          <button type="button" class="btn btn--icon" data-action="close-auth" aria-label="关闭">
            ${icon('x', 16)}
          </button>
        </header>
        <div class="modal__body">${formHtml()}</div>
      </div>
    `;
  };

  paint();
  root.appendChild(wrapper);
  lockScroll();

  let releaseTrap = trapFocus(wrapper.querySelector('.modal'));

  const close = () => {
    releaseTrap();
    unlockScroll();
    wrapper.remove();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      document.removeEventListener('keydown', onKeydown);
      close();
    }
  };
  document.addEventListener('keydown', onKeydown);

  const showError = (message) => {
    const node = wrapper.querySelector('#auth-error');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
  };

  delegate(wrapper, 'click', async (event, action, trigger) => {
    if (action === 'close-auth') {
      document.removeEventListener('keydown', onKeydown);
      close();
      return;
    }

    if (action === 'switch-mode') {
      mode = trigger.dataset.value;
      showError('');
      paint();
      releaseTrap();
      releaseTrap = trapFocus(wrapper.querySelector('.modal'));
      wrapper.querySelector('#auth-username')?.focus();
      return;
    }

    if (action === 'fill-demo') {
      const username = trigger.dataset.username;
      const password = trigger.dataset.password;
      paint();
      releaseTrap();
      releaseTrap = trapFocus(wrapper.querySelector('.modal'));
      wrapper.querySelector('#auth-username').value = username;
      wrapper.querySelector('#auth-password').value = password;
      wrapper.querySelector('#auth-form')?.requestSubmit();
    }
  });

  wrapper.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = wrapper.querySelector('#auth-username')?.value.trim() || '';
    const password = wrapper.querySelector('#auth-password')?.value || '';

    if (!username || !password) {
      showError('请填写用户名和密码');
      return;
    }
    if (password.length < 6) {
      showError('密码至少需要 6 位');
      return;
    }

    const submitBtn = wrapper.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '处理中…';
    }

    try {
      if (mode === 'login') {
        await handlers.onLogin?.({ username, password });
      } else {
        const displayName = wrapper.querySelector('#auth-display')?.value.trim() || '';
        const adminCode = wrapper.querySelector('#auth-admin-code')?.value.trim() || '';
        await handlers.onRegister?.({ username, password, displayName, adminCode });
      }
      document.removeEventListener('keydown', onKeydown);
      close();
    } catch (error) {
      showError(error?.message || '操作失败，请重试');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon(mode === 'login' ? 'logout' : 'user', 14)}<span>${
          mode === 'login' ? '登录' : '创建账号'
        }</span>`;
      }
    }
  });

  wrapper.querySelector('#auth-username')?.focus();
  return close;
}

export function requireAuth(message = '这个操作需要先登录') {
  toastError(message);
}
