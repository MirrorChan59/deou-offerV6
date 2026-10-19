/* ============================================================
 * 得欧官网 · 飞书多维表格同步层（共享模块）
 * 供 functions/api/* 各端点复用：
 *   - tenant_access_token 获取与缓存
 *   - 多维表格记录读取 / 批量写入 / 批量删除
 *   - 附件 file_token → /api/media 代理地址
 *   - CORS 与 JSON 响应工具
 * 环境变量（Cloudflare Pages → Variables and secrets，Secret 类型）：
 *   FEISHU_APP_ID / FEISHU_APP_SECRET / BASE_TOKEN / ADMIN_TOKEN
 * ============================================================ */

const FEISHU_ORIGIN = "https://open.feishu.cn";
const TOKEN_CACHE_KEY = "https://deou-internal.cache/tenant-token";
export const CONFIG_CACHE_KEY = "https://deou-internal.cache/site-config";

/* 配置模块 → 多维表格 data_table 映射（表 ID 与「配置后台」一致） */
export const TABLES = {
  banners: "tblSnMKVF7DtZcRy",     // 配置-首页Banner
  process: "tblO369iwolMbdtb",     // 配置-服务流程
  cases: "tblg9uLeUdo34Lt3",       // 配置-成功案例
  instructors: "tblqKdd8jP2Zz4EF", // 配置-讲师团队
  companies: "tbl1vNb5NImxzjKy",   // 配置-合作企业
  channels: "tblNhd3NbdIAPQ7u",    // 配置-渠道二维码
  trackEvents: "tblvmtEyLYqs33Gd", // 统计-渠道事件
  users: "tblVGKcXgN03e5RR",       // 统计-注册用户（手机号+密码哈希）
};

/* ---------- 响应工具 ---------- */
export function corsHeaders(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, Authorization",
    "Access-Control-Max-Age": "86400",
  }, extra || {});
}

export function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: corsHeaders(Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {})),
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/* ---------- tenant_access_token（缓存约 100 分钟） ---------- */
export async function getTenantToken(env) {
  const cache = caches.default;
  try {
    const hit = await cache.match(TOKEN_CACHE_KEY);
    if (hit) {
      const data = await hit.json();
      if (data.token && data.exp > Date.now() + 60000) return data.token;
    }
  } catch (e) { /* 缓存不可用时直接重新获取 */ }

  const resp = await fetch(FEISHU_ORIGIN + "/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const data = await resp.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error("获取飞书访问令牌失败（code " + data.code + "）：请检查 FEISHU_APP_ID / FEISHU_APP_SECRET 是否填写正确");
  }
  const payload = { token: data.tenant_access_token, exp: Date.now() + (data.expire - 120) * 1000 };
  try {
    await cache.put(TOKEN_CACHE_KEY, new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=6000" },
    }));
  } catch (e) { /* 忽略缓存写入失败 */ }
  return data.tenant_access_token;
}

/* ---------- 多维表格 API ---------- */
async function feishuApi(env, path, options) {
  const token = await getTenantToken(env);
  const resp = await fetch(FEISHU_ORIGIN + path, Object.assign({}, options || {}, {
    headers: Object.assign({ "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      (options && options.headers) || {}),
  }));
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error("飞书接口报错（code " + data.code + "）：" + (data.msg || "未知错误"));
  }
  return data.data;
}

/* 读取整张表（记录数 ≤ 100，单页即可） */
export async function listRecords(env, tableId) {
  const data = await feishuApi(env,
    "/open-apis/bitable/v1/apps/" + env.BASE_TOKEN + "/tables/" + tableId + "/records?page_size=100");
  return (data && data.items) || [];
}

/* 读取整表（自动翻页，适合事件 / 用户等持续增长的表） */
export async function listAllRecords(env, tableId) {
  const out = [];
  let pageToken = "";
  do {
    const data = await feishuApi(env,
      "/open-apis/bitable/v1/apps/" + env.BASE_TOKEN + "/tables/" + tableId +
      "/records?page_size=500" + (pageToken ? "&page_token=" + pageToken : ""));
    out.push(...(((data || {}).items) || []));
    pageToken = data && data.has_more ? data.page_token : "";
  } while (pageToken);
  return out;
}

/* 更新单条记录 */
export async function updateRecord(env, tableId, recordId, fields) {
  await feishuApi(env,
    "/open-apis/bitable/v1/apps/" + env.BASE_TOKEN + "/tables/" + tableId + "/records/" + recordId,
    { method: "PUT", body: JSON.stringify({ fields }) });
}

export async function batchCreate(env, tableId, fieldsList) {
  const out = [];
  for (let i = 0; i < fieldsList.length; i += 200) {
    const chunk = fieldsList.slice(i, i + 200).map((fields) => ({ fields }));
    const data = await feishuApi(env,
      "/open-apis/bitable/v1/apps/" + env.BASE_TOKEN + "/tables/" + tableId + "/records/batch_create",
      { method: "POST", body: JSON.stringify({ records: chunk }) });
    out.push(...(((data || {}).records) || []));
  }
  return out;
}

export async function batchDelete(env, tableId, recordIds) {
  for (let i = 0; i < recordIds.length; i += 200) {
    await feishuApi(env,
      "/open-apis/bitable/v1/apps/" + env.BASE_TOKEN + "/tables/" + tableId + "/records/batch_delete",
      { method: "POST", body: JSON.stringify({ records: recordIds.slice(i, i + 200) }) });
  }
}

/* ---------- 字段值归一化 ---------- */
/* 文本字段可能是字符串，也可能是富文本分段数组 */
export function txt(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((s) => (s && (s.text || s.name)) || "").join("");
  return String(v);
}

/* 单选字段：原生 API 返回纯字符串（lark-cli 会归一成数组），两种形态都兼容 */
export function selectOne(v) {
  if (typeof v === "string") return v;
  if (!Array.isArray(v) || !v.length) return "";
  const first = v[0];
  return typeof first === "string" ? first : (first && (first.text || first.name)) || "";
}

/* 附件字段：取第一个附件的 file_token，转为站内媒体代理地址 */
export function mediaUrl(v) {
  if (!Array.isArray(v) || !v.length) return null;
  const first = v[0];
  if (first && typeof first === "object" && first.file_token) return "/api/media/" + first.file_token;
  return null;
}

/* 校验管理口令：通过返回 null，失败返回 401 Response */
export function checkAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token") || "";
  if (!env.ADMIN_TOKEN) {
    return json({ ok: false, error: "服务端尚未配置 ADMIN_TOKEN" }, 500);
  }
  if (token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "管理口令不正确" }, 401);
  }
  return null;
}


/* ---------- 用户登录令牌（HMAC-SHA256 签名，7 天有效） ----------
 * 签名密钥优先取 AUTH_SECRET，未配置时回退 FEISHU_APP_SECRET（已部署的 Secret）。 */
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

function b64urlEncode(bytes) {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function authSecret(env) {
  return env.AUTH_SECRET || env.FEISHU_APP_SECRET || "deou-auth-fallback";
}
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(authSecret(env)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* 生成登录令牌：base64url(payload).base64url(hmac) */
export async function signUserToken(phone, env) {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify({ p: phone, e: Date.now() + TOKEN_TTL_MS })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(body));
  return body + "." + b64urlEncode(new Uint8Array(sig));
}

/* 校验登录令牌：通过返回手机号，失败返回 null */
export async function verifyUserToken(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env),
      b64urlDecode(parts[1]), new TextEncoder().encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    if (!payload.p || !payload.e || payload.e < Date.now()) return null;
    return payload.p;
  } catch (e) { return null; }
}
