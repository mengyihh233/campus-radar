/**
 * tools/e2e-local.mjs — 纯静态模式（localStorage）端到端验收测试
 *
 * 纯静态模式没有服务器，无法用 HTTP 测试，
 * 但其数据层（src/api/local.js）只依赖 localStorage 与 Web Crypto。
 * 这里注入一个内存版 localStorage，即可在 Node 中跑完整业务链路：
 *   游客浏览 → 学生投稿被拦 → 正常投稿 → 管理员审核 → 上架 → 举报 → 收藏 → 清理
 *
 * 用法：node tools/e2e-local.mjs
 */

/* ==========================================================================
 * 环境垫片：内存版 localStorage
 * ========================================================================== */

const memory = new Map();

const localStorageShim = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

globalThis.localStorage = localStorageShim;

/* ==========================================================================
 * 测试框架
 * ========================================================================== */

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? `  → ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** 期望抛出错误时使用 */
async function expectError(fn) {
  try {
    await fn();
    return { threw: false, error: null };
  } catch (error) {
    return { threw: true, error };
  }
}

/* ==========================================================================
 * 主流程
 * ========================================================================== */

const { localApi } = await import('../src/api/local.js');

const stamp = Date.now();

console.log('Campus Radar 纯静态模式验收测试');

/* ---------------------------------------------------------------------- */
section('1. 首次访问与自动初始化');

const guest = await localApi.bootstrap();
check('bootstrap 成功', guest.ok === true);
check('游客角色为 guest', guest.role === 'guest', guest.role);
check('内置信息已初始化（26 条）', guest.activities.length === 26, `${guest.activities.length}`);
check('内置信息均已上架', guest.activities.every((a) => a.reviewStatus === 'approved'));
check('游客拿不到管理统计', guest.stats === null);
check('游客拿不到审计日志', guest.audit.length === 0);
check('下发了演示账号', Array.isArray(guest.demoAccounts) && guest.demoAccounts.length === 2);
check('运行模式标记为 local', guest.mode === 'local', guest.mode);

/* ---------------------------------------------------------------------- */
section('2. 身份与权限');

const badLogin = await expectError(() => localApi.login('admin', 'wrong-password'));
check('错误密码被拒绝', badLogin.threw && badLogin.error.status === 401);

const guestPost = await expectError(() =>
  localApi.createPost({ title: '游客不该能发', category: 'other' })
);
check('未登录不能投稿', guestPost.threw && guestPost.error.status === 401);

const studentLogin = await localApi.login('student', 'student123');
check('学生登录成功', studentLogin.ok === true);
check('学生角色正确', studentLogin.viewer.role === 'student', studentLogin.viewer.role);
check('返回了会话令牌', typeof studentLogin.token === 'string' && studentLogin.token.length > 20);

const studentBoot = await localApi.bootstrap();
check('学生拿不到管理统计', studentBoot.stats === null);
check('学生没有审核权限', studentBoot.permissions.reviewQueue === false);
check('学生有投稿权限', studentBoot.permissions.submitPost === true);

/* ---------------------------------------------------------------------- */
section('3. 投稿预检与高风险拦截');

const risky = await expectError(() =>
  localApi.createPost({
    title: `校园兼职福利分享 ${stamp}`,
    category: 'other',
    summary: '零门槛、日结，加私人微信获取详情',
  })
);
check('含高风险特征的投稿被拒绝', risky.threw && risky.error.status === 422, `status=${risky.error?.status}`);
check(
  '拒绝时附带风险明细',
  Array.isArray(risky.error?.payload?.check?.risks) &&
    risky.error.payload.check.risks.length > 0
);

const riskySecond = await expectError(() =>
  localApi.createPost({
    title: `数码清仓推广 ${stamp}`,
    category: 'other',
    summary: '限时特价，点击购买链接立减',
  })
);
check('商业推广类内容同样被拦下', riskySecond.threw && riskySecond.error.status === 422);

/* ---------------------------------------------------------------------- */
section('4. 正常投稿进入待审核');

const title = `端到端测试活动 ${stamp}`;
const created = await localApi.createPost({
  title,
  category: 'interest',
  summary: '这是用于验证审核闭环的测试活动，欢迎零基础同学参加。',
  start: '2026-10-08T19:00',
  end: '2026-10-08T20:30',
  place: '实验楼 B301',
  audience: 'all',
  audienceText: '面向全校学生',
  requirement: '零基础可参加',
  deadline: '2026-10-05T23:59',
  contact: '学院教务办',
});

check('投稿创建成功', created.ok === true);
const postId = created.item.id;
check('状态为待审核', created.item.reviewStatus === 'pending', created.item.reviewStatus);
check('来源标记为同学发布', created.item.source === 'student', created.item.source);
check('保存了质检结果', Boolean(created.item.reviewCheck));
check('质检得分在合理区间', created.item.reviewCheck.score >= 0 && created.item.reviewCheck.score <= 100);

// 纯静态模式下 bootstrap 总是带当前会话，验证「游客视角」必须先登出
await localApi.logout();
const guestAfter = await localApi.bootstrap();
check('待审核内容对游客不可见', !guestAfter.activities.some((a) => a.id === postId));

await localApi.login('student', 'student123');
const studentOwn = await localApi.bootstrap();
const ownPost = studentOwn.activities.find((a) => a.id === postId);
check('发布者本人可见自己的待审投稿', Boolean(ownPost));
check('发布者能看到审核状态', ownPost?.reviewStatus === 'pending');
check('作者身份被正确记录', ownPost?.authorId === studentLogin.viewer.id);

/* ---------------------------------------------------------------------- */
section('5. 管理端审核');

const adminLogin = await localApi.login('admin', 'admin123');
check('管理员登录成功', adminLogin.ok === true);
check('管理员角色正确', adminLogin.viewer.role === 'admin');

const adminBoot = await localApi.bootstrap();
check('管理员能看到待审投稿', adminBoot.activities.some((a) => a.id === postId && a.reviewStatus === 'pending'));
check('管理员能看到统计数据', Boolean(adminBoot.stats));
check('管理员能看到审计日志', adminBoot.audit.length > 0, `${adminBoot.audit?.length}`);
check('管理员有审核权限', adminBoot.permissions.reviewQueue === true);

const noReason = await expectError(() => localApi.reviewPost(postId, 'reject', ''));
check('驳回必须填写理由', noReason.threw && noReason.error.status === 400);

// 切回学生身份尝试审核
await localApi.login('student', 'student123');
const studentReview = await expectError(() => localApi.reviewPost(postId, 'approve', '自己批自己'));
check('学生无权执行审核', studentReview.threw && studentReview.error.status === 403);

// 学生也不能直接删除已上架内容（此时尚未上架，先测审核）
await localApi.login('admin', 'admin123');
const approved = await localApi.reviewPost(postId, 'approve', '信息完整，符合校内活动发布规范');
check('审核通过成功', approved.ok === true && approved.item.reviewStatus === 'approved');
check('记录了审核人', Boolean(approved.item.reviewerName), approved.item.reviewerName);
check('记录了审核意见', approved.item.reviewNote.length > 0);

const afterApprove = await localApi.bootstrap();
check('通过后对游客可见', afterApprove.activities.some((a) => a.id === postId));

/* ---------------------------------------------------------------------- */
section('6. 收藏与清单');

await localApi.login('student', 'student123');
const fav1 = await localApi.toggleFavorite(postId);
check('加入清单成功', fav1.favorited === true);
check('收藏列表包含该条', fav1.ids.includes(postId));

const favBoot = await localApi.bootstrap();
check('收藏状态已持久化', favBoot.favorites.includes(postId));

const fav2 = await localApi.toggleFavorite(postId);
check('再次点击取消收藏', fav2.favorited === false && !fav2.ids.includes(postId));

await localApi.logout();
const favGuest = await expectError(() => localApi.toggleFavorite(postId));
check('游客不能收藏', favGuest.threw && favGuest.error.status === 401);

/* ---------------------------------------------------------------------- */
section('7. 举报闭环');

await localApi.login('student', 'student123');
const report = await localApi.submitReport({
  activityId: postId,
  reason: 'incomplete',
  detail: '测试举报：信息不完整',
});
check('提交举报成功', report.ok === true);
const reportId = report.report.id;
check('举报状态为待处理', report.report.status === 'pending');

const dup = await expectError(() =>
  localApi.submitReport({ activityId: postId, reason: 'ad' })
);
check('重复举报被拦截', dup.threw && dup.error.status === 409);

const studentReports = await expectError(() => localApi.loadReports());
check('学生无权读取举报队列', studentReports.threw && studentReports.error.status === 403);

await localApi.login('admin', 'admin123');
const adminReports = await localApi.loadReports();
check('管理员可读取举报队列', adminReports.ok === true);
check('待处理举报计数正确', adminReports.pending >= 1, `${adminReports.pending}`);

const dismissed = await localApi.resolveReport({ id: reportId, action: 'dismiss', note: '测试记录' });
check('处理举报成功', dismissed.report.status === 'dismissed');

/* ---------------------------------------------------------------------- */
section('8. 下架与作者权限');

await localApi.login('student', 'student123');
const studentRemove = await expectError(() => localApi.reviewPost(postId, 'remove', '学生想下架'));
check('学生无权下架', studentRemove.threw && studentRemove.error.status === 403);

const studentDelete = await expectError(() => localApi.deletePost(postId));
check('已上架内容作者也不能直接删除', studentDelete.threw && studentDelete.error.status === 400);

await localApi.login('admin', 'admin123');
const removed = await localApi.reviewPost(postId, 'remove', '测试流程完成，下架清理');
check('管理员下架成功', removed.item.reviewStatus === 'removed');

await localApi.logout();
const afterRemove = await localApi.bootstrap();
check('下架后对游客不可见', !afterRemove.activities.some((a) => a.id === postId));

/* ---------------------------------------------------------------------- */
section('9. 学生投稿的完整生命周期（待审 → 驳回 → 修改 → 通过）');

await localApi.login('student', 'student123');
const draft = await localApi.createPost({
  title: `生命周期测试 ${stamp}`,
  category: 'study',
  summary: '用于验证驳回后修改再提交的流程。',
  start: '2026-10-10T14:00',
  place: '待确认',
});

await localApi.login('admin', 'admin123');
await localApi.reviewPost(draft.item.id, 'needs_info', '请补充活动地点与报名方式');

await localApi.login('student', 'student123');
const studentView = await localApi.bootstrap();
const needsInfoItem = studentView.activities.find((a) => a.id === draft.item.id);
check('作者能看到「需补充」状态', needsInfoItem?.reviewStatus === 'needs_info');
check('作者能看到管理员意见', needsInfoItem?.reviewNote.includes('补充'));

const revised = await localApi.updatePost(draft.item.id, {
  title: draft.item.title,
  category: 'study',
  summary: '用于验证驳回后修改再提交的流程，已补充完整信息。',
  start: '2026-10-10T14:00',
  place: '明德楼 A203',
  contact: '学院教务办',
});
check('修改后重新回到待审核', revised.item.reviewStatus === 'pending', revised.item.reviewStatus);
check('补充后地点已更新', revised.item.place === '明德楼 A203');

await localApi.login('admin', 'admin123');
const finalApprove = await localApi.reviewPost(draft.item.id, 'approve', '已补充完整');
check('补充后可通过审核', finalApprove.item.reviewStatus === 'approved');

/* ---------------------------------------------------------------------- */
section('10. 数据持久化与重置');

const persisted = await localApi.bootstrap();
check('新增投稿已写入存储', persisted.activities.some((a) => a.id === draft.item.id));
check('审计日志已累积', persisted.audit.length > 5, `${persisted.audit.length}`);

const { resetLocalDatabase } = await import('../src/api/local.js');
await resetLocalDatabase();
const afterReset = await localApi.bootstrap();
check('重置后回到 26 条内置信息', afterReset.activities.length === 26, `${afterReset.activities.length}`);
check('重置后为未登录状态', afterReset.role === 'guest', afterReset.role);

/* ---------------------------------------------------------------------- */
console.log(`\n${'='.repeat(56)}`);
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  console.log('\n失败项：');
  for (const name of failures) console.log(`  - ${name}`);
}
console.log('='.repeat(56));

process.exit(failed ? 1 : 0);
