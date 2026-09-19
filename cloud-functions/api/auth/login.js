/**
 * POST /api/auth/login
 * body: { username, password }
 */

import { ok, fail, readJson, handleError, preflight } from '../../_lib/http.js';
import {
  findUserByName,
  verifyPassword,
  createSession,
  publicUser,
} from '../../_lib/auth.js';
import { ensureSeeded } from '../../_lib/bootstrap.js';
import { logAudit, ACTIONS } from '../../_lib/audit.js';

export async function onRequestPost(context) {
  try {
    await ensureSeeded();

    const { request } = context;
    const body = await readJson(request);

    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return fail('请填写用户名与密码', 400);
    }

    const user = await findUserByName(username);

    // 用户名不存在与密码错误返回同一提示，避免账号枚举
    if (!user) {
      return fail('用户名或密码不正确', 401);
    }
    if (user.status !== 'active') {
      return fail('该账号已被停用，请联系管理员', 403);
    }

    const passed = await verifyPassword(user, password);
    if (!passed) {
      return fail('用户名或密码不正确', 401);
    }

    const session = await createSession(user);
    const viewer = publicUser(user);

    await logAudit({
      actor: viewer,
      action: ACTIONS.USER_LOGIN,
      detail: `登录成功（${viewer.role === 'admin' ? '管理端' : '学生端'}）`,
    });

    return ok({ token: session.token, viewer });
  } catch (error) {
    return handleError(error);
  }
}

export { preflight as onRequestOptions };
