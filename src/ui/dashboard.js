/**
 * ui/dashboard.js — 管理端概览
 *
 * 回答三个问题：
 *   现在积压了多少事？内容构成健不健康？最近谁动了什么？
 * 审计日志是校园信息平台可信度的基础 —— 开放投稿就必须可追溯。
 */

import { state } from '../core/store.js';
import { icon } from './icons.js';
import { esc } from './dom.js';
import { stamp } from '../core/time.js';
import {
  SOURCES,
  SOURCE_ORDER,
  CATEGORIES,
  CATEGORY_ORDER,
  REVIEW_STATUS,
  ROLES,
} from '../data/taxonomy.js';

/* ==========================================================================
 * 指标卡
 * ========================================================================== */

function metricCard({ label, value, hint, tone = 'neutral', iconName }) {
  return `
    <div class="metric metric--${tone}">
      <div class="metric__top">
        <span class="metric__label">${esc(label)}</span>
        <span class="metric__icon">${icon(iconName, 14)}</span>
      </div>
      <div class="metric__value">${esc(value)}</div>
      ${hint ? `<div class="metric__hint">${esc(hint)}</div>` : ''}
    </div>
  `;
}

/* ==========================================================================
 * 分布条
 * ========================================================================== */

function distribution({ title, data, total, labeler }) {
  const entries = Object.entries(data)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return '';

  const rows = entries
    .map(([key, count]) => {
      const percent = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="dist-row">
          <span class="dist-row__label">${esc(labeler(key))}</span>
          <span class="dist-row__bar">
            <span class="dist-row__fill" style="width:${percent}%"></span>
          </span>
          <span class="dist-row__value">${count}<span class="dist-row__pct">${percent}%</span></span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="panel dist">
      <div class="dist__head">${esc(title)}</div>
      ${rows}
    </div>
  `;
}

/* ==========================================================================
 * 审计日志
 * ========================================================================== */

function auditList() {
  const logs = state.audit || [];

  if (!logs.length) {
    return `
      <div class="panel" style="padding:20px">
        <div class="dist__head">操作日志</div>
        <p class="field__hint" style="margin-top:8px">暂时还没有记录。</p>
      </div>
    `;
  }

  const rows = logs
    .slice(0, 60)
    .map((log) => {
      const roleMeta = ROLES[log.actorRole] || null;
      return `
        <div class="audit-row">
          <span class="audit-row__time">${esc(stamp(log.at))}</span>
          <span class="audit-row__actor">
            ${esc(log.actorName)}
            ${roleMeta ? `<span class="audit-row__role">${esc(roleMeta.short)}</span>` : ''}
          </span>
          <span class="audit-row__action">${esc(log.actionLabel || log.action)}</span>
          <span class="audit-row__detail">${
            log.target?.title ? esc(log.target.title) : esc(log.detail || '')
          }</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="panel audit">
      <div class="audit__head">
        ${icon('clipboard', 13)}
        <span>操作日志</span>
        <span class="toolbar__spacer"></span>
        <span class="field__hint">最近 ${Math.min(logs.length, 60)} 条</span>
      </div>
      <div class="audit__list">${rows}</div>
    </div>
  `;
}

/* ==========================================================================
 * 视图
 * ========================================================================== */

export function dashboardView() {
  const stats = state.stats;

  if (!stats) {
    return `
      <div class="empty">
        <span class="empty__icon">${icon('chart', 26)}</span>
        <span class="empty__title">暂无统计数据</span>
        <p class="empty__text">统计数据仅对管理端开放。</p>
      </div>
    `;
  }

  const pendingCount = stats.byReview?.pending || 0;
  const needsInfoCount = stats.byReview?.needs_info || 0;
  const reportsPending = stats.reportsPending || 0;

  return `
    <div class="dashboard">
      <div class="metrics">
        ${metricCard({
          label: '信息总量',
          value: stats.total,
          hint: `内置 ${stats.seedCount} · 用户发布 ${stats.userPostCount}`,
          iconName: 'inbox',
        })}
        ${metricCard({
          label: '待审核',
          value: pendingCount,
          hint: pendingCount ? '需要尽快处理' : '队列已清空',
          tone: pendingCount ? 'warn' : 'ok',
          iconName: 'clock',
        })}
        ${metricCard({
          label: '需补充材料',
          value: needsInfoCount,
          hint: '等待发布者修改后重新提交',
          tone: needsInfoCount ? 'warn' : 'neutral',
          iconName: 'help',
        })}
        ${metricCard({
          label: '待处理举报',
          value: reportsPending,
          hint: reportsPending ? '有同学反馈了问题' : '暂无待处理',
          tone: reportsPending ? 'danger' : 'ok',
          iconName: 'flag',
        })}
        ${metricCard({
          label: '投稿通过率',
          value: stats.approvalRate === null ? '—' : `${stats.approvalRate}%`,
          hint: '已处理完毕的投稿中通过的比例',
          iconName: 'chart',
        })}
      </div>

      <div class="dist-grid">
        ${distribution({
          title: '信息来源分布',
          data: stats.bySource || {},
          total: stats.total,
          labeler: (key) => SOURCES[key]?.label || key,
        })}
        ${distribution({
          title: '信息类别分布',
          data: stats.byCategory || {},
          total: stats.total,
          labeler: (key) => CATEGORIES[key]?.label || key,
        })}
        ${distribution({
          title: '内容风险分布',
          data: stats.byRisk || {},
          total: stats.total,
          labeler: (key) =>
            key === 'none' ? '未发现风险' : key === 'warn' ? '待确认' : '高风险',
        })}
        ${distribution({
          title: '审核状态分布',
          data: stats.byReview || {},
          total: stats.total,
          labeler: (key) => REVIEW_STATUS[key]?.label || key,
        })}
      </div>

      ${auditList()}
    </div>
  `;
}

export { SOURCE_ORDER, CATEGORY_ORDER };
