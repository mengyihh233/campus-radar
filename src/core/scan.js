/**
 * scan.js — 前端投稿预检
 *
 * 与服务端 cloud-functions/_lib/scan.js 使用同一套规则，目的是：
 *   1. 让发布者在提交前就能看到问题，而不是提交后被驳回
 *   2. 让管理员在审核队列里直接看到机器预判，而不是面对一堆裸文本
 *
 * 注意：前端预检只是体验优化，服务端会独立复核一次，不信任前端结果。
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
    pattern: /https?:\/\/(?![^\s]*(?:\.edu\.cn|\.edu|\.gov\.cn|\.gov|\.ac\.cn))[^\s]+/i,
  },
];

/** 跑全部规则，返回命中的风险项 */
export function scanText(value) {
  const source = String(value || '');
  if (!source.trim()) return [];
  return TEXT_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    label: rule.label,
    hint: rule.hint,
  }));
}

/* ==========================================================================
 * 二、字段完整度与综合评分
 * ========================================================================== */

const REQUIRED_FIELDS = [
  { key: 'title', label: '活动名称' },
  { key: 'category', label: '信息类别' },
  { key: 'time', label: '活动时间' },
  { key: 'summary', label: '内容说明' },
];

const OPTIONAL_FIELDS = [
  { key: 'place', label: '活动地点' },
  { key: 'audienceText', label: '面向对象' },
  { key: 'contact', label: '报名或咨询方式' },
];

function pick(payload, key) {
  if (key === 'time') return payload.start || payload.timeText || payload.recurrence || '';
  return payload[key];
}

/**
 * 评估一条投稿
 * @returns {{score:number, level:string, missing:string[], risks:Array, suggestions:string[], duplicates:Array, blocker:boolean, ready:boolean}}
 */
export function evaluateSubmission(payload, options = {}) {
  const missing = [];
  const risks = [];
  const suggestions = [];

  for (const field of REQUIRED_FIELDS) {
    const value = pick(payload, field.key);
    if (!value || String(value).trim() === '') missing.push(field.label);
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = pick(payload, field.key);
    if (!value || String(value).trim() === '') missing.push(field.label);
  }

  const text = [payload.title, payload.summary, payload.requirement, payload.contact]
    .filter(Boolean)
    .join(' \n ');
  risks.push(...scanText(text));

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

  const duplicates = findDuplicates(payload, options.existing || []);

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
    blocker: dangerCount > 0,
    ready: requiredMissing === 0 && dangerCount === 0,
  };
}

/* ==========================================================================
 * 三、重复投稿检测
 * ========================================================================== */

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

/** 在已有信息中找出高度相似的条目 */
export function findDuplicates(payload, existing = []) {
  const title = String(payload.title || '');
  if (title.trim().length < 3) return [];

  const results = [];
  for (const item of existing) {
    const score = similarity(title, item.title);
    if (score >= DUPLICATE_THRESHOLD) {
      results.push({ id: item.id, title: item.title, similarity: Math.round(score * 100) });
    }
  }
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}
