/* ============================================================
 * POST /api/track —— 渠道事件上报（官网前端 sendBeacon 调用）
 * 请求体：{ "channel": "deou-advisor", "event": "访问", "page": "/", "note": "" }
 * event 仅接受：访问 / 扫码 / 注册 / 咨询提交（与「统计-渠道事件」表单选一致），
 * 其他值归入「访问」并把原值写入备注。
 * ============================================================ */
import { TABLES, batchCreate, json, optionsResponse } from "./_feishu.js";

const EVENTS = ["访问", "扫码", "注册", "咨询提交"];

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : {};
  } catch (e) { /* 解析失败按空事件处理 */ }

  let event = EVENTS.includes(body.event) ? body.event : "访问";
  let note = body.note || "";
  if (body.event && body.event !== event) {
    note = ("原始事件：" + body.event + (note ? "；" + note : ""));
  }

  const fields = {
    "渠道编码": body.channel || "direct",
    "事件类型": [event],
    "来源页面": body.page || "",
    "发生时间": Date.now(),
    "备注": note,
  };

  try {
    if (env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.BASE_TOKEN) {
      await batchCreate(env, TABLES.trackEvents, [fields]);
    }
  } catch (e) { /* 统计失败不影响用户访问 */ }

  return json({ ok: true });
}

export function onRequestOptions() { return optionsResponse(); }
