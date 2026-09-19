/**
 * ui/detail.js — 信息详情抽屉
 *
 * 详情页承担「把一条信息读明白」的全部职责：
 *   状态结论 → 风险提示 → 更新记录 → 结构化字段 → 缺失项 → 关键提醒 → 原文
 * 顺序刻意如此：先给结论与警告，再给细节，最后给可核对的原始材料。
 */

import { esc, qs, delegate, lockScroll, unlockScroll, trapFocus } from './dom.js';
import { icon } from './icons.js';
import { formatFull, formatDate, stamp } from '../core/time.js';
import { statusBadge, sourceBadge } from './card.js';
import { REPORT_REASONS } from '../data/taxonomy.js';

let current = null;

/* ==========================================================================
 * 小组件
 * ========================================================================== */

function callout(tone, iconName, title, text) {
  return `
    <div class="callout callout--${tone}">
      <span class="callout__icon">${icon(iconName, 15)}</span>
      <div class="callout__body">
        ${title ? `<span class="callout__title">${esc(title)}</span>` : ''}
        <span class="callout__text">${esc(text)}</span>
      </div>
    </div>
  `;
}

function defRow(key, value, weak = false) {
  const display = value === null || value === undefined || value === '' ? '未注明' : value;
  return `
    <div class="deflist__row">
      <span class="deflist__key">${esc(key)}</span>
      <span class="deflist__val${weak || display === '未注明' ? ' deflist__val--weak' : ''}">${esc(
        display
      )}</span>
    </div>
  `;
}

function section(title, inner) {
  if (!inner) return '';
  return `
    <div class="section">
      <div class="section__title">${esc(title)}</div>
      ${inner}
    </div>
  `;
}

/* ==========================================================================
 * 内容区块
 * ========================================================================== */

/** 状态结论区 */
function statusSection(item) {
  const status = item._status;
  const hint = item._hint;
  if (!hint) return '';

  const tone = hint.tone === 'danger' ? 'danger' : hint.tone === 'warn' ? 'warn' : 'info';
  const iconName = tone === 'danger' ? 'radio' : tone === 'warn' ? 'clock' : 'info';

  return callout(tone, iconName, status.label, hint.text);
}

/** 风险区 */
function riskSection(item) {
  if (!item.riskLevel) return '';

  const isDanger = item.riskLevel === 'danger';
  const flags = (item.riskFlags || []).map((f) => `<li>${esc(f)}</li>`).join('');

  const noticeHtml = (item.notices || [])
    .filter((n) => n.tone === 'danger')
    .map((n) => `<div class="callout__text" style="margin-top:8px">${esc(n.text)}</div>`)
    .join('');

  return `
    <div class="callout callout--${isDanger ? 'danger' : 'warn'}">
      <span class="callout__icon">${icon(isDanger ? 'shield-alert' : 'alert', 15)}</span>
      <div class="callout__body">
        <span class="callout__title">${
          isDanger ? '这条信息存在明显风险特征' : '这条信息有不确定的地方'
        }</span>
        <ul style="margin:8px 0 0;padding-left:16px;list-style:disc;color:var(--text-2);font-size:12px;line-height:1.8">
          ${flags}
        </ul>
        ${noticeHtml}
      </div>
    </div>
  `;
}

/** 更新记录区（修订链） */
function revisionSection(item) {
  const revision = item._revision;
  if (!revision || !revision.hasChanges) return '';

  const log = revision.changeLog
    .map(
      (text, i) =>
        `<div class="changelog__item"><span class="changelog__num">${String(i + 1).padStart(
          2,
          '0'
        )}</span><span>${esc(text)}</span></div>`
    )
    .join('');

  const rawHtml = revision.noticeRaw
    ? `<div class="raw-text"><span class="raw-text__label">补充通知原文（编号 ${esc(
        revision.noticeId
      )}）</span>${esc(revision.noticeRaw)}</div>`
    : '';

  return section(
    '信息更新记录',
    `
      ${callout(
        'teal',
        'layers',
        `本条已被「${revision.noticeTitle}」更新`,
        '下方列出的是最终生效的内容，请以这里为准，不要参考更早的通知。'
      )}
      <div class="changelog">${log}</div>
      ${rawHtml}
    `
  );
}

/** 基本信息 */
function infoSection(item) {
  const rows = [
    defRow('活动时间', item._time || item.timeText),
    defRow('报名截止', item.deadlineText),
    defRow('活动地点', item.place || item.placeText),
    defRow('面向对象', item.audienceText),
    defRow('参与条件', item.requirement),
    defRow('时间投入', item.commitment),
  ];

  if (item.capacityText || item.capacity) {
    rows.push(defRow('名额', item.capacityText || `限 ${item.capacity} 人`));
  }
  if (item.contact) {
    rows.push(defRow('报名方式', item.contact));
  }
  if (item.publisher) {
    rows.push(defRow('发布单位', item.publisher));
  }

  return section('基本信息', `<div class="deflist">${rows.join('')}</div>`);
}

/** 阶段节点（多阶段赛事） */
function milestoneSection(item) {
  if (!Array.isArray(item.milestones) || !item.milestones.length) return '';
  const rows = item.milestones
    .map((m) => defRow(m.label, formatFull(m.at)))
    .join('');
  return section('关键节点', `<div class="deflist">${rows}</div>`);
}

/** 关键提醒 */
function noticeSection(item) {
  const notices = (item.notices || []).filter((n) => n.tone !== 'danger');
  if (!notices.length) return '';

  const html = notices
    .map((n) => {
      const tone = n.tone === 'warn' ? 'warn' : n.tone === 'teal' ? 'teal' : 'info';
      const iconName = tone === 'warn' ? 'alert' : tone === 'teal' ? 'layers' : 'info';
      return callout(tone, iconName, null, n.text);
    })
    .join('');

  return section('需要注意', html);
}

/** 缺失字段 */
function missingSection(item) {
  const missing = item.missing || [];
  if (!missing.length) return '';

  const tags = missing.map((m) => `<span class="missing-tag">${icon('help', 11)}${esc(m)}</span>`).join('');

  return section(
    '材料中未提供的信息',
    `
      ${callout(
        'warn',
        'help',
        '以下信息在原始材料中没有给出',
        '这些是判断能不能参加、去了会不会白跑的关键项。我们不做推测，建议直接向发布方确认。'
      )}
      <div class="missing-list">${tags}</div>
    `
  );
}

/** 审核信息 */
function reviewSection(item, ctx) {
  const isOwner = ctx.viewer && item.authorId === ctx.viewer.id;
  const isAdmin = ctx.role === 'admin';
  if (!item.reviewStatus || (!isOwner && !isAdmin)) return '';

  const review = item._review;
  const rows = [
    defRow('发布来源', item.origin === 'seed' ? '内置信息' : '用户发布'),
    defRow('当前状态', review ? review.label : '未知'),
    defRow('提交时间', item.createdAt ? stamp(item.createdAt) : ''),
  ];

  if (item.reviewedAt) {
    rows.push(defRow('处理时间', stamp(item.reviewedAt)));
  }
  if (item.reviewerName) {
    rows.push(defRow('处理人', item.reviewerName));
  }
  if (item.reviewNote) {
    rows.push(defRow('处理意见', item.reviewNote));
  }

  const check = item.reviewCheck;
  const checkHtml =
    check && isAdmin
      ? callout(
          'info',
          'clipboard',
          `系统预检得分 ${check.score} / 100`,
          [
            check.risks.length ? `命中风险项 ${check.risks.length} 条` : '未命中风险规则',
            check.missing.length ? `缺失字段 ${check.missing.length} 项` : '必填字段完整',
            check.duplicates?.length ? `疑似重复 ${check.duplicates.length} 条` : '未发现重复',
          ].join(' · ')
        )
      : '';

  return section('发布与审核', `<div class="deflist">${rows.join('')}</div>${checkHtml}`);
}

/** 原文 */
function rawSection(item) {
  if (!item.raw) return '';
  return section(
    '原始材料',
    `<div class="raw-text"><span class="raw-text__label">编号 ${esc(item.id)} · 原文</span>${esc(
      item.raw
    )}</div>`
  );
}

/* ==========================================================================
 * 底部操作
 * ========================================================================== */

function footerActions(item, ctx) {
  const buttons = [];
  const faved = ctx.favorites.includes(item.id);

  if (ctx.role !== 'guest') {
    buttons.push(`
      <button type="button" class="btn ${faved ? 'btn--primary' : ''}" data-action="favorite" data-id="${esc(
        item.id
      )}">
        ${icon('star', 14)}<span>${faved ? '已在清单中' : '加入我的清单'}</span>
      </button>
    `);

    if (item.source === 'student' || item.origin === 'user') {
      buttons.push(`
        <button type="button" class="btn" data-action="report" data-id="${esc(item.id)}">
          ${icon('flag', 14)}<span>举报</span>
        </button>
      `);
    }
  } else {
    buttons.push(`
      <button type="button" class="btn btn--primary" data-action="need-auth">
        ${icon('user', 14)}<span>登录后可加入清单</span>
      </button>
    `);
  }

  const isOwner = ctx.viewer && item.authorId === ctx.viewer.id;
  if (isOwner && ['pending', 'needs_info', 'rejected'].includes(item.reviewStatus)) {
    buttons.push(`
      <button type="button" class="btn" data-action="edit-post" data-id="${esc(item.id)}">
        ${icon('edit', 14)}<span>修改</span>
      </button>
      <button type="button" class="btn btn--danger" data-action="delete-post" data-id="${esc(item.id)}">
        ${icon('trash', 14)}<span>删除</span>
      </button>
    `);
  }

  if (ctx.permissions?.reviewDecide && item.reviewStatus === 'pending') {
    buttons.push(`
      <button type="button" class="btn btn--primary" data-action="go-review" data-id="${esc(item.id)}">
        ${icon('clipboard', 14)}<span>去审核</span>
      </button>
    `);
  }

  return `<div class="drawer__foot">${buttons.join('')}</div>`;
}

/* ==========================================================================
 * 抽屉骨架
 * ========================================================================== */

function drawerHtml(item, ctx) {
  return `
    <div class="drawer-scrim" data-action="close-detail"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header class="drawer__head">
        <div class="drawer__head-main">
          <div class="drawer__badges">
            ${statusBadge(item)}
            ${sourceBadge(item)}
            <span class="badge badge--muted">${esc(item._category.label)}</span>
          </div>
          <h2 class="drawer__title" id="drawer-title">${esc(item.title)}</h2>
        </div>
        <button type="button" class="btn btn--icon drawer__close" data-action="close-detail" aria-label="关闭">
          ${icon('x', 16)}
        </button>
      </header>

      <div class="drawer__body">
        ${statusSection(item)}
        ${riskSection(item)}
        ${revisionSection(item)}
        ${infoSection(item)}
        ${milestoneSection(item)}
        ${noticeSection(item)}
        ${missingSection(item)}
        ${reviewSection(item, ctx)}
        ${rawSection(item)}
      </div>

      ${footerActions(item, ctx)}
    </aside>
  `;
}

/**
 * 打开详情抽屉
 * @param {object} item 已装饰的信息
 * @param {object} ctx { favorites, role, viewer, permissions, onAction }
 */
export function openDetail(item, ctx) {
  closeDetail();

  const root = qs('#drawer-root');
  root.innerHTML = drawerHtml(item, ctx);

  const scrim = root.querySelector('.drawer-scrim');
  const drawer = root.querySelector('.drawer');

  lockScroll();

  // 触发进场动画
  requestAnimationFrame(() => {
    scrim?.classList.add('is-open');
    drawer?.classList.add('is-open');
  });

  const releaseTrap = trapFocus(drawer);
  drawer?.focus?.();

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeDetail();
    }
  };
  document.addEventListener('keydown', onKeydown);

  const offClick = delegate(root, 'click', (event, action, trigger) => {
    switch (action) {
      case 'close-detail':
        closeDetail();
        break;
      case 'favorite':
        ctx.onAction?.('favorite', item.id);
        break;
      case 'report':
        ctx.onAction?.('report', item.id);
        break;
      case 'need-auth':
        ctx.onAction?.('need-auth', item.id);
        break;
      case 'edit-post':
        ctx.onAction?.('edit-post', item.id);
        break;
      case 'delete-post':
        ctx.onAction?.('delete-post', item.id);
        break;
      case 'go-review':
        ctx.onAction?.('go-review', item.id);
        break;
      default:
        break;
    }
  });

  current = {
    item,
    cleanup() {
      document.removeEventListener('keydown', onKeydown);
      offClick();
      releaseTrap();
      unlockScroll();
      current = null;
    },
  };

  return current;
}

export function closeDetail() {
  const root = qs('#drawer-root');
  if (!root || !current) {
    if (root) root.innerHTML = '';
    return;
  }

  const drawer = root.querySelector('.drawer');
  const scrim = root.querySelector('.drawer-scrim');
  scrim?.classList.remove('is-open');
  drawer?.classList.remove('is-open');

  const payload = current;
  setTimeout(() => {
    payload.cleanup();
    root.innerHTML = '';
  }, 340);
}

export function isDetailOpen() {
  return Boolean(current);
}

/* ==========================================================================
 * 举报弹层
 * ========================================================================== */

/**
 * 打开举报表单
 * @param {object} item
 * @param {(payload:{reason:string, detail:string}) => Promise<void>} onSubmit
 */
export function openReport(item, onSubmit) {
  const root = qs('#drawer-root');

  const options = REPORT_REASONS.map(
    (r) => `
      <label class="radio-row">
        <input type="radio" name="report-reason" value="${esc(r.key)}" />
        <span class="radio-row__label">${esc(r.label)}</span>
      </label>
    `
  ).join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-layer';
  wrapper.innerHTML = `
    <div class="drawer-scrim is-open" data-action="close-report"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <header class="modal__head">
        <h3 class="modal__title" id="report-title">举报这条信息</h3>
        <button type="button" class="btn btn--icon" data-action="close-report" aria-label="关闭">
          ${icon('x', 16)}
        </button>
      </header>
      <div class="modal__body">
        <p class="modal__lead">${esc(item.title)}</p>
        <div class="field">
          <span class="field__label">举报原因 <span class="field__req">*</span></span>
          <div class="radio-list">${options}</div>
        </div>
        <div class="field" style="margin-top:16px">
          <label class="field__label" for="report-detail">补充说明（选填）</label>
          <textarea id="report-detail" class="textarea" maxlength="200" placeholder="描述你发现的具体问题，有助于管理员判断"></textarea>
          <span class="field__hint">最多 200 字</span>
        </div>
        <div class="callout callout--info" style="margin-top:16px">
          <span class="callout__icon">${icon('info', 15)}</span>
          <div class="callout__body">
            <span class="callout__text">举报会进入管理员处理队列，处理结果不会公开举报人身份。</span>
          </div>
        </div>
      </div>
      <footer class="modal__foot">
        <button type="button" class="btn" data-action="close-report">取消</button>
        <button type="button" class="btn btn--primary" data-action="submit-report" disabled>提交举报</button>
      </footer>
    </div>
  `;

  root.appendChild(wrapper);
  lockScroll();

  const modal = wrapper.querySelector('.modal');
  const releaseTrap = trapFocus(modal);
  let reason = null;

  const submitBtn = wrapper.querySelector('[data-action="submit-report"]');
  const detailInput = wrapper.querySelector('#report-detail');

  wrapper.addEventListener('change', (event) => {
    if (event.target.name === 'report-reason') {
      reason = event.target.value;
      submitBtn.disabled = false;
    }
  });

  detailInput?.addEventListener('input', () => {
    const counter = detailInput.parentElement.querySelector('.field__hint');
    if (counter) counter.textContent = `${detailInput.value.length} / 200 字`;
  });

  const close = () => {
    releaseTrap();
    unlockScroll();
    wrapper.remove();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKeydown);

  delegate(wrapper, 'click', async (event, action) => {
    if (action === 'close-report') {
      document.removeEventListener('keydown', onKeydown);
      close();
      return;
    }
    if (action === 'submit-report') {
      if (!reason) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '提交中…';
      try {
        await onSubmit({ reason, detail: detailInput?.value || '' });
        document.removeEventListener('keydown', onKeydown);
        close();
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交举报';
      }
    }
  });

  return close;
}

export { callout, defRow, section };
