/**
 * ui/review.js — 管理端审核台
 *
 * 审核队列不只是一串标题：每条投稿都带着机器预检结果
 * （完整度得分、命中的风险规则、疑似重复项），
 * 管理员是在「带着证据的判断」基础上做决定，而不是从零读一遍文本。
 *
 * 三个决定都会留下理由，并写入审计日志：
 *   通过 / 要求补充 / 驳回
 */

import { state, setUI } from '../core/store.js';
import { icon } from './icons.js';
import { esc, qs, delegate, lockScroll, unlockScroll, trapFocus } from './dom.js';
import { stamp } from '../core/time.js';
import { statusBadge, sourceBadge, emptyState } from './card.js';
import { decorateAll } from '../core/derive.js';

let activeTab = 'pending';

export function setReviewTab(tab) {
  activeTab = tab;
}

export function getReviewTab() {
  return activeTab;
}

/* ==========================================================================
 * 决策弹层
 * ========================================================================== */

/**
 * 打开决策弹层
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.lead
 * @param {boolean} options.requireNote
 * @param {string} options.placeholder
 * @param {string} options.confirmLabel
 * @param {string} options.tone 'primary' | 'danger'
 * @param {(note:string) => Promise<void>} options.onConfirm
 */
export function openDecisionModal(options) {
  const root = qs('#drawer-root');
  const {
    title,
    lead,
    requireNote = false,
    placeholder = '',
    confirmLabel = '确认',
    tone = 'primary',
    onConfirm,
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-layer';
  wrapper.innerHTML = `
    <div class="drawer-scrim is-open" data-action="close-modal"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <header class="modal__head">
        <h3 class="modal__title" id="decision-title">${esc(title)}</h3>
        <button type="button" class="btn btn--icon" data-action="close-modal" aria-label="关闭">
          ${icon('x', 16)}
        </button>
      </header>
      <div class="modal__body">
        <p class="modal__lead">${esc(lead)}</p>
        <div class="field">
          <label class="field__label" for="decision-note">
            处理意见${requireNote ? ' <span class="field__req">*</span>' : '（选填）'}
          </label>
          <textarea id="decision-note" class="textarea" maxlength="300" placeholder="${esc(placeholder)}"></textarea>
          <span class="field__hint">这段说明会展示给发布者，请写清楚原因与改进方向。</span>
        </div>
      </div>
      <footer class="modal__foot">
        <button type="button" class="btn" data-action="close-modal">取消</button>
        <button type="button" class="btn btn--${tone}" data-action="confirm" ${requireNote ? 'disabled' : ''}>
          ${esc(confirmLabel)}
        </button>
      </footer>
    </div>
  `;

  root.appendChild(wrapper);
  lockScroll();

  const modal = wrapper.querySelector('.modal');
  const releaseTrap = trapFocus(modal);
  const noteInput = wrapper.querySelector('#decision-note');
  const confirmBtn = wrapper.querySelector('[data-action="confirm"]');

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

  if (requireNote) {
    noteInput.addEventListener('input', () => {
      confirmBtn.disabled = noteInput.value.trim().length === 0;
    });
  }

  delegate(wrapper, 'click', async (event, action) => {
    if (action === 'close-modal') {
      document.removeEventListener('keydown', onKeydown);
      close();
      return;
    }
    if (action === 'confirm') {
      const note = noteInput.value.trim();
      if (requireNote && !note) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '处理中…';
      try {
        await onConfirm(note);
        document.removeEventListener('keydown', onKeydown);
        close();
      } catch {
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmLabel;
      }
    }
  });

  noteInput.focus();
  return close;
}

/* ==========================================================================
 * 审核条目
 * ========================================================================== */

function checkSummary(item) {
  const check = item.reviewCheck;
  if (!check) {
    return `<span class="field__hint">这条信息提交时未记录质检结果。</span>`;
  }

  const chips = [];

  chips.push(
    `<span class="badge ${
      check.level === 'danger' ? 'badge--danger' : check.level === 'good' ? 'badge--ok' : 'badge--warn'
    }">质检 ${check.score}</span>`
  );

  if (check.risks?.length) {
    chips.push(`<span class="badge badge--danger">${icon('shield-alert', 11)}风险 ${check.risks.length}</span>`);
  }
  if (check.missing?.length) {
    chips.push(`<span class="badge badge--warn">${icon('help', 11)}缺失 ${check.missing.length}</span>`);
  }
  if (check.duplicates?.length) {
    chips.push(`<span class="badge badge--warn">${icon('layers', 11)}疑似重复 ${check.duplicates.length}</span>`);
  }
  if (!check.risks?.length && !check.missing?.length && !check.duplicates?.length) {
    chips.push(`<span class="badge badge--ok">${icon('check', 11)}未发现问题</span>`);
  }

  const detail = [];

  for (const r of check.risks || []) {
    detail.push(
      `<div class="quality__issue quality__issue--${r.severity === 'danger' ? 'danger' : 'warn'}">
         <span class="quality__issue-icon">${icon(r.severity === 'danger' ? 'shield-alert' : 'alert', 13)}</span>
         <span class="quality__issue-text">${esc(r.label)}：${esc(r.hint)}</span>
       </div>`
    );
  }
  for (const m of check.missing || []) {
    detail.push(
      `<div class="quality__issue quality__issue--warn">
         <span class="quality__issue-icon">${icon('help', 13)}</span>
         <span class="quality__issue-text">缺少「${esc(m)}」</span>
       </div>`
    );
  }
  for (const d of check.duplicates || []) {
    detail.push(
      `<div class="quality__issue quality__issue--warn">
         <span class="quality__issue-icon">${icon('layers', 13)}</span>
         <span class="quality__issue-text">与「${esc(d.title)}」相似度 ${d.similarity}%</span>
       </div>`
    );
  }

  return `
    <div class="review-chips">${chips.join('')}</div>
    ${detail.length ? `<div class="quality__list" style="margin-top:10px">${detail.join('')}</div>` : ''}
  `;
}

function reviewCard(item, ctx) {
  const decorated = decorateAll([item], ctx.now)[0];
  const isPending = item.reviewStatus === 'pending';
  const isNeedsInfo = item.reviewStatus === 'needs_info';

  const actions = [];

  if (isPending || isNeedsInfo) {
    actions.push(
      `<button type="button" class="btn btn--primary btn--sm" data-action="approve" data-id="${esc(item.id)}">${icon('check', 13)}<span>通过</span></button>`,
      `<button type="button" class="btn btn--sm" data-action="needs-info" data-id="${esc(item.id)}">${icon('help', 13)}<span>要求补充</span></button>`,
      `<button type="button" class="btn btn--danger btn--sm" data-action="reject" data-id="${esc(item.id)}">${icon('x', 13)}<span>驳回</span></button>`
    );
  } else if (item.reviewStatus === 'approved') {
    actions.push(
      `<button type="button" class="btn btn--danger btn--sm" data-action="remove" data-id="${esc(item.id)}">${icon('trash', 13)}<span>下架</span></button>`
    );
  } else if (item.reviewStatus === 'rejected' || item.reviewStatus === 'removed') {
    actions.push(
      `<button type="button" class="btn btn--sm" data-action="restore" data-id="${esc(item.id)}">${icon('refresh', 13)}<span>恢复上架</span></button>`
    );
  }

  actions.push(
    `<button type="button" class="btn btn--sm btn--ghost" data-action="open" data-id="${esc(item.id)}">${icon('eye', 13)}<span>查看详情</span></button>`
  );

  return `
    <article class="review-card${state.ui.animate === false ? '' : ' enter'}" style="--state-color:${esc(
      decorated._status.color
    )}">
      <div class="review-card__head">
        <div class="card__badges">
          ${statusBadge(decorated)}
          ${sourceBadge(decorated)}
          <span class="badge badge--muted">${esc(decorated._category.label)}</span>
          ${
            decorated._review && !isPending
              ? `<span class="badge badge--muted">${esc(decorated._review.label)}</span>`
              : ''
          }
        </div>
      </div>

      <h3 class="review-card__title">${esc(item.title)}</h3>
      <p class="review-card__summary">${esc(item.summary || '（未填写说明）')}</p>

      <div class="review-card__meta">
        <span>${icon('user', 12)}${esc(item.authorName || '未知')}</span>
        <span>${icon('clock', 12)}提交于 ${esc(item.createdAt ? stamp(item.createdAt) : '未知')}</span>
        ${item.authorEditedAt ? `<span>${icon('edit', 12)}修改于 ${esc(stamp(item.authorEditedAt))}</span>` : ''}
      </div>

      <div class="review-card__check">${checkSummary(item)}</div>

      <div class="review-card__actions">${actions.join('')}</div>
    </article>
  `;
}

/* ==========================================================================
 * 举报条目
 * ========================================================================== */

function reportCard(report, ctx) {
  const target = state.activities.find((a) => a.id === report.activityId);
  const statusMap = {
    pending: { label: '待处理', tone: 'warn' },
    resolved: { label: '已处理', tone: 'ok' },
    dismissed: { label: '已忽略', tone: 'muted' },
  };
  const status = statusMap[report.status] || statusMap.pending;

  return `
    <article class="review-card">
      <div class="review-card__head">
        <div class="card__badges">
          <span class="badge badge--${status.tone}">${esc(status.label)}</span>
          <span class="badge badge--danger">${icon('flag', 11)}${esc(report.reasonLabel)}</span>
        </div>
      </div>

      <h3 class="review-card__title">${esc(report.activityTitle)}</h3>
      ${
        report.detail
          ? `<p class="review-card__summary">举报说明：${esc(report.detail)}</p>`
          : ''
      }

      <div class="review-card__meta">
        <span>${icon('user', 12)}${esc(report.reporterName)}</span>
        <span>${icon('clock', 12)}${esc(stamp(report.createdAt))}</span>
        ${report.resolverName ? `<span>${icon('shield-check', 12)}由 ${esc(report.resolverName)} 处理</span>` : ''}
      </div>

      <div class="review-card__actions">
        ${
          target
            ? `<button type="button" class="btn btn--sm" data-action="open" data-id="${esc(report.activityId)}">${icon('eye', 13)}<span>查看被举报内容</span></button>`
            : `<span class="field__hint">被举报的内容已被删除</span>`
        }
        ${
          report.status === 'pending'
            ? `
              <button type="button" class="btn btn--primary btn--sm" data-action="resolve-report" data-id="${esc(report.id)}">${icon('check', 13)}<span>举报成立</span></button>
              <button type="button" class="btn btn--sm" data-action="dismiss-report" data-id="${esc(report.id)}">${icon('x', 13)}<span>忽略</span></button>
            `
            : ''
        }
      </div>
    </article>
  `;
}

/* ==========================================================================
 * 视图
 * ========================================================================== */

export function reviewView() {
  const ctx = { now: state.ui.now };
  const all = state.activities;

  const pending = all.filter((a) => a.reviewStatus === 'pending');
  const needsInfo = all.filter((a) => a.reviewStatus === 'needs_info');
  const userPosts = all.filter((a) => a.origin === 'user');
  const pendingReports = state.reports.filter((r) => r.status === 'pending');

  const tabs = [
    { key: 'pending', label: '待审核', count: pending.length, icon: 'clock' },
    { key: 'needs_info', label: '需补充', count: needsInfo.length, icon: 'help' },
    { key: 'posts', label: '全部投稿', count: userPosts.length, icon: 'file' },
    { key: 'reports', label: '举报', count: pendingReports.length, icon: 'flag' },
  ];

  let items = [];
  if (activeTab === 'pending') items = pending;
  else if (activeTab === 'needs_info') items = needsInfo;
  else if (activeTab === 'posts') {
    items = [...userPosts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  const listHtml =
    activeTab === 'reports'
      ? state.reports.length
        ? state.reports
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((r) => reportCard(r, ctx))
            .join('')
        : emptyState({ title: '没有举报记录', text: '同学提交的举报会出现在这里。' })
      : items.length
        ? items.map((item) => reviewCard(item, ctx)).join('')
        : emptyState({
            title:
              activeTab === 'pending'
                ? '队列已清空'
                : activeTab === 'needs_info'
                  ? '没有等待补充的投稿'
                  : '还没有同学投稿',
            text:
              activeTab === 'pending'
                ? '当前没有待审核的投稿。新的投稿会实时出现在这里。'
                : '这里会列出需要发布者补充材料的投稿。',
          });

  return `
    <div class="tabs" role="tablist">
      ${tabs
        .map(
          (tab) => `
        <button
          type="button"
          class="tab"
          role="tab"
          data-action="review-tab"
          data-value="${esc(tab.key)}"
          aria-selected="${activeTab === tab.key}"
        >
          ${icon(tab.icon, 13)}<span>${esc(tab.label)}</span>
          <span class="tab__count">${tab.count}</span>
        </button>
      `
        )
        .join('')}
    </div>

    <div class="review-list">${listHtml}</div>
  `;
}
