/**
 * _lib/taxonomy.js — 服务端字典
 *
 * 与服务端校验相关的枚举集中在此。
 * 前端展示用的完整字典在 src/data/taxonomy.js，两者职责不同，无需同步。
 */

export const CATEGORIES = {
  competition: '竞赛',
  recruit: '招募',
  lecture: '讲座分享',
  study: '学习小组',
  volunteer: '志愿服务',
  resource: '学习资源',
  interest: '兴趣活动',
  other: '待核实',
};

export const AUDIENCES = {
  all: '面向全校',
  freshman: '主要面向大一',
  sophomore_plus: '仅限大二及以上',
  freshman_soph: '面向大一、大二',
  undergrad: '面向本科生',
};

export const SOURCES = {
  school: '校方发布',
  college: '学院发布',
  student: '同学发布',
};

export const REVIEW_STATUS = {
  approved: '已通过',
  pending: '待审核',
  needs_info: '需补充',
  rejected: '已驳回',
  removed: '已下架',
};

/** 允许由发布者主动修改的状态 */
export const EDITABLE_BY_AUTHOR = ['pending', 'needs_info', 'rejected'];

/** 允许由发布者删除的状态 */
export const DELETABLE_BY_AUTHOR = ['pending', 'needs_info', 'rejected'];

export const REPORT_REASONS = {
  fake: '信息不实 / 疑似诈骗',
  ad: '商业推广、广告',
  outdated: '信息已过期或已变更',
  duplicate: '与其他信息重复',
  incomplete: '关键信息缺失，无法参加',
  other: '其他问题',
};

export const REPORT_STATUS = {
  pending: '待处理',
  resolved: '已处理',
  dismissed: '已忽略',
};
