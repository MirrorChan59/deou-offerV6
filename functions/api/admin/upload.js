/* ============================================================
 * POST /api/admin/upload —— 图片上传到飞书素材库
 * 请求头：X-Admin-Token: <ADMIN_TOKEN>
 * 请求体：{ "filename": "a.png", "contentType": "image/png", "dataBase64": "..." }
 * 返回：{ ok: true, fileToken } —— 随后写入记录的附件字段
 * ============================================================ */
import { checkAdmin, getTenantToken, json, optionsResponse } from "../_feishu.js";

const MAX_BYTES = 20 * 1024 * 1024;

export async function onRequestPost(context) {
  const { request, env } = context;

  const denied = checkAdmin(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
  }
  const { filename, contentType, dataBase64 } = body || {};
  if (!filename || !dataBase64) {
    return json({ ok: false, error: "缺少 filename 或 dataBase64" }, 400);
  }

  let bytes;
  try {
    bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  } catch (e) {
    return json({ ok: false, error: "dataBase64 解码失败" }, 400);
  }
  if (bytes.length > MAX_BYTES) {
    return json({ ok: false, error: "图片超过 20MB 上限" }, 400);
  }

  try {
    const token = await getTenantToken(env);
    const type = contentType || "image/png";
    const form = new FormData();
    form.append("file_name", filename);
    form.append("parent_type", type.startsWith("image/") ? "bitable_image" : "bitable_file");
    form.append("parent_node", env.BASE_TOKEN);
    form.append("size", String(bytes.length));
    form.append("file", new Blob([bytes], { type }), filename);

    const resp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      body: form,
    });
    const data = await resp.json();
    if (data.code !== 0 || !data.data || !data.data.file_token) {
      return json({ ok: false, error: "飞书素材上传失败（code " + data.code + "）：" + (data.msg || "") }, 502);
    }
    return json({ ok: true, fileToken: data.data.file_token });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
}

export function onRequestOptions() { return optionsResponse(); }
