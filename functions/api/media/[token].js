/* ============================================================
 * GET /api/media/:token —— 飞书附件图片代理
 * 多维表格附件的临时下载地址会过期，这里用租户令牌实时回源，
 * 并对图片做 24 小时缓存，保证官网图片地址长期可用。
 * ============================================================ */
import { getTenantToken, optionsResponse } from "../_feishu.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const fileToken = params.token;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(fileToken || "")) {
    return new Response("bad token", { status: 400 });
  }

  const cacheKey = "https://deou-internal.cache/media/" + fileToken;
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  } catch (e) { /* 回源 */ }

  try {
    const token = await getTenantToken(env);
    const resp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/" + fileToken + "/download", {
      headers: { "Authorization": "Bearer " + token },
    });
    if (!resp.ok) {
      return new Response("media fetch failed: " + resp.status, { status: 502 });
    }
    const out = new Response(resp.body, {
      status: 200,
      headers: {
        "Content-Type": resp.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
    try { context.waitUntil(caches.default.put(cacheKey, out.clone())); } catch (e) { /* 忽略 */ }
    return out;
  } catch (err) {
    return new Response("media error: " + String(err && err.message || err), { status: 502 });
  }
}

export function onRequestOptions() { return optionsResponse(); }
