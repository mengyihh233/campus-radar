/**
 * tools/e2e-test.mjs — 端到端验收测试
 *
 * 覆盖真实使用链路，而不是单个接口：
 *   游客浏览 → 学生投稿被拦 → 学生正常投稿 → 管理员审核 → 上架可见
 *   → 学生举报 → 管理员处理 → 收藏与权限校验 → 清理测试数据
 *
 * 用法：node tools/e2e-test.mjs [API_BASE]
 * 默认 API_BASE = http://localhost:8088
 */

const BASE = process.argv[2] || process.env.API_BASE || 'http://localhost:8088';

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

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text.slice(0, 160) };
  }

  return { status: response.status, data, headers: response.headers };
}

const stamp = Date.now();

/** 清理此前测试可能留下的残留数据，保证每次运行的结果可复现 */
async function cleanupPreviousRuns() {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  });
  if (login.status !== 200) return 0;

  const token = login.data.token;
  const boot = await api('/api/bootstrap', { token });
  const junk = (boot.data.activities || []).filter(
    (a) => a.origin === 'user' && /端到端测试活动/.test(a.title || '')
  );

  for (const item of junk) {
    await api(`/api/posts/${item.id}`, { method: 'DELETE', token });
  }
  return junk.length;
}

async function main() {
  console.log(`Campus Radar 端到端测试  →  ${BASE}`);

  const cleaned = await cleanupPreviousRuns();
  if (cleaned) console.log(`（已清理 ${cleaned} 条历史测试数据）`);

  /* ==================================================================== */
  section('1. 游客视角');

  const guest = await api('/api/bootstrap');
  check('bootstrap 返回 200', guest.status === 200, `实际 ${guest.status}`);
  check('游客角色为 guest', guest.data.role === 'guest', guest.data.role);
  check('内置信息已加载（26 条）', guest.data.activities?.length === 26, `${guest.data.activities?.length}`);
  check('游客拿不到管理统计', guest.data.stats === null);
  check('游客拿不到审计日志', (guest.data.audit || []).length === 0);
  check('响应带有 CORS 头', guest.headers.get('access-control-allow-origin') === '*');
  check('内置信息均已上架', guest.data.activities.every((a) => a.reviewStatus === 'approved'));

  /* ==================================================================== */
  section('2. 身份校验');

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'definitely-wrong' },
  });
  check('错误密码被拒绝（401）', badLogin.status === 401, `实际 ${badLogin.status}`);

  const guestWrite = await api('/api/posts', {
    method: 'POST',
    body: { title: '游客不该能发' },
  });
  check('未登录不能投稿（401）', guestWrite.status === 401, `实际 ${guestWrite.status}`);

  const studentLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'student', password: 'student123' },
  });
  check('学生登录成功', studentLogin.status === 200 && studentLogin.data.ok);
  const studentToken = studentLogin.data.token;
  check('学生角色正确', studentLogin.data.viewer?.role === 'student');

  const studentBoot = await api('/api/bootstrap', { token: studentToken });
  check('学生拿不到管理统计', studentBoot.data.stats === null);
  check('学生没有审核权限', studentBoot.data.permissions.reviewQueue === false);

  /* ==================================================================== */
  section('3. 投稿预检与风险拦截');

  const riskyPost = await api('/api/posts', {
    method: 'POST',
    token: studentToken,
    body: {
      title: `校园兼职福利分享 ${stamp}`,
      category: 'other',
      summary: '零门槛、日结，加私人微信获取详情，无需经验',
      place: '',
    },
  });
  check(
    '含高风险特征的投稿被服务端拒绝（422）',
    riskyPost.status === 422,
    `实际 ${riskyPost.status} / ${riskyPost.data.error || ''}`
  );
  check(
    '拒绝时返回风险明细',
    Array.isArray(riskyPost.data.check?.risks) && riskyPost.data.check.risks.length > 0
  );

  /* ==================================================================== */
  section('4. 正常投稿进入待审核');

  const title = `端到端测试活动 ${stamp}`;
  const created = await api('/api/posts', {
    method: 'POST',
    token: studentToken,
    body: {
      title,
      category: 'interest',
      summary: '这是一个用于验证审核闭环的测试活动，欢迎零基础同学参加。',
      start: '2026-10-08T19:00',
      end: '2026-10-08T20:30',
      place: '实验楼 B301',
      audience: 'all',
      audienceText: '面向全校学生',
      requirement: '零基础可参加',
      deadline: '2026-10-05T23:59',
      contact: '学院教务办',
    },
  });

  check('投稿创建成功（201）', created.status === 201, `实际 ${created.status}`);
  const postId = created.data.item?.id;
  check('状态为待审核', created.data.item?.reviewStatus === 'pending', created.data.item?.reviewStatus);
  check('来源标记为同学发布', created.data.item?.source === 'student', created.data.item?.source);
  check('记录了质检结果', Boolean(created.data.item?.reviewCheck));

  const guestAfterPost = await api('/api/bootstrap');
  check(
    '待审核内容对游客不可见',
    !guestAfterPost.data.activities.some((a) => a.id === postId)
  );

  const studentOwn = await api('/api/bootstrap', { token: studentToken });
  const ownPost = studentOwn.data.activities.find((a) => a.id === postId);
  check('发布者本人可见自己的待审投稿', Boolean(ownPost));
  check('发布者能看到审核状态', ownPost?.reviewStatus === 'pending');

  /* ==================================================================== */
  section('5. 管理端审核');

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  });
  const adminToken = adminLogin.data.token;
  check('管理员登录成功', adminLogin.status === 200);

  const adminBoot = await api('/api/bootstrap', { token: adminToken });
  check(
    '管理员能看到待审投稿',
    adminBoot.data.activities.some((a) => a.id === postId && a.reviewStatus === 'pending')
  );
  check('管理员能看到统计', Boolean(adminBoot.data.stats));
  check('管理员能看到审计日志', (adminBoot.data.audit || []).length > 0);

  const noReason = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { action: 'reject', note: '' },
  });
  check('驳回必须填写理由（400）', noReason.status === 400, `实际 ${noReason.status}`);

  const approved = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { action: 'approve', note: '信息完整，符合校内活动发布规范' },
  });
  check('审核通过成功', approved.status === 200 && approved.data.item?.reviewStatus === 'approved');
  check('记录了审核人', Boolean(approved.data.item?.reviewerName));

  const studentAudit = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: studentToken,
    body: { action: 'approve', note: '试图自己批准自己' },
  });
  check('学生无权执行审核（403）', studentAudit.status === 403, `实际 ${studentAudit.status}`);

  const guestAfterApprove = await api('/api/bootstrap');
  check(
    '通过后对游客可见',
    guestAfterApprove.data.activities.some((a) => a.id === postId)
  );

  /* ==================================================================== */
  section('6. 收藏');

  const fav1 = await api('/api/favorites', { method: 'POST', token: studentToken, body: { id: postId } });
  check('加入清单成功', fav1.status === 200 && fav1.data.favorited === true);
  check('返回收藏列表', Array.isArray(fav1.data.ids) && fav1.data.ids.includes(postId));

  const favBoot = await api('/api/bootstrap', { token: studentToken });
  check('收藏状态已持久化', favBoot.data.favorites.includes(postId));

  const fav2 = await api('/api/favorites', { method: 'POST', token: studentToken, body: { id: postId } });
  check('再次点击取消收藏', fav2.data.favorited === false && !fav2.data.ids.includes(postId));

  const favGuest = await api('/api/favorites', { method: 'POST', body: { id: postId } });
  check('游客不能收藏（401）', favGuest.status === 401);

  /* ==================================================================== */
  section('7. 举报闭环');

  const report = await api('/api/reports', {
    method: 'POST',
    token: studentToken,
    body: { activityId: postId, reason: 'incomplete', detail: '测试举报：信息不完整' },
  });
  check('提交举报成功（201）', report.status === 201, `实际 ${report.status}`);
  const reportId = report.data.report?.id;

  const dupReport = await api('/api/reports', {
    method: 'POST',
    token: studentToken,
    body: { activityId: postId, reason: 'ad' },
  });
  check('重复举报被拦截（409）', dupReport.status === 409, `实际 ${dupReport.status}`);

  const guestReports = await api('/api/reports');
  check('游客不能读举报队列（401/403）', [401, 403].includes(guestReports.status));

  const studentReports = await api('/api/reports', { token: studentToken });
  check('学生不能读举报队列（403）', studentReports.status === 403, `实际 ${studentReports.status}`);

  const adminReports = await api('/api/reports', { token: adminToken });
  check('管理员可读举报队列', adminReports.status === 200);
  check('待处理举报计数正确', adminReports.data.pending >= 1, `${adminReports.data.pending}`);

  const dismissed = await api('/api/reports', {
    method: 'PATCH',
    token: adminToken,
    body: { id: reportId, action: 'dismiss', note: '测试记录，忽略' },
  });
  check('处理举报成功', dismissed.status === 200 && dismissed.data.report?.status === 'dismissed');

  /* ==================================================================== */
  section('8. 下架与作者权限');

  const studentRemove = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: studentToken,
    body: { action: 'remove', note: '学生试图下架' },
  });
  check('学生无权下架（403）', studentRemove.status === 403, `实际 ${studentRemove.status}`);

  const removed = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { action: 'remove', note: '测试流程完成，下架清理' },
  });
  check('管理员下架成功', removed.status === 200 && removed.data.item?.reviewStatus === 'removed');

  const guestAfterRemove = await api('/api/bootstrap');
  check(
    '下架后对游客不可见',
    !guestAfterRemove.data.activities.some((a) => a.id === postId)
  );

  /* ==================================================================== */
  section('9. 清理测试数据');

  const deleted = await api(`/api/posts/${postId}`, { method: 'DELETE', token: adminToken });
  check('删除测试投稿成功', deleted.status === 200, `实际 ${deleted.status}`);

  const finalBoot = await api('/api/bootstrap');
  const seedCount = (finalBoot.data.activities || []).filter((a) => a.origin === 'seed').length;
  const userCount = (finalBoot.data.activities || []).filter((a) => a.origin === 'user').length;
  check('26 条内置信息完整保留', seedCount === 26, `实际 ${seedCount}`);
  check('测试投稿已清理干净', userCount === 0, `残留 ${userCount} 条`);

  /* ==================================================================== */
  console.log(`\n${'='.repeat(56)}`);
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    console.log('\n失败项：');
    for (const name of failures) console.log(`  - ${name}`);
  }
  console.log('='.repeat(56));

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('\n测试执行中断：', error.message);
  console.error('请确认开发服务器已启动：edgeone makers dev -n campus-radar');
  process.exit(2);
});
