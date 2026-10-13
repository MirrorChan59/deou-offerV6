# functions/ —— 得欧官网同步层（Cloudflare Pages Functions）

本目录由 Cloudflare Pages 自动识别，部署后提供以下接口（无需任何额外配置）：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| /api/config | GET | 官网配置公开读取（缓存 60 秒，miss 回源多维表格） |
| /api/admin/:module | POST | 配置后台保存（整模块替换），需请求头 `X-Admin-Token` |
| /api/admin/upload | POST | 图片上传飞书素材库，返回 fileToken 供附件字段使用 |
| /api/track | POST | 渠道事件上报（写入「统计-渠道事件」表） |
| /api/media/:token | GET | 飞书附件图片代理（防临时链接过期，缓存 24h） |
| /api/health | GET | 同步链路自检（不泄露密钥，用于联通测试） |

:module 取值：banners / process / cases / instructors / companies / channels

环境变量（Cloudflare → Workers 和 Pages → 此项目 → 设置 → Variables and secrets，Secret 类型）：
FEISHU_APP_ID / FEISHU_APP_SECRET / BASE_TOKEN / ADMIN_TOKEN
