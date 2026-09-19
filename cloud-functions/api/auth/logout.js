/**
 * POST /api/auth/logout
 * 需要 Authorization: Bearer <token>
 */

import { ok, handleError, preflight } from '../../_lib/http.js';
import { destroySession, currentUser } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const user = await currentUser(request);
    const header = request.headers.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);

    if (match) await destroySession(match[1].trim());

    return ok({ loggedOut: true, username: user?.username || null });
  } catch (error) {
    return handleError(error);
  }
}

export { preflight as onRequestOptions };
