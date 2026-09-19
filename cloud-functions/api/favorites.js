/**
 * GET  /api/favorites — 读取我的收藏
 * POST /api/favorites — 切换收藏状态  body: { id }
 *
 * 每个用户一个文档（favorites/<uid>.json），不存在并发争用。
 */

import { ok, fail, readJson, handleError, ERRORS, preflight } from '../_lib/http.js';
import { KEYS, getJSON, setJSON } from '../_lib/store.js';
import { requirePermission } from '../_lib/auth.js';

async function loadFavorites(uid) {
  const doc = await getJSON(KEYS.favorites(uid), null);
  if (!doc || !Array.isArray(doc.ids)) return { ids: [], updatedAt: null };
  return doc;
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const user = await requirePermission(request, 'use:list');
    const doc = await loadFavorites(user.id);
    return ok({ ids: doc.ids, updatedAt: doc.updatedAt });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const user = await requirePermission(request, 'use:list');

    const body = await readJson(request);
    const id = String(body.id || '').trim();
    if (!id) return fail('缺少信息 id', 400);

    // 确认目标确实存在且对当前用户可见
    const target = await getJSON(KEYS.activity(id), null);
    if (!target) return ERRORS.notFound('该信息');
    const visible =
      target.reviewStatus === 'approved' || target.authorId === user.id || user.role === 'admin';
    if (!visible) return ERRORS.notFound('该信息');

    const doc = await loadFavorites(user.id);
    const exists = doc.ids.includes(id);

    const ids = exists ? doc.ids.filter((x) => x !== id) : [id, ...doc.ids];
    const updatedAt = Date.now();

    await setJSON(KEYS.favorites(user.id), { ids, updatedAt });

    return ok({ ids, favorited: !exists, updatedAt });
  } catch (error) {
    return handleError(error);
  }
}

export { preflight as onRequestOptions };
