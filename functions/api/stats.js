/* ============================================================
 * GET /api/stats —— 配置后台数据报表（管理口令鉴权）
 * 请求头：X-Admin-Token；查询参数：from / to（YYYY-MM-DD，默认最近 30 天，含今天）
 * 指标口径：
 *   全站UV   = 当日「访问」事件按访客ID去重（无访客ID的历史事件每条计 1 个访客）
 *   扫码UV   = 当日「扫码」事件按访客ID去重
 *   注册量   = 用户表当日新增（注册时间）
 *   咨询率   = 扫码UV / 全站UV（区间汇总按区间去重访客计算）
 * 日期按北京时间（UTC+8）划分。
 * ============================================================ */
import { TABLES, listAllRecords, checkAdmin, txt, json, optionsResponse } from "./_feishu.js";

const DAY_MS = 24 * 3600 * 1000;
const TZ_MS = 8 * 3600 * 1000; /* 北京时间 */

function dayKey(ts) {
  return new Date(Number(ts) + TZ_MS).toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const deny = checkAdmin(request, env);
  if (deny) return deny;
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.BASE_TOKEN) {
    return json({ ok: false, error: "服务端环境变量未配置完整" }, 503);
  }

  const url = new URL(request.url);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "")
    ? url.searchParams.get("to") : dayKey(Date.now());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "")
    ? url.searchParams.get("from") : dayKey(Date.now() - 29 * DAY_MS);
  if (from > to) return json({ ok: false, error: "from 不能晚于 to" }, 400);

  const days = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }

  let events, users;
  try {
    [events, users] = await Promise.all([
      listAllRecords(env, TABLES.trackEvents),
      listAllRecords(env, TABLES.users),
    ]);
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }

  const uvSets = {}; const scanSets = {}; const regs = {};
  days.forEach((d) => { uvSets[d] = new Set(); scanSets[d] = new Set(); regs[d] = 0; });
  const allUv = new Set(); const allScan = new Set();
  let regTotal = 0;

  events.forEach((r) => {
    const f = r.fields || {};
    const d = dayKey(f["发生时间"] || 0);
    if (!uvSets[d]) return;
    /* 无访客ID的历史事件无法去重，按每条 1 个访客计入 */
    const vid = txt(f["访客ID"]) || ("legacy-" + r.record_id);
    const type = txt(f["事件类型"]) || "访问";
    if (type === "访问") { uvSets[d].add(vid); allUv.add(vid); }
    else if (type === "扫码") { scanSets[d].add(vid); allScan.add(vid); }
  });
  users.forEach((r) => {
    const d = dayKey((r.fields || {})["注册时间"] || 0);
    if (regs[d] !== undefined) { regs[d] += 1; regTotal += 1; }
  });

  const pct = (a, b) => (b ? +(a / b * 100).toFixed(1) : 0);
  const daily = days.map((d) => ({
    date: d,
    uv: uvSets[d].size,
    scanUv: scanSets[d].size,
    registers: regs[d],
    consultRate: pct(scanSets[d].size, uvSets[d].size),
  }));

  return json({
    ok: true, from, to,
    totals: {
      uv: allUv.size,
      scanUv: allScan.size,
      registers: regTotal,
      consultRate: pct(allScan.size, allUv.size),
    },
    daily,
  });
}

export function onRequestOptions() { return optionsResponse(); }
