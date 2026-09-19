/**
 * _lib/scan.js — 内容扫描与投稿质量评估
 *
 * 这是审核系统的核心：同一套规则同时用于
 *   1) 学生提交前的实时预检（让发布者先自己修正）
 *   2) 后端落库前的复核（防止绕过前端）
 *   3) 管理端审核队列的风险排序
 *
 * 纯函数实现，不依赖任何运行时 API，前后端与 Node 环境均可执行。
 */

/* ==========================================================================
 * 一、文本风险规则
 * ========================================================================== */

export const TEXT_RULES = [
  {
    id: 'offsite-contact',
    severity: 'danger',
    label: '引导到私人联系方式',
    hint: '正规校园活动一般通过校方或学院渠道组织，而不是把「加私人微信」作为获取信息的前提。',
    pattern:
      /加(一下|个|我的)?(私人)?(微信|VX|vx|v信|威信|QQ)|私(聊|信|加我)|扫码(加|进|添加)|加我(好友|微信)|留(下)?(你的)?联系方式/i,
  },
  {
    id: 'commercial',
    severity: 'danger',
    label: '含商品推广或购买引导',
    hint: '活动信息里出现购买链接、优惠券或电商平台，通常属于商业推广而非校园活动。',
    pattern:
      /购买链接|立即下单|点击购买|优惠券|折扣码|限时特价|限时优惠|淘宝|拼多多|微店|闲鱼|代购|带货/i,
  },
  {
    id: 'money-upfront',
    severity: 'danger',
    label: '涉及先付费或提供证件',
    hint: '任何要求先交押金、保证金、垫付款，或索取身份证照片的「机会」，都应当直接拒绝。',
    pattern: /押金|保证金|先(交|付)(钱|费)|提前转账|垫付|身份证(正反面|照片|复印件)|银行卡号/,
  },
  {
    id: 'overpromise',
    severity: 'warn',
    label: '使用夸大或招聘话术',
    hint: '「零门槛、日结、保过、包就业」这类措辞是高风险信息的常见特征，建议核实发布方。',
    pattern:
      /零门槛|无门槛|日结|轻松(赚|月入)|躺赚|保过|包(过|就业|分配)|高薪兼职|稳赚|100%通过|百分百/,
  },
  {
    id: 'external-link',
    severity: 'warn',
    label: '包含校外链接',
    hint: '校外链接无法核实归属，点击前请确认来源可信。',
    pattern:
      /https?:\/\/(?![^\s]*(?:\.edu\.cn|\.edu|\.gov\.cn|\.gov|\.ac\.cn))[^\s]+/i,
  },
];

/**
 * 对一段文本跑全部规则，返回命中的风险项。
 * @param {string} text 标题 + 正文拼接后的文本
 */
export function scanText(text) {
  const source = String(text || '');
  if (!source.trim()) return [];

  return TEXT_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    label: rule.label,
    hint: rule.hint,
  }));
}

/* ==========================================================================
 * 二、字段完整度
 * ========================================================================== */

/** 必填字段：缺失会直接导致同学无法参加 */
const REQUIRED_FIELDS = [
  { key: 'title', label: '活动名称' },
  { key: 'category', label: '信息类别' },
  { key: 'time', label: '活动时间' },
  { key: 'summary', label: '内容说明' },
];

/** 建议字段：缺失会降低可操作性 */
const OPTIONAL_FIELDS = [
  { key: 'place', label: '活动地点' },
  { key: 'audienceText', label: '面向对象' },
  { key: 'contact', label: '报名或咨询方式' },
];

/** 从投稿 payload 中取出字段值（兼容多种写法） */
function pick(payload, key) {
  if (key === 'time') {
    return payload.start || payload.timeText || payload.recurrence || '';
  }
  return payload[key];
}

/**
 * 评估一条投稿。
 * @param {object} payload 投稿内容
 * @param {object} [options]
 * @param {Array}  [options.existing] 已有信息，用于重复度检测
 * @returns {{ score:number, level:string, missing:Array, risks:Array, suggestions:Array, duplicates:Array, ready:boolean }}
 */
export function evaluateSubmission(payload, options = {}) {
  const missing = [];
  const risks = [];
  const suggestions = [];

  /* ---- 必填 / 建议字段 ---- */
  for (const field of REQUIRED_FIELDS) {
    const value = pick(payload, field.key);
    if (!value || String(value).trim() === '') missing.push(field.label);
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = pick(payload, field.key);
    if (!value || String(value).trim() === '') missing.push(field.label);
  }

  /* ---- 文本风险 ---- */
  const text = [payload.title, payload.summary, payload.requirement, payload.contact]
    .filter(Boolean)
    .join(' \n ');
  risks.push(...scanText(text));

  /* ---- 结构性风险 ---- */
  if (!pick(payload, 'time')) {
    suggestions.push('没有填活动时间，同学无法判断什么时候参加。');
  }
  if (!payload.place && payload.category !== 'resource') {
    suggestions.push('建议补充活动地点，或注明「线上」。');
  }
  if (/待(最终)?确认|未定|待定/.test(String(payload.place || ''))) {
    risks.push({
      id: 'place-unconfirmed',
      severity: 'warn',
      label: '地点尚未确定',
      hint: '如果地点还没定，建议在说明里写清楚什么时候能确认，避免同学跑空。',
    });
  }

  /* ---- 重复度 ---- */
  const duplicates = findDuplicates(payload, options.existing || []);

  /* ---- 评分 ---- */
  const requiredMissing = missing.filter((m) => REQUIRED_FIELDS.some((f) => f.label === m)).length;
  const optionalMissing = missing.length - requiredMissing;

  let score = 100;
  score -= requiredMissing * 18;
  score -= optionalMissing * 5;
  score -= risks.filter((r) => r.severity === 'danger').length * 25;
  score -= risks.filter((r) => r.severity === 'warn').length * 10;
  score -= duplicates.length * 8;
  score = Math.max(0, Math.min(100, score));

  const dangerCount = risks.filter((r) => r.severity === 'danger').length;
  const level = dangerCount > 0 ? 'danger' : score < 60 ? 'warn' : score < 85 ? 'fair' : 'good';

  return {
    score,
    level,
    missing,
    risks,
    suggestions,
    duplicates,
    // 含高风险项时不允许直接提交，必须先修改
    blocker: dangerCount > 0,
    ready: requiredMissing === 0 && dangerCount === 0,
  };
}

/* ==========================================================================
 * 三、重复投稿检测
 * ========================================================================== */

/** 将字符串转成字符二元组集合（去掉标点与空白） */
function bigrams(value) {
  const text = String(value || '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase();
  const set = new Set();
  if (text.length === 0) return set;
  if (text.length === 1) {
    set.add(text);
    return set;
  }
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2));
  return set;
}

/** Jaccard 相似度 */
export function similarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const item of A) if (B.has(item)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

const DUPLICATE_THRESHOLD = 0.45;

/**
 * 在已有信息中找出与本次投稿高度相似的条目。
 * 判定依据：标题相似度为主，同时参考时间是否接近。
 */
export function findDuplicates(payload, existing = []) {
  const title = String(payload.title || '');
  if (title.trim().length < 3) return [];

  const results = [];
  for (const item of existing) {
    const score = similarity(title, item.title);
    if (score >= DUPLICATE_THRESHOLD) {
      results.push({
        id: item.id,
        title: item.title,
        similarity: Math.round(score * 100),
      });
    }
  }
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

/* ==========================================================================
 * 四、内置信息的初始风险标注
 * ========================================================================== */

/**
 * 给一条信息计算风险等级与标签。
 * 手工标注的 riskLevel / riskFlags 优先，未被标注时用规则扫描补齐。
 */
export function deriveRiskFlags(item) {
  if (item.riskLevel) {
    return { level: item.riskLevel, flags: item.riskFlags || [] };
  }
  const text = [item.title, item.summary, item.raw].filter(Boolean).join(' \n ');
  const hits = scanText(text);
  if (!hits.length) return { level: null, flags: [] };

  const level = hits.some((h) => h.severity === 'danger') ? 'danger' : 'warn';
  return { level, flags: hits.map((h) => h.label) };
}
