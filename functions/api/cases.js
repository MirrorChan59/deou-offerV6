/* ============================================================
 * GET /api/cases —— 登录用户读取完整成功案例（不脱敏）
 * 请求头：Authorization: Bearer <登录令牌>（/api/auth 签发）
 * 公开接口 /api/config 对「需登录查看」案例做脱敏，本接口返回完整内容。
 * ============================================================ */
import { TABLES, listRecords, verifyUserToken, json, optionsResponse } from "./_feishu.js";
import { buildCases } from "./config.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const phone = await verifyUserToken(request, env);
  if (!phone) return json({ ok: false, error: "登录状态已失效，请重新登录" }, 401);

  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.BASE_TOKEN) {
    return json({ ok: false, error: "服务端环境变量未配置完整" }, 503);
  }
  try {
    const items = await listRecords(env, TABLES.cases);
    return json({ ok: true, cases: buildCases(items, false) });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
}

export function onRequestOptions() { return optionsResponse(); }
