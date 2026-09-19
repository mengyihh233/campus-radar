/**
 * api/error.js — 统一的接口错误类型
 *
 * 单独成文件是为了让 local.js（本地实现）与 client.js（远端实现）都能引用它，
 * 而不产生循环依赖。
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
    // status 为 0 表示压根没拿到响应（网络层失败）
    this.offline = status === 0;
  }
}
