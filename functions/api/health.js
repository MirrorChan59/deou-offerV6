/* ============================================================
 * GET /api/health —— 同步链路自检（联通测试用，不泄露任何密钥）
 * 返回：环境变量是否就位（仅布尔）、飞书令牌是否可获取、各配置表记录数
 * ============================================================ */
import { TABLES, getTenantToken, listRecords, json, optionsResponse } from "./_feishu.js";

export async function onRequestGet(context) {
  const { env } = context;

  const envStatus = {
    FEISHU_APP_ID: !!env.FEISHU_APP_ID,
    FEISHU_APP_SECRET: !!env.FEISHU_APP_SECRET,
    BASE_TOKEN: !!env.BASE_TOKEN,
    ADMIN_TOKEN: !!env.ADMIN_TOKEN,
  };
  const result = { ok: true, env: envStatus, tokenFetch: "skipped", tables: {}, errors: [] };

  if (!envStatus.FEISHU_APP_ID || !envStatus.FEISHU_APP_SECRET || !envStatus.BASE_TOKEN) {
    result.ok = false;
    result.errors.push("环境变量未配置完整，请在 Cloudflare → Variables and secrets 检查 4 个 Secret");
    return json(result, 503);
  }

  try {
    await getTenantToken(env);
    result.tokenFetch = "ok";
  } catch (err) {
    result.ok = false;
    result.tokenFetch = "failed";
    result.errors.push(String(err && err.message || err));
    return json(result, 502);
  }

  const names = {
    banners: "配置-首页Banner", process: "配置-服务流程", cases: "配置-成功案例",
    instructors: "配置-讲师团队", companies: "配置-合作企业", channels: "配置-渠道二维码",
  };
  for (const key of Object.keys(names)) {
    try {
      const items = await listRecords(env, TABLES[key]);
      result.tables[names[key]] = items.length;
    } catch (err) {
      result.ok = false;
      result.tables[names[key]] = "读取失败";
      result.errors.push(names[key] + "：" + String(err && err.message || err));
    }
  }

  return json(result, result.ok ? 200 : 502);
}

export function onRequestOptions() { return optionsResponse(); }
