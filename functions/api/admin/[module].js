/* ============================================================
 * POST /api/admin/:module —— 配置后台保存（整模块全量替换）
 * 请求头：X-Admin-Token: <ADMIN_TOKEN>
 * 请求体：{ "records": [ ... ] }（结构与 GET /api/config 对应模块一致；
 *         附件以 *Token 字段传 file_token，先经 POST /api/admin/upload 获得）
 * 写入策略：清空旧记录 → 批量写入新记录 → 主动失效配置缓存
 * ============================================================ */
import {
  TABLES, CONFIG_CACHE_KEY, listRecords, batchCreate, batchDelete,
  checkAdmin, json, optionsResponse,
} from "../_feishu.js";

const MODULES = ["banners", "process", "cases", "instructors", "companies", "channels"];

export async function onRequestPost(context) {
  const { request, env, params } = context;

  const denied = checkAdmin(request, env);
  if (denied) return denied;

  const module = params.module;
  if (!MODULES.includes(module)) {
    return json({ ok: false, error: "未知模块：" + module + "（支持：" + MODULES.join(" / ") + "）" }, 404);
  }
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.BASE_TOKEN) {
    return json({ ok: false, error: "服务端环境变量未配置完整" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
  }
  const records = Array.isArray(body.records) ? body.records : null;
  if (!records) {
    return json({ ok: false, error: "请求体缺少 records 数组" }, 400);
  }
  if (records.length > 100) {
    return json({ ok: false, error: "单模块最多 100 条记录" }, 400);
  }

  let fieldsList;
  try {
    fieldsList = records.map((rec, i) => toFields(module, rec, i));
  } catch (err) {
    return json({ ok: false, error: "记录格式有误：" + String(err && err.message || err) }, 400);
  }

  const tableId = TABLES[module];
  try {
    /* 全量替换：先删后写 */
    const existing = await listRecords(env, tableId);
    if (existing.length) {
      await batchDelete(env, tableId, existing.map((r) => r.record_id));
    }
    let created = [];
    if (fieldsList.length) {
      created = await batchCreate(env, tableId, fieldsList);
    }
    /* 主动失效配置缓存，下一次读取即拿到最新数据 */
    try { await caches.default.delete(CONFIG_CACHE_KEY); } catch (e) { /* 忽略 */ }

    return json({ ok: true, module, count: created.length });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
}

export function onRequestOptions() { return optionsResponse(); }

/* ---------- 站点结构 → 多维表格字段 ---------- */
function attach(token) {
  return token ? [{ file_token: token }] : undefined;
}

function toFields(module, rec, i) {
  switch (module) {
    case "banners":
      return dropUndef({
        "标题": rec.title || "",
        "副标题": rec.subtitle || "",
        "标签": rec.tag || "",
        "背景渐变": rec.gradient || "",
        "配图": attach(rec.imageToken),
        "详情图片": attach(rec.detailImageToken),
        "排序": i + 1,
        "是否上架": true,
      });
    case "process":
      return dropUndef({
        "步骤编号": rec.no || String(i + 1).padStart(2, "0"),
        "步骤标题": rec.title || "",
        "主图": attach(rec.imageTokens && rec.imageTokens[0]),
        "副图1": attach(rec.imageTokens && rec.imageTokens[1]),
        "副图2": attach(rec.imageTokens && rec.imageTokens[2]),
      });
    case "cases":
      return dropUndef({
        "学员称呼": rec.name || "***",
        "学校": rec.school || "***",
        "届别": rec.year || "",
        "方向": rec.direction || undefined,
        "Offer": rec.offer || "****",
        "辅导类型": rec.service || "",
        "需登录查看": rec.locked !== false,
        "是否上架": true,
        "排序": i + 1,
      });
    case "instructors":
      return dropUndef({
        "姓名": rec.name || "",
        "头衔": rec.role || "",
        "领域": rec.field || undefined,
        "标签": Array.isArray(rec.tags) ? rec.tags.join(",") : (rec.tags || ""),
        "简介": rec.bio || "",
        "头像": attach(rec.photoToken),
        "排序": i + 1,
        "是否上架": true,
      });
    case "companies":
      return dropUndef({
        "企业名称": rec.name || "",
        "代表产品": rec.product || "",
        "品牌色": rec.color || "#334155",
        "排序": i + 1,
        "是否上架": true,
      });
    case "channels":
      return dropUndef({
        "渠道名称": rec.name || "",
        "渠道编码": rec.code || "",
        "投放位置": rec.position || "",
        "二维码图片": attach(rec.qrToken),
        "扫码次数": rec.scans || 0,
        "是否启用": rec.enabled !== false,
      });
    default:
      throw new Error("未知模块");
  }
}

function dropUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
