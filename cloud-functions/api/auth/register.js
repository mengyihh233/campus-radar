/**
 * POST /api/auth/register
 * body: { username, password, displayName?, adminCode? }
 *
 * 填入正确的管理员邀请码即注册为管理端账号（用于学院/学工处老师）。
 * 邀请码优先取环境变量 ADMIN_CODE，未配置时回落到内置默认值。
 */

import { ok, fail, readJson, handleError, ERRORS, preflight } from '../../_lib/http.js';
import {
  findUserByName,
  createUser,
  createSession,
  publicUser,
  USERNAME_RE,
} from '../../_lib/auth.js';
import { ensureSeeded } from '../../_lib/bootstrap.js';
import { logAudit, ACTIONS } from '../../_lib/audit.js';

const DEFAULT_ADMIN_CODE = 'RADAR-ADMIN';

export async function onRequestPost(context) {
  try {
    await ensureSeeded();

    const { request, env } = context;
    const body = await readJson(request);

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();
    const adminCode = String(body.adminCode || '').trim();

    /* ---- 校验 ---- */
    if (!USERNAME_RE.test(username)) {
      return fail('用户名需为 2—20 位中文、字母、数字或下划线', 400);
    }
    if (password.length < 6) {
      return fail('密码至少需要 6 位', 400);
    }
    if (password.length > 72) {
      return fail('密码过长', 400);
    }

    const exists = await findUserByName(username);
    if (exists) {
      return ERRORS.conflict('该用户名已被注册，请换一个或直接登录');
    }

    /* ---- 角色判定 ---- */
    const expected = (env && env.ADMIN_CODE) || DEFAULT_ADMIN_CODE;
    let role = 'student';
    if (adminCode) {
      if (adminCode !== expected) {
        return fail('管理员邀请码不正确', 403);
      }
      role = 'admin';
    }

    const user = await createUser({
      username,
      password,
      role,
      displayName: displayName || username,
      org: body.org ? String(body.org).slice(0, 30) : null,
    });

    const session = await createSession(user);

    await logAudit({
      actor: publicUser(user),
      action: ACTIONS.USER_REGISTER,
      detail: `注册新账号（${role === 'admin' ? '管理端' : '学生端'}）`,
    });

    return ok({ token: session.token, viewer: publicUser(user) }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export { preflight as onRequestOptions };
