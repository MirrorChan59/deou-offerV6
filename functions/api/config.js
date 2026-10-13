/* ============================================================
 * GET /api/config —— 官网配置公开读取
 * 缓存优先（60 秒），miss 时回源多维表格并回填缓存。
 * 返回结构与站点 assets/js/data.js 保持一致，前端按模块覆盖。
 * ============================================================ */
import {
  TABLES, CONFIG_CACHE_KEY, listRecords,
  txt, selectOne, mediaUrl, json, optionsResponse,
} from "./_feishu.js";

const CACHE_TTL_MS = 60 * 1000;

export async function onRequestGet(context) {
  const { env } = context;

  /* 1. 缓存优先 */
  try {
    const hit = await caches.default.match(CONFIG_CACHE_KEY);
    if (hit) {
      const cached = await hit.json();
      if (cached.cachedAt && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return json(cached.payload, 200, { "X-Config-Cache": "HIT" });
      }
    }
  } catch (e) { /* 缓存读取失败则回源 */ }

  /* 2. 回源多维表格 */
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.BASE_TOKEN) {
    return json({ ok: false, error: "服务端环境变量未配置完整", modules: {} }, 503);
  }

  try {
    const [banners, processSteps, cases, instructors, companies, channels] = await Promise.all([
      listRecords(env, TABLES.banners).then(buildBanners),
      listRecords(env, TABLES.process).then(buildProcess),
      listRecords(env, TABLES.cases).then(buildCases),
      listRecords(env, TABLES.instructors).then(buildInstructors),
      listRecords(env, TABLES.companies).then(buildCompanies),
      listRecords(env, TABLES.channels).then(buildChannels),
    ]);

    const payload = {
      ok: true,
      version: String(Date.now()),
      modules: { banners, processSteps, cases, instructors, companies, channels },
    };

    /* 3. 回填缓存 */
    try {
      await caches.default.put(CONFIG_CACHE_KEY, new Response(JSON.stringify({
        cachedAt: Date.now(), payload,
      }), { headers: { "Content-Type": "application/json" } }));
    } catch (e) { /* 忽略缓存写入失败 */ }

    return json(payload, 200, { "X-Config-Cache": "MISS" });
  } catch (err) {
    /* 回源失败：前端继续使用内置 data.js，不降级体验 */
    return json({ ok: false, error: String(err && err.message || err), modules: {} }, 502);
  }
}

export function onRequestOptions() { return optionsResponse(); }

/* ---------- 各模块：多维表格 → data.js 结构 ---------- */
const byOrder = (a, b) => ((a.fields["排序"] || 0) - (b.fields["排序"] || 0));
const onShelf = (r) => r.fields["是否上架"] === true;

function buildBanners(items) {
  return items.filter(onShelf).sort(byOrder).map((r) => {
    const f = r.fields;
    return {
      tag: txt(f["标签"]),
      title: txt(f["标题"]),
      subtitle: txt(f["副标题"]),
      gradient: txt(f["背景渐变"]),
      image: mediaUrl(f["配图"]),
      detailImage: mediaUrl(f["详情图片"]),
    };
  });
}

function buildProcess(items) {
  return items.slice().sort((a, b) =>
    txt(a.fields["步骤编号"]).localeCompare(txt(b.fields["步骤编号"]))).map((r) => {
    const f = r.fields;
    return {
      no: txt(f["步骤编号"]),
      title: txt(f["步骤标题"]),
      images: [mediaUrl(f["主图"]), mediaUrl(f["副图1"]), mediaUrl(f["副图2"])],
    };
  });
}

function buildCases(items) {
  return items.filter(onShelf).sort(byOrder).map((r) => {
    const f = r.fields;
    const name = txt(f["学员称呼"]) || "***";
    return {
      surname: name[0] || "*",
      name,
      school: txt(f["学校"]) || "***",
      direction: selectOne(f["方向"]),
      year: txt(f["届别"]),
      service: txt(f["辅导类型"]),
      offer: txt(f["Offer"]),
      locked: f["需登录查看"] === true,
    };
  });
}

function buildInstructors(items) {
  return items.filter(onShelf).sort(byOrder).map((r) => {
    const f = r.fields;
    return {
      name: txt(f["姓名"]),
      field: selectOne(f["领域"]),
      role: txt(f["头衔"]),
      bio: txt(f["简介"]),
      tags: txt(f["标签"]).split(",").map((s) => s.trim()).filter(Boolean),
      photo: mediaUrl(f["头像"]),
    };
  });
}

function buildCompanies(items) {
  return items.filter(onShelf).sort(byOrder).map((r) => {
    const f = r.fields;
    return {
      name: txt(f["企业名称"]),
      product: txt(f["代表产品"]),
      color: txt(f["品牌色"]) || "#334155",
      icon: null,
    };
  });
}

function buildChannels(items) {
  return items.map((r) => {
    const f = r.fields;
    return {
      name: txt(f["渠道名称"]),
      code: txt(f["渠道编码"]),
      position: txt(f["投放位置"]),
      qrImage: mediaUrl(f["二维码图片"]),
      scans: f["扫码次数"] || 0,
      enabled: f["是否启用"] === true,
    };
  });
}
