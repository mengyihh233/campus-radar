/**
 * ui/publish.js — 发布信息
 *
 * 两种身份、两条路径：
 *   管理端 → 可选「校方」或「学院」层级，直接上架
 *   学生端 → 固定为同学发布，提交后进入待审核队列
 *
 * 表单右侧是实时质检面板：在提交之前就把问题指出来，
 * 让发布者自己先改一遍，而不是等管理员驳回。
 */

import { state, setUI } from '../core/store.js';
import { evaluateSubmission } from '../core/scan.js';
import { icon } from './icons.js';
import { esc, qs, delegate, toLocalInput } from './dom.js';
import { CATEGORIES, CATEGORY_ORDER, AUDIENCES } from '../data/taxonomy.js';

let draft = emptyDraft();
let editingId = null;

function emptyDraft() {
  return {
    title: '',
    category: 'interest',
    summary: '',
    start: '',
    end: '',
    place: '',
    deadline: '',
    audience: 'all',
    audienceText: '',
    requirement: '',
    commitment: '',
    capacity: '',
    contact: '',
    raw: '',
    source: 'school',
    publisher: '',
  };
}

/** 从已有信息初始化草稿（编辑模式） */
export function startEdit(item) {
  editingId = item.id;
  draft = {
    title: item.title || '',
    category: item.category || 'other',
    summary: item.summary || '',
    start: toLocalInput(item.start),
    end: toLocalInput(item.end),
    place: item.place || '',
    deadline: toLocalInput(item.deadline),
    audience: item.audience || 'all',
    audienceText: item.audienceText || '',
    requirement: item.requirement || '',
    commitment: item.commitment || '',
    capacity: item.capacity ? String(item.capacity) : '',
    contact: item.contact || '',
    raw: item.raw || '',
    source: item.source === 'college' ? 'college' : 'school',
    publisher: item.publisher || '',
  };
  setUI({ view: 'publish' });
}

export function resetDraft() {
  draft = emptyDraft();
  editingId = null;
}

export function isEditing() {
  return Boolean(editingId);
}

/* ==========================================================================
 * 表单
 * ========================================================================== */

function selectOptions(map, order, value) {
  const keys = order || Object.keys(map);
  return keys
    .map(
      (key) =>
        `<option value="${esc(key)}" ${value === key ? 'selected' : ''}>${esc(map[key].label || map[key])}</option>`
    )
    .join('');
}

function formHtml() {
  const isAdmin = state.role === 'admin';

  return `
    <form class="form-panel" id="publish-form" novalidate>
      <div class="form-grid">
        <div class="field field--full">
          <label class="field__label" for="f-title">活动名称 <span class="field__req">*</span></label>
          <input id="f-title" name="title" class="input" maxlength="60" placeholder="例如：数据结构期末复习互助小组" value="${esc(
            draft.title
          )}" />
          <span class="field__hint">写清楚「是什么活动」，不要只写「通知」</span>
        </div>

        <div class="field">
          <label class="field__label" for="f-category">信息类别 <span class="field__req">*</span></label>
          <select id="f-category" name="category" class="select">
            ${selectOptions(CATEGORIES, CATEGORY_ORDER, draft.category)}
          </select>
        </div>

        <div class="field">
          <label class="field__label" for="f-audience">面向对象</label>
          <select id="f-audience" name="audience" class="select">
            ${selectOptions(AUDIENCES, null, draft.audience)}
          </select>
          <span class="field__hint">新生的判断会依据这一项</span>
        </div>

        <div class="field field--full">
          <label class="field__label" for="f-summary">一句话说明 <span class="field__req">*</span></label>
          <textarea id="f-summary" name="summary" class="textarea" maxlength="400" placeholder="用一两句话讲清楚：做什么、什么时间、怎么参加">${esc(
            draft.summary
          )}</textarea>
          <span class="field__hint"><span id="summary-count">0</span> / 400 字</span>
        </div>

        <div class="field">
          <label class="field__label" for="f-start">活动开始时间 <span class="field__req">*</span></label>
          <input id="f-start" name="start" type="datetime-local" class="input" value="${esc(draft.start)}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-end">活动结束时间</label>
          <input id="f-end" name="end" type="datetime-local" class="input" value="${esc(draft.end)}" />
          <span class="field__hint">填了才能准确检测时间冲突</span>
        </div>

        <div class="field">
          <label class="field__label" for="f-place">活动地点</label>
          <input id="f-place" name="place" class="input" maxlength="60" placeholder="例如：实验楼 A402 / 线上" value="${esc(
            draft.place
          )}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-deadline">报名截止时间</label>
          <input id="f-deadline" name="deadline" type="datetime-local" class="input" value="${esc(
            draft.deadline
          )}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-requirement">参与条件</label>
          <input id="f-requirement" name="requirement" class="input" maxlength="200" placeholder="例如：零基础可参加" value="${esc(
            draft.requirement
          )}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-commitment">时间投入</label>
          <input id="f-commitment" name="commitment" class="input" maxlength="60" placeholder="例如：每周约 3 小时" value="${esc(
            draft.commitment
          )}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-capacity">名额限制</label>
          <input id="f-capacity" name="capacity" type="number" min="1" class="input" placeholder="留空表示不限" value="${esc(
            draft.capacity
          )}" />
        </div>

        <div class="field">
          <label class="field__label" for="f-contact">报名或咨询方式</label>
          <input id="f-contact" name="contact" class="input" maxlength="120" placeholder="例如：学院教务办 / 线下报名点" value="${esc(
            draft.contact
          )}" />
          <span class="field__hint">请填写公开渠道，不要引导到私人账号</span>
        </div>

        ${
          isAdmin
            ? `
          <div class="field">
            <label class="field__label" for="f-source">发布层级</label>
            <select id="f-source" name="source" class="select">
              <option value="school" ${draft.source === 'school' ? 'selected' : ''}>校方发布</option>
              <option value="college" ${draft.source === 'college' ? 'selected' : ''}>学院发布</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="f-publisher">发布单位</label>
            <input id="f-publisher" name="publisher" class="input" maxlength="30" placeholder="例如：计算机学院" value="${esc(
              draft.publisher
            )}" />
          </div>
        `
            : ''
        }

        <div class="field field--full">
          <label class="field__label" for="f-raw">补充说明</label>
          <textarea id="f-raw" name="raw" class="textarea" maxlength="800" placeholder="其他需要说明的内容，例如注意事项、需要携带的材料等">${esc(
            draft.raw
          )}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--primary" data-action="submit-post" id="submit-btn">
          ${icon('send', 14)}
          <span>${isAdmin ? '立即发布' : '提交审核'}</span>
        </button>
        <button type="button" class="btn" data-action="reset-form">清空</button>
        <span class="toolbar__spacer"></span>
        <span class="field__hint">
          ${
            isAdmin
              ? '管理端发布将直接上架，并记录到审计日志'
              : '提交后进入审核队列，通过后其他同学才能看到'
          }
        </span>
      </div>
    </form>
  `;
}

/* ==========================================================================
 * 质检面板
 * ========================================================================== */

function qualityHtml(check) {
  const levelClass = check.level === 'danger' ? 'is-bad' : check.level === 'good' ? '' : 'is-low';

  const issues = [];

  for (const risk of check.risks) {
    issues.push({
      tone: risk.severity === 'danger' ? 'danger' : 'warn',
      icon: risk.severity === 'danger' ? 'shield-alert' : 'alert',
      text: `${risk.label} —— ${risk.hint}`,
    });
  }

  for (const item of check.missing) {
    issues.push({
      tone: 'warn',
      icon: 'help',
      text: `缺少「${item}」`,
    });
  }

  for (const dup of check.duplicates) {
    issues.push({
      tone: 'warn',
      icon: 'layers',
      text: `与已有信息「${dup.title}」相似度 ${dup.similarity}%，可能重复`,
    });
  }

  for (const s of check.suggestions) {
    issues.push({ tone: 'warn', icon: 'info', text: s });
  }

  const issueHtml = issues.length
    ? issues
        .map(
          (i) => `
        <div class="quality__issue quality__issue--${i.tone}">
          <span class="quality__issue-icon">${icon(i.icon, 13)}</span>
          <span class="quality__issue-text">${esc(i.text)}</span>
        </div>
      `
        )
        .join('')
    : `<div class="quality__issue quality__issue--ok">
         <span class="quality__issue-icon">${icon('check', 13)}</span>
         <span class="quality__issue-text">必填项完整，未发现风险特征。</span>
       </div>`;

  return `
    <div class="quality__head">${icon('clipboard', 12)}投稿质检</div>
    <div class="quality__score">
      <span class="quality__score-num ${levelClass}">${check.score}</span>
      <span class="quality__score-label">/ 100 信息完整度</span>
    </div>
    <div class="quality__bar">
      <div class="quality__bar-fill ${levelClass}" style="transform:scaleX(${check.score / 100})"></div>
    </div>
    <div class="quality__list">${issueHtml}</div>
  `;
}

/* ==========================================================================
 * 视图
 * ========================================================================== */

export function publishView() {
  const isAdmin = state.role === 'admin';

  return `
    <div class="publish-layout">
      <div>
        <div class="section" style="margin-bottom:16px">
          <div class="section__title">${editingId ? '修改投稿' : '发布新信息'}</div>
        </div>
        ${
          isAdmin
            ? `<div class="callout callout--teal" style="margin-bottom:16px">
                 <span class="callout__icon">${icon('shield-check', 15)}</span>
                 <div class="callout__body">
                   <span class="callout__title">当前是管理端身份</span>
                   <span class="callout__text">你发布的内容会以「校方」或「学院」身份直接上架，请确保信息准确。</span>
                 </div>
               </div>`
            : `<div class="callout callout--info" style="margin-bottom:16px">
                 <span class="callout__icon">${icon('info', 15)}</span>
                 <div class="callout__body">
                   <span class="callout__title">同学发布需经审核</span>
                   <span class="callout__text">提交后会进入管理端审核队列，通过后其他同学才能看到。填写越完整，审核越快。</span>
                 </div>
               </div>`
        }
        ${formHtml()}
      </div>

      <aside class="quality" id="quality-panel">
        ${qualityHtml(evaluate())}
      </aside>
    </div>
  `;
}

/* ==========================================================================
 * 行为
 * ========================================================================== */

function currentExisting() {
  // 编辑时排除自身，否则会和自己比出 100% 相似
  return state.activities.filter((a) => a.id !== editingId);
}

function evaluate() {
  return evaluateSubmission(draft, { existing: currentExisting() });
}

function readForm(root) {
  const form = qs('#publish-form', root);
  if (!form) return {};

  const data = {};
  for (const element of form.elements) {
    if (!element.name) continue;
    data[element.name] = element.value;
  }
  return data;
}

/**
 * 绑定发布页
 * @param {HTMLElement} root
 * @param {object} handlers { onSubmit(draft, editingId), onNeedAuth() }
 */
export function bindPublish(root, handlers) {
  const form = qs('#publish-form', root);
  if (!form) return () => {};

  if (state.role === 'guest') {
    handlers.onNeedAuth?.();
    return () => {};
  }

  // 恢复编辑模式下的草稿到表单（视图重建后）
  syncFormFromDraft(form);

  const qualityPanel = qs('#quality-panel', root);
  const submitBtn = qs('#submit-btn', root);

  const refresh = () => {
    draft = { ...draft, ...readForm(root) };

    const check = evaluate();

    if (qualityPanel) qualityPanel.innerHTML = qualityHtml(check);

    // 含高危风险时禁止提交，并给出明确原因
    if (submitBtn) {
      submitBtn.disabled = check.blocker;
      submitBtn.title = check.blocker ? '内容包含高风险特征，请先修改' : '';
    }

    const counter = qs('#summary-count', root);
    if (counter) counter.textContent = String((draft.summary || '').length);
  };

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  const offClick = delegate(root, 'click', async (event, action) => {
    if (action === 'reset-form') {
      resetDraft();
      setUI({ view: 'publish' });
      return;
    }

    if (action === 'submit-post') {
      draft = { ...draft, ...readForm(root) };
      const check = evaluate();

      if (check.blocker) return;

      // 必填项缺失时直接拦下，避免制造垃圾审核单
      if (check.missing.some((m) => ['活动名称', '信息类别', '活动时间', '内容说明'].includes(m))) {
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中…';
      }

      try {
        await handlers.onSubmit?.(draft, editingId);
        resetDraft();
        setUI({ view: state.role === 'admin' ? 'discover' : 'publish' });
      } catch {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${icon('send', 14)}<span>重新提交</span>`;
        }
      }
    }
  });

  return offClick;
}

/** 编辑模式下，把草稿写回表单控件 */
function syncFormFromDraft(form) {
  for (const element of form.elements) {
    if (!element.name) continue;
    if (draft[element.name] !== undefined) {
      element.value = draft[element.name];
    }
  }
}

export { evaluate };
