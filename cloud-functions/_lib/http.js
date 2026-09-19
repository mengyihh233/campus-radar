/**
 * _lib/http.js — 统一的请求/响应工具（云函数内部模块）
 *
 * 前端可能部署在与后端不同的域名下（例如 GitHub Pages + EdgeOne Makers），
 * 因此所有响应都携带 CORS 头。
 *
 * 安全性说明：这里允许 `Access-Control-Allow-Origin: *` 是通过的，因为
 * 鉴权走 Authorization 请求头里的 Bearer token，而不是 Cookie。
 * 浏览器不会自动携带它，第三方站点无法凭用户身份伪造请求，
 * 也就不存在传统 Cookie 场景下的 CSRF 风险。
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  ...CORS_HEADERS,
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

/** CORS 预检响应。各端点以 `export { preflight as onRequestOptions }` 引用 */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function ok(data = {}, status = 200) {
  return json({ ok: true, ...data }, { status });
}

export function fail(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, ...extra }, { status });
}

export const ERRORS = {
  unauthorized: () => fail('请先登录后再进行此操作', 401, { code: 'UNAUTHORIZED' }),
  forbidden: () => fail('当前身份没有执行该操作的权限', 403, { code: 'FORBIDDEN' }),
  notFound: (what = '资源') => fail(`${what}不存在`, 404, { code: 'NOT_FOUND' }),
  badRequest: (msg) => fail(msg || '请求参数不合法', 400, { code: 'BAD_REQUEST' }),
  conflict: (msg) => fail(msg || '资源冲突', 409, { code: 'CONFLICT' }),
  server: (msg) => fail(msg || '服务器内部错误', 500, { code: 'SERVER_ERROR' }),
};

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export function query(request) {
  return new URL(request.url).searchParams;
}

/** 方法守卫 */
export function allowMethods(request, methods) {
  if (methods.includes(request.method)) return null;
  return fail(`不支持 ${request.method} 方法`, 405, { code: 'METHOD_NOT_ALLOWED' });
}

/** 生成不重复 id */
export function newId(prefix = '') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${ts}${rand}`;
}

/** 统一的异常 → 响应转换，避免每个端点重复写 try/catch 分支 */
export function handleError(error) {
  const code = error?.code;
  if (code === 'UNAUTHORIZED') return ERRORS.unauthorized();
  if (code === 'FORBIDDEN') return ERRORS.forbidden();
  if (code === 'NOT_FOUND') return ERRORS.notFound();
  if (code === 'BAD_REQUEST') return ERRORS.badRequest(error.message);
  console.error('[campus-radar]', error?.stack || error);
  return ERRORS.server(error?.message);
}
