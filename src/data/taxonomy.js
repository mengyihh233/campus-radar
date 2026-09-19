/**
 * taxonomy.js — 分类体系与枚举定义
 * 所有中文标签集中在此，便于统一维护。
 */

/* ---------------------------------------------------------------------------
 * 信息来源：题目要求「合理呈现学校、学院及学生自主发布等不同来源」
 * ------------------------------------------------------------------------- */
export const SOURCES = {
  school: {
    key: 'school',
    label: '校方发布',
    short: '校方',
    desc: '学校及各职能部门统一发布',
    tone: 'info',
    dot: '#5aa9f7',
  },
  college: {
    key: 'college',
    label: '学院发布',
    short: '学院',
    desc: '各学院自行发布',
    tone: 'teal',
    dot: '#5eead4',
  },
  student: {
    key: 'student',
    label: '同学发布',
    short: '同学',
    desc: '学生个人自主发布，未经校方核验',
    tone: 'muted',
    dot: '#919fb4',
  },
};

export const SOURCE_ORDER = ['school', 'college', 'student'];

/* ---------------------------------------------------------------------------
 * 信息类别
 * ------------------------------------------------------------------------- */
export const CATEGORIES = {
  competition: { key: 'competition', label: '竞赛', icon: 'trophy' },
  recruit: { key: 'recruit', label: '招募', icon: 'users' },
  lecture: { key: 'lecture', label: '讲座分享', icon: 'mic' },
  study: { key: 'study', label: '学习小组', icon: 'book' },
  volunteer: { key: 'volunteer', label: '志愿服务', icon: 'heart' },
  resource: { key: 'resource', label: '学习资源', icon: 'folder' },
  interest: { key: 'interest', label: '兴趣活动', icon: 'spark' },
  other: { key: 'other', label: '待核实', icon: 'help' },
};

export const CATEGORY_ORDER = [
  'competition',
  'recruit',
  'lecture',
  'study',
  'volunteer',
  'resource',
  'interest',
  'other',
];

/* ---------------------------------------------------------------------------
 * 受众适配
 * freshman         → 仅/主要面向大一
 * sophomore_plus   → 仅限大二及以上
 * freshman_soph   → 面向大一、大二
 * undergrad        → 面向本科生（含全部年级）
 * all              → 面向全校，不限
 * ------------------------------------------------------------------------- */
export const AUDIENCES = {
  freshman: { key: 'freshman', label: '主要面向大一' },
  sophomore_plus: { key: 'sophomore_plus', label: '仅限大二及以上' },
  freshman_soph: { key: 'freshman_soph', label: '面向大一、大二' },
  undergrad: { key: 'undergrad', label: '面向本科生' },
  all: { key: 'all', label: '面向全校' },
};

/** 新生（大一）是否可参与 */
export function isFreshmanEligible(audience) {
  return audience !== 'sophomore_plus';
}

/* ---------------------------------------------------------------------------
 * 活动状态
 * tone 映射到 CSS 语义色，order 决定排序优先级（越小越靠前）
 * ------------------------------------------------------------------------- */
export const STATUS = {
  ongoing: { key: 'ongoing', label: '进行中', tone: 'danger', order: 0, live: true },
  soon: { key: 'soon', label: '即将开始', tone: 'warn', order: 1, live: true },
  deadline: { key: 'deadline', label: '报名即将截止', tone: 'warn', order: 2 },
  open: { key: 'open', label: '报名开放', tone: 'ok', order: 3 },
  waitlist: { key: 'waitlist', label: '报名已截止 · 可候补', tone: 'muted', order: 4 },
  upcoming: { key: 'upcoming', label: '待开始', tone: 'info', order: 5 },
  longterm: { key: 'longterm', label: '长期开放', tone: 'info', order: 6 },
  replay: { key: 'replay', label: '已结束 · 回放待出', tone: 'muted', order: 7 },
  tbd: { key: 'tbd', label: '状态待确认', tone: 'warn', order: 8 },
  ended: { key: 'ended', label: '已结束', tone: 'muted', order: 9 },
};

export const STATUS_ORDER = [
  'ongoing',
  'soon',
  'deadline',
  'open',
  'waitlist',
  'upcoming',
  'longterm',
  'replay',
  'tbd',
  'ended',
];

/** 状态 → 固定色值，供 CSS 变量 --state-color 使用（避免运行时读样式表） */
export const STATE_COLOR = {
  danger: '#ff6b6b',
  warn: '#f0b429',
  ok: '#46d39a',
  info: '#5aa9f7',
  muted: '#5d6a7d',
};

/* ---------------------------------------------------------------------------
 * 风险等级
 *   danger → 强风险，默认在卡片上给出显著提示
 *   warn   → 信息不完整或存在不确定性
 *   null   → 未发现明显问题
 * ------------------------------------------------------------------------- */
export const RISK_LEVELS = {
  danger: { key: 'danger', label: '高风险提示', tone: 'danger', icon: 'shield-alert' },
  warn: { key: 'warn', label: '信息待确认', tone: 'warn', icon: 'alert' },
};

/* ---------------------------------------------------------------------------
 * 快捷筛选（对应真实使用场景，而非单纯分类）
 * ------------------------------------------------------------------------- */
export const QUICK_FILTERS = [
  {
    key: 'now',
    label: '我现在能参加',
    desc: '未截止、且符合当前年级',
    icon: 'bolt',
  },
  {
    key: 'urgent',
    label: '48 小时内节点',
    desc: '报名或开始时间在 48 小时内',
    icon: 'clock',
  },
  {
    key: 'freshman',
    label: '适合新生',
    desc: '零基础 / 面向大一 / 不设门槛',
    icon: 'compass',
  },
  {
    key: 'verified',
    label: '仅校方与学院',
    desc: '排除同学自主发布的内容',
    icon: 'shield-check',
  },
  {
    key: 'saved',
    label: '我收藏的',
    desc: '只看已加入清单的信息',
    icon: 'star',
  },
  {
    key: 'today',
    label: '今天',
    desc: '今天开始或今天截止',
    icon: 'calendar',
  },
];

/* ---------------------------------------------------------------------------
 * 排序方式
 * ------------------------------------------------------------------------- */
export const SORTS = {
  urgency: { key: 'urgency', label: '紧急优先' },
  time: { key: 'time', label: '时间顺序' },
  latest: { key: 'latest', label: '最新录入' },
};

/* ===========================================================================
 * 多角色体系
 * 游客只能看；学生可投稿但必须过审；管理端可直接发布官方信息并审核他人投稿。
 * ========================================================================= */

export const ROLES = {
  guest: {
    key: 'guest',
    label: '游客',
    short: '游客',
    desc: '仅可浏览已上架的信息',
    tone: 'muted',
    level: 0,
  },
  student: {
    key: 'student',
    label: '学生',
    short: '学生',
    desc: '可收藏、可投稿（需经审核）',
    tone: 'teal',
    level: 1,
  },
  admin: {
    key: 'admin',
    label: '管理员',
    short: '管理',
    desc: '可发布官方信息、审核投稿、下架违规内容',
    tone: 'accent',
    level: 2,
  },
};

/**
 * 权限矩阵的唯一来源在 data/permissions.js，
 * 这里仅做转出，保持既有引用可继续工作。
 */
export { PERMISSION_MAP as PERMISSIONS, evalCan as can } from './permissions.js';

/* ===========================================================================
 * 审核状态
 * ========================================================================= */

export const REVIEW_STATUS = {
  approved: {
    key: 'approved',
    label: '已通过',
    tone: 'ok',
    desc: '信息已上架，所有访问者可见',
  },
  pending: {
    key: 'pending',
    label: '待审核',
    tone: 'warn',
    desc: '等待管理员审核，暂不对其他同学展示',
  },
  needs_info: {
    key: 'needs_info',
    label: '需补充',
    tone: 'info',
    desc: '管理员认为信息不完整，需要发布者补充后重新提交',
  },
  rejected: {
    key: 'rejected',
    label: '已驳回',
    tone: 'danger',
    desc: '未通过审核，仅发布者本人可见驳回理由',
  },
  removed: {
    key: 'removed',
    label: '已下架',
    tone: 'danger',
    desc: '上架后被管理员下架',
  },
};

export const REVIEW_ORDER = ['pending', 'needs_info', 'rejected', 'approved', 'removed'];

/* ---------------------------------------------------------------------------
 * 举报原因
 * ------------------------------------------------------------------------- */
export const REPORT_REASONS = [
  { key: 'fake', label: '信息不实 / 疑似诈骗' },
  { key: 'ad', label: '商业推广、广告' },
  { key: 'outdated', label: '信息已过期或已变更' },
  { key: 'duplicate', label: '与其他信息重复' },
  { key: 'incomplete', label: '关键信息缺失，无法参加' },
  { key: 'other', label: '其他问题' },
];

/* ---------------------------------------------------------------------------
 * 记录来源：内置材料 vs 用户发布
 * ------------------------------------------------------------------------- */
export const ORIGINS = {
  seed: { key: 'seed', label: '内置信息', desc: '考核提供的模拟校园信息' },
  user: { key: 'user', label: '用户发布', desc: '通过平台发布的信息' },
};
