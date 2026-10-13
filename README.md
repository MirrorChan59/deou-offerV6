# 得欧求职 · 官网前台

纯静态多页官网（无构建步骤、零外部依赖），直接部署即可运行。

## 页面结构

| 文件 | 页面 |
| --- | --- |
| `index.html` | 首页（Banner 轮播 / Hero / 五大方向 / 合作企业 / 二维码转化卡） |
| `service.html` | 服务流程（五步闭环，图片可配置） |
| `directions.html` | 核心方向（5 个方向标签页，支持 `#pm` `#ops` `#data` `#market` `#ba` 锚点直达） |
| `cases.html` | 成功案例（方向筛选 / 登录锁定态） |
| `about.html` | 关于我们（品牌故事 / 校园合伙人 / 合作院校） |
| `lecturers.html` | 讲师团队 |

```
site/
├── index.html / service.html / directions.html / cases.html / about.html / lecturers.html
├── assets/
│   ├── css/style.css        # 全部样式（设计变量在 :root 中）
│   ├── js/data.js           # 数据层：所有运营可配置内容集中在此
│   ├── js/main.js           # 交互：轮播 / 标签页 / 筛选 / 弹窗 / 渠道归因
│   └── img/                 # logo.png / do-mark.png / qr-wechat.png + 插图；companies/ 为企业品牌图标
└── README.md
```

## 本地预览

无依赖，任选其一：

```bash
python3 -m http.server 8080     # 或
npx serve .
```

浏览器打开 `http://localhost:8080`。

## 部署到 Cloudflare Pages

1. 推送到 GitHub：`git init && git add . && git commit -m "deou website" && git remote add origin <你的仓库> && git push -u origin main`
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选择该仓库。
3. 构建设置：**Framework preset 选 `None`**；**Build command 留空**；**Build output directory 填 `/`**（仓库根目录即站点根目录）。
4. Save and Deploy，完成后得到 `*.pages.dev` 域名，可在 **Custom domains** 绑定自有域名。

> 纯静态站点，Cloudflare Pages 直接按静态文件服务，无需任何构建。

## 上线前可换素材

- **`assets/img/qr-wechat.png`** —— 已是**真实企业微信二维码**（523×523 含白色静区，实测可扫）。若日后顾问换码，同名覆盖即可。引用位置：`index.html`、`about.html`、`assets/js/main.js`（`showQrModal`）。
- **`assets/img/logo.png`** —— 品牌 DO 组合标（导航栏、关于页故事卡片），透明背景版；**`assets/img/do-mark.png`** —— DO 图形标（页脚白底徽章内），透明背景版。替换时请同样使用透明底 PNG，避免在页头上出现白底贴图感。
- **`assets/img/companies/*.png`** —— 10 家合作企业品牌图标（按企业名命名），换图标同名覆盖；`data.js` 中 `COMPANIES[].icon` 指向对应文件。
- `assets/img/banner-*.svg`、`banner-detail-*.svg`（「了解详情」弹窗图，9:16 竖版）、`hero-dashboard.svg`、`step-*.svg` —— 均为示意插图，可按品牌视觉替换。

## 内容配置（assets/js/data.js）

所有运营可改的内容集中在 `data.js`，字段结构稳定，后续可整体替换为接口返回：

- `BANNERS`：首页 Banner（标签/标题/副标题/渐变/图片 + `detailImage` 详情图）。**配置了 `detailImage` 的 Banner 会显示「了解详情」按钮**，点击弹出图片详情弹窗；留空则不显示按钮。详情图建议竖版 **9:16**（如 540×960），适配移动端。
- `TRACKS` / `COMPANIES`：首页方向卡片与合作企业
- `PROCESS_STEPS`：服务流程（**标题与描述写死，运营只换图片**——改各步骤 `shots[].img` 路径即可）
- `CASES` / `CASE_FILTERS`：成功案例（`locked: true` 的行显示 🔒 登录查看）
- `INSTRUCTORS`：讲师卡片（`photo` 留空显示占位图标）
- `DIRECTIONS`：核心方向 5 个标签页的全部内容
- `ABOUT`：关于页数据

## 渠道归因

渠道二维码生成的链接形如 `https://你的域名/?channel=xxxx`，前台会自动捕获 `channel` 参数并存入 `localStorage`，全站生效。真实统计上报在 `assets/js/main.js` 的 `reportChannel()` 中预留了 `sendBeacon` 位置（TODO 注释处），接入统计接口即可。

## 待对接（当前为占位交互）

- 登录 / 注册：点击弹出「即将上线」提示（`showComingSoon`）
- 锁定案例详情、常见问题、用户协议、隐私政策：同上
- 配置后台联动：`data.js` 即配置读取层，后续接入配置后台接口时保持字段结构不变即可无缝切换
