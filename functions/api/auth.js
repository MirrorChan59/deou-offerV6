/* ============================================================
 * POST /api/auth —— 用户注册 / 登录（手机号 + 密码）
 * 请求体：{ "action": "register" | "login", "phone": "1xxxxxxxxxx", "password": "......" }
 * 数据落在多维表格「统计-注册用户」：手机号 / 密码哈希 / 盐 / 注册时间 / 最近登录。
 * 密码只存 盐+SHA-256 哈希，不落明文；登录态为 HMAC 签名令牌（7 天）。
 * ============================================================ */
import {
  TABLES, listAllRecords, batchCreate, updateRecord,
  txt, sha256Hex, signUserToken, json, optionsResponse,
} from "./_feishu.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try { body = await request.json(); } catch (e) {
    return json({ ok: false, error: "请求格式不正确" }, 400);
  }
  const action = String(body.action || "");
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");

  if (!/^1\d{10}$/.test(phone)) return json({ ok: false, error: "请输入 11 位手机号" }, 400);
  if (password.length < 6 || password.length > 64) return json({ ok: false, error: "密码需 6-64 位" }, 400);
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.BASE_TOKEN) {
    return json({ ok: false, error: "服务端环境变量未配置完整" }, 503);
  }

  let users;
  try {
    users = await listAllRecords(env, TABLES.users);
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
  const existing = users.filter((r) => txt(r.fields["手机号"]).trim() === phone)[0];

  if (action === "register") {
    if (existing) return json({ ok: false, error: "该手机号已注册，请直接登录" }, 409);
    const salt = crypto.randomUUID();
    const hash = await sha256Hex(salt + ":" + password);
    try {
      await batchCreate(env, TABLES.users, [{
        "手机号": phone, "密码哈希": hash, "盐": salt, "注册时间": Date.now(),
      }]);
    } catch (err) {
      return json({ ok: false, error: String(err && err.message || err) }, 502);
    }
    return json({ ok: true, token: await signUserToken(phone, env), phone });
  }

  if (action === "login") {
    if (!existing) return json({ ok: false, error: "该手机号尚未注册，请先注册" }, 404);
    const f = existing.fields;
    const hash = await sha256Hex(txt(f["盐"]) + ":" + password);
    if (hash !== txt(f["密码哈希"])) return json({ ok: false, error: "密码不正确" }, 401);
    /* 更新最近登录时间（失败不影响登录） */
    try { await updateRecord(env, TABLES.users, existing.record_id, { "最近登录": Date.now() }); } catch (e) { /* 忽略 */ }
    return json({ ok: true, token: await signUserToken(phone, env), phone });
  }

  return json({ ok: false, error: "不支持的 action" }, 400);
}

export function onRequestOptions() { return optionsResponse(); }
