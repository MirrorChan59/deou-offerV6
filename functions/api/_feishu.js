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
};

/* ---------- 响应工具 ---------- */
export function corsHeaders(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
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

/* 单选字段：数组，取第一个选项名 */
export function selectOne(v) {
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
