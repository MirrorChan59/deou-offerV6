/* ============================================================
 * 得欧求职 · 官网前台交互
 * 无依赖原生 JS：轮播 / 方向标签 / 案例筛选 / 二维码弹窗 / 渠道归因
 * ============================================================ */

/* ---------- 图标库（内联 SVG） ---------- */
const ICONS = {
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
};
function icon(name) { return ICONS[name] || ICONS.image; }

/* ---------- 渠道归因：读取 ?channel= 参数并持久化 ----------
 * 渠道二维码生成的官网 URL 携带 channel 参数，前台在此捕获。
 * 后续接真实统计接口时，在 reportChannel() 内补充上报逻辑。 */
(function captureChannel() {
  try {
    const ch = new URLSearchParams(location.search).get("channel");
    if (ch) {
      localStorage.setItem("deou_channel", JSON.stringify({ channel: ch, ts: Date.now() }));
    }
    window.DEOU_CHANNEL = ch || (JSON.parse(localStorage.getItem("deou_channel") || "null") || {}).channel || null;
  } catch (e) { window.DEOU_CHANNEL = null; }
})();
/* ---------- 访客标识：localStorage 持久化，用于 UV 按天去重 ---------- */
function getVid() {
  try {
    var v = localStorage.getItem("deou_vid");
    if (!v) {
      v = (crypto.randomUUID ? crypto.randomUUID() : "v" + Date.now() + Math.random().toString(36).slice(2));
      localStorage.setItem("deou_vid", v);
    }
    return v;
  } catch (e) { return ""; }
}
/* ---------- 渠道事件上报：POST /api/track（统计-渠道事件表） ---------- */
function trackEvent(event, extra) {
  try {
    var payload = JSON.stringify(Object.assign({
      channel: window.DEOU_CHANNEL || "direct",
      event: event,
      page: location.pathname,
      vid: getVid(),
    }, extra || {}));
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    }
  } catch (e) { /* 统计失败不影响访问 */ }
}
/* 全站访问上报（每次页面加载一次，UV 在报表侧按访客ID按天去重） */
trackEvent("访问");

/* ---------- 二维码 / 提示弹窗 ---------- */
function showModal(html, cls) {
  let mask = document.querySelector(".modal-mask");
  if (!mask) {
    mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = '<div class="modal"><button class="close" aria-label="关闭">×</button><div class="modal-body"></div></div>';
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => { if (e.target === mask) mask.classList.remove("show"); });
    mask.querySelector(".close").addEventListener("click", () => mask.classList.remove("show"));
  }
  mask.querySelector(".modal-body").innerHTML = html;
  mask.className = "modal-mask show" + (cls ? " " + cls : "");
}
function showQrModal() {
  trackEvent("扫码");
  var ch = (window.DEOU_CHANNELS || []).filter(function (c) { return c.enabled && c.qrImage; })[0];
  var qr = ch ? ch.qrImage : "assets/img/qr-wechat.png";
  var caption = (ch ? ch.name : "得欧求职顾问") + " · 扫码添加 · 免费评估";
  showModal(`
    <h3>添加顾问微信</h3>
    <p>微信扫一扫，添加求职顾问<br>即可获得免费职业诊断机会</p>
    <div class="qr-img"><img src="${qr}" alt="顾问微信二维码"></div>
    <p class="qr-caption">${caption}</p>`);
}
function showComingSoon(feature) {
  showModal(`<h3>${feature || "登录"}</h3><p>该功能即将上线，敬请期待。<br>如需帮助可先添加顾问微信咨询。</p>
    <div style="margin-top:22px"><button class="btn btn-primary" onclick="document.querySelector('.modal-mask').classList.remove('show');showQrModal()">添加顾问微信</button></div>`);
}
/* 图片点击预览（服务流程配图等）：大图弹层，点击遮罩或 × 关闭 */
function showImagePreview(src, alt) {
  if (!src) return;
  showModal(`<img class="preview-img" src="${src}" alt="${alt || "图片预览"}">`, "img-preview");
}

/* ---------- 用户登录 / 注册（手机号+密码，数据落多维表格「统计-注册用户」） ---------- */
var AUTH = {
  token: localStorage.getItem("deou_token") || "",
  phone: localStorage.getItem("deou_phone") || "",
};
function isLoggedIn() { return !!AUTH.token; }
function setAuth(token, phone) {
  AUTH.token = token; AUTH.phone = phone;
  try { localStorage.setItem("deou_token", token); localStorage.setItem("deou_phone", phone); } catch (e) { /* 隐私模式 */ }
}
function clearAuth() {
  AUTH.token = ""; AUTH.phone = "";
  try { localStorage.removeItem("deou_token"); localStorage.removeItem("deou_phone"); } catch (e) { /* 忽略 */ }
}
/* 登录 / 注册弹窗（tabs 切换） */
function showLoginModal(mode) {
  mode = mode === "register" ? "register" : "login";
  showModal(`
    <h3>登录 / 注册</h3>
    <div class="auth-tabs">
      <button class="auth-tab ${mode === "login" ? "on" : ""}" onclick="showLoginModal('login')">登录</button>
      <button class="auth-tab ${mode === "register" ? "on" : ""}" onclick="showLoginModal('register')">注册</button>
    </div>
    <div class="auth-form">
      <input id="authPhone" type="tel" maxlength="11" placeholder="手机号" autocomplete="tel">
      <input id="authPwd" type="password" maxlength="64" placeholder="密码（至少 6 位）" autocomplete="${mode === "login" ? "current-password" : "new-password"}">
      <div class="auth-err" id="authErr"></div>
      <button class="btn btn-primary auth-submit" onclick="submitAuth('${mode}')">${mode === "login" ? "登录" : "注册并登录"}</button>
    </div>
    <p class="auth-note">该手机号仅作为登录账号，用于解锁完整案例内容</p>`, "auth-modal");
}
function submitAuth(mode) {
  var phone = document.getElementById("authPhone").value.trim();
  var pwd = document.getElementById("authPwd").value;
  var err = document.getElementById("authErr");
  if (!/^1\d{10}$/.test(phone)) { err.textContent = "请输入 11 位手机号"; return; }
  if (pwd.length < 6) { err.textContent = "密码至少 6 位"; return; }
  err.textContent = "";
  var btn = document.querySelector(".auth-submit");
  var label = mode === "login" ? "登录" : "注册并登录";
  btn.disabled = true; btn.textContent = "提交中…";
  fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: mode, phone: phone, password: pwd }),
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (!data || !data.ok) {
      err.textContent = (data && data.error) || "操作失败，请稍后重试";
      btn.disabled = false; btn.textContent = label;
      return;
    }
    setAuth(data.token, data.phone);
    applyAuthState();
    unlockCases(); /* 案例页立即解锁，无需刷新 */
    showModal(`<h3>${mode === "login" ? "登录成功" : "注册成功"}</h3><p>已解锁全部成功案例的完整内容。</p>`);
    setTimeout(function () {
      var mask = document.querySelector(".modal-mask");
      if (mask) mask.classList.remove("show");
    }, 1200);
  }).catch(function () {
    err.textContent = "网络异常，请稍后重试";
    btn.disabled = false; btn.textContent = label;
  });
}
/* 登录态 UI：导航按钮文案切换 + 案例页锁定提示条显隐 */
function applyAuthState() {
  document.querySelectorAll("[data-action='login']").forEach(function (b) {
    if (!b.dataset.label) b.dataset.label = b.textContent.trim();
    b.textContent = isLoggedIn() ? "退出登录" : b.dataset.label;
  });
  var notice = document.querySelector(".lock-notice");
  if (notice) notice.style.display = isLoggedIn() ? "none" : "";
}
/* 登录后拉取完整案例（不脱敏）并替换渲染 */
function unlockCases() {
  if (!isLoggedIn() || typeof CASES === "undefined") return;
  if (!document.getElementById("caseTable")) return; /* 仅案例页需要 */
  fetch("/api/cases", { headers: { "Authorization": "Bearer " + AUTH.token }, cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.ok && Array.isArray(data.cases) && data.cases.length) {
        window.DEOU_CASES_UNLOCKED = true; /* 阻止配置轮询用脱敏数据回灌 */
        CASES.splice.apply(CASES, [0, CASES.length].concat(data.cases));
        initCases();
      } else if (data && !data.ok) {
        clearAuth(); /* 令牌失效：回到未登录态 */
        applyAuthState();
      }
    })
    .catch(function () { /* 接口异常时保持脱敏列表 */ });
}

/* ---------- 页面静态二维码与「预约咨询」弹窗同源 ----------
 * 带 data-qr-channel="<渠道code>" 的 <img>，在渠道配置加载后替换为对应渠道二维码；
 * 渠道未配置二维码图片时保留 <img> 原始 src（本地真实二维码兜底）。 */
function applyChannelQr() {
  var channels = window.DEOU_CHANNELS || [];
  document.querySelectorAll("img[data-qr-channel]").forEach(function (img) {
    var ch = channels.filter(function (c) { return c.code === img.dataset.qrChannel && c.enabled && c.qrImage; })[0];
    if (ch && img.getAttribute("src") !== ch.qrImage) img.src = ch.qrImage;
  });
}

/* ---------- 首页：Banner 轮播 ---------- */
function showBannerDetail(i) {
  const b = BANNERS[i];
  if (!b || !b.detailImage) return;
  showModal(`
    <h3>${b.title}</h3>
    <div class="detail-img"><img src="${b.detailImage}" alt="${b.title}·详情"></div>`, "img-modal");
}
function initBanner() {
  const root = document.getElementById("bannerCarousel");
  if (!root) return;
  const track = root.querySelector(".banner-track");
  track.innerHTML = BANNERS.map((b, i) => `
    <div class="banner-slide${b.image ? " has-image" : ""}${b.mobileImage ? " has-mobile-bg" : ""}" style="background:${b.gradient}">
      ${b.image
        ? `<div class="banner-bg" style="background-image:url('${b.image}')"></div>`
        : `<svg class="deco" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice">
        <circle cx="980" cy="80" r="130" fill="rgba(255,255,255,.07)"/>
        <circle cx="1060" cy="300" r="90" fill="rgba(255,255,255,.05)"/>
        <circle cx="140" cy="340" r="70" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="14" stroke-dasharray="2 22" stroke-linecap="round"/>
      </svg>`}
      ${b.mobileImage ? `<div class="banner-bg banner-bg-m" style="background-image:url('${b.mobileImage}')"></div>` : ""}
      <div class="banner-inner">
        <span class="banner-tag">${b.tag}</span>
        <h1 class="banner-title">${b.title}</h1>
        <p class="banner-sub">${b.subtitle}</p>
        ${b.detailImage ? `<button class="banner-cta" type="button" data-detail="${i}">了解详情<span class="arr">→</span></button>` : ""}
      </div>
    </div>`).join("");
  if (!root.dataset.bound) {
    root.dataset.bound = "1";
    track.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-detail]");
      if (btn) showBannerDetail(+btn.dataset.detail);
    });
  }
  const dots = root.querySelector(".banner-dots");
  dots.innerHTML = BANNERS.map((_, i) => `<button data-i="${i}" aria-label="第${i + 1}张"></button>`).join("");
  /* 状态挂在 DOM 上：重复初始化（配置热更新重渲染）时不产生多个定时器 */
  root._cur = 0;
  function go(i) {
    root._cur = (i + BANNERS.length) % BANNERS.length;
    track.style.transform = `translateX(-${root._cur * 100}%)`;
    root.classList.toggle("light-mode", !!(BANNERS[root._cur].image || BANNERS[root._cur].mobileImage));
    dots.querySelectorAll("button").forEach((d, j) => d.classList.toggle("active", j === root._cur));
  }
  function auto() { clearInterval(root._timer); root._timer = setInterval(() => go(root._cur + 1), 5000); }
  if (!root.dataset.boundListeners) {
    root.dataset.boundListeners = "1";
    root.querySelector(".prev").addEventListener("click", () => { go(root._cur - 1); auto(); });
    root.querySelector(".next").addEventListener("click", () => { go(root._cur + 1); auto(); });
    dots.addEventListener("click", (e) => { if (e.target.dataset.i) { go(+e.target.dataset.i); auto(); } });
    /* 移动端手势滑动（移动端已隐藏左右箭头，滑动+圆点为主交互） */
    let touchX = null;
    root.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) { go(root._cur + (dx < 0 ? 1 : -1)); auto(); }
      touchX = null;
    }, { passive: true });
  }
  go(0); auto();
}

/* ---------- 首页：核心方向 / 合作企业 ---------- */
function initHomeSections() {
  const tracks = document.getElementById("tracksGrid");
  if (tracks) {
    tracks.innerHTML = TRACKS.map((t) => `
      <a class="track-card" href="directions.html#${t.id}">
        <div class="track-icon">${icon(t.icon)}</div>
        <h3>${t.name}</h3><p>${t.desc}</p>
      </a>`).join("");
  }
  const companies = document.getElementById("companiesGrid");
  if (companies) {
    companies.innerHTML = COMPANIES.map((c) => `
      <div class="company-card">
        ${c.icon ? `<img class="company-logo-img" src="${c.icon}" alt="${c.name}" loading="lazy">` : `<div class="company-logo" style="background:${c.color}">${c.name[0]}</div>`}
        <h4>${c.name}</h4><span>${c.product}</span>
      </div>`).join("");
    document.getElementById("companiesNote").textContent = COMPANIES_NOTE;
  }
}

/* ---------- 服务流程页 ---------- */
function initProcess() {
  const root = document.getElementById("processSteps");
  if (!root) return;
  root.innerHTML = PROCESS_STEPS.map((s, i) => `
    <div class="process-step ${i % 2 ? "flip" : ""}">
      <div class="container">
        <div class="step-info">
          <div class="step-head">
            <span class="step-no">${s.no}</span>
            <div><h2>${s.title}</h2><div class="step-en">${s.en}</div></div>
          </div>
          <p class="step-desc">${s.desc}</p>
          <div class="step-feats">
            ${s.feats.map((f) => `
              <div class="step-feat">
                <div class="ico">${icon("image")}</div>
                <div><strong>${f.name}</strong><span>${f.sub}</span></div>
              </div>`).join("")}
          </div>
        </div>
        <div class="step-media">
          ${s.shots.map((sh) => `
            <div class="step-shot">
              <img src="${sh.img}" alt="${sh.caption}" onclick="showImagePreview('${sh.img}', '${sh.caption}')">
              <span class="shot-tag">${sh.tag}</span>
            </div>`).join("")}
        </div>
      </div>
    </div>`).join("");
}

/* ---------- 成功案例页 ---------- */
/* 案例详情弹层：文字信息 + 运营配置的详情图（最多 5 张，留空则跳过） */
function showCaseDetail(i) {
  const c = CASES[i];
  if (!c) return;
  const imgs = (c.detailImages || []).filter(Boolean);
  showModal(`
    <h3>案例详情</h3>
    <div class="case-meta">
      <div><span>学员</span><b>${c.name} · ${c.school}</b></div>
      <div><span>目标方向</span><b>${c.direction}</b></div>
      <div><span>届别</span><b>${c.year || "—"}</b></div>
      <div><span>服务类型</span><b>${c.service || "—"}</b></div>
      <div><span>Offer</span><b class="offer">${c.offer}</b></div>
    </div>
    ${imgs.length
      ? `<div class="case-detail-imgs">${imgs.map((src, k) => `<img src="${src}" alt="${c.name}·案例详情图${k + 1}">`).join("")}</div>`
      : ""}`,
    "case-modal");
}
function initCases() {
  const filtersRoot = document.getElementById("caseFilters");
  const table = document.getElementById("caseTable");
  if (!filtersRoot || !table) return;
  filtersRoot.innerHTML = CASE_FILTERS.map((f, i) =>
    `<button class="filter-pill ${i === 0 ? "active" : ""}" data-f="${f}">${f}</button>`).join("");
  function match(c, f) {
    if (f === "全部") return true;
    if (f === "市场") return c.direction.indexOf("市场") === 0;
    return c.direction === f || (f === "运营" && c.direction.indexOf("运营") > -1);
  }
  function render(f) {
    const list = CASES.filter((c) => match(c, f));
    table.innerHTML = `
      <div class="case-row head">
        <div>姓名 / 学校</div><div>目标方向</div><div class="hide-m">届别</div>
        <div class="hide-m">服务类型</div><div>Offer</div><div style="text-align:right">查看</div>
      </div>` + list.map((c) => `
      <div class="case-row">
        <div class="case-person">
          <div class="case-avatar ${c.locked ? "locked" : ""}">${c.surname}</div>
          <div><b>${c.name}</b><span>${c.school}</span></div>
        </div>
        <div><span class="tag-pill">${c.direction}</span></div>
        <div class="hide-m">${c.year}</div>
        <div class="hide-m">${c.service}</div>
        <div class="case-offer">${c.offer}</div>
        <div style="text-align:right">${c.locked && !isLoggedIn()
          ? '<button class="btn btn-ghost-light" onclick="showLoginModal(\'login\')">🔒 登录查看</button>'
          : `<button class="btn btn-outline" onclick="showCaseDetail(${CASES.indexOf(c)})">查看详情 →</button>`}</div>
      </div>`).join("");
    const unlocked = CASES.length;
    document.getElementById("caseTotal").textContent = isLoggedIn()
      ? `共 ${unlocked} 个成功案例 · 已解锁完整内容`
      : `共 ${unlocked} 个成功案例 · 登录查看全部 ${unlocked} 个案例`;
  }
  if (!filtersRoot.dataset.bound) {
    filtersRoot.dataset.bound = "1";
    filtersRoot.addEventListener("click", (e) => {
      if (!e.target.dataset.f) return;
      filtersRoot.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      e.target.classList.add("active");
      render(e.target.dataset.f);
    });
  }
  render("全部");
}

/* ---------- 讲师团队页 ---------- */
function initLecturers() {
  const grid = document.getElementById("lecturerGrid");
  if (!grid) return;
  grid.innerHTML = INSTRUCTORS.map((t) => `
    <div class="lecturer-card">
      <div class="lecturer-photo">
        <span class="field-tag">${t.field}</span>
        ${t.photo
          ? `<img src="${t.photo}" alt="${t.name}">`
          : `<svg class="placeholder-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z"/></svg>`}
      </div>
      <div class="lecturer-body">
        <h3>${t.name}</h3>
        <div class="role">${t.role}</div>
        <p class="bio">${t.bio}</p>
        <div class="lecturer-tags">${t.tags.map((x) => `<span>${x}</span>`).join("")}</div>
      </div>
    </div>`).join("");
}

/* ---------- 核心方向页 ---------- */
function initDirections() {
  const tabsRoot = document.getElementById("dirTabs");
  const content = document.getElementById("dirContent");
  if (!tabsRoot || !content) return;
  tabsRoot.innerHTML = DIRECTIONS.map((d) =>
    `<button class="dir-tab" data-id="${d.id}">${icon(d.icon)}${d.name}</button>`).join("");
  function render(id) {
    const d = DIRECTIONS.find((x) => x.id === id) || DIRECTIONS[0];
    tabsRoot.querySelectorAll(".dir-tab").forEach((t) => t.classList.toggle("active", t.dataset.id === d.id));
    content.innerHTML = `
      <div class="dir-hero">
        <span class="badge">${d.badge}</span>
        <h1>${d.name}</h1>
        <p class="intro">${d.intro}</p>
        <div class="dir-stats">
          ${d.stats.map((s) => `<div class="dir-stat"><b>${s.value}</b><span>${s.label}</span></div>`).join("")}
        </div>
      </div>

      <div class="dir-section">
        <h2>${d.mbtiTitle}</h2>
        <p class="sec-sub">性格特征与 MBTI 类型匹配参考</p>
        <div class="mbti-grid">
          ${d.mbti.map((m) => `
            <div class="mbti-card"><b class="type">${m.type}</b><div class="name">${m.name}</div><p>${m.desc}</p></div>`).join("")}
        </div>
      </div>

      <div class="dir-section">
        <h2>细分方向与工作状态</h2>
        <p class="sec-sub">${d.subsSub}</p>
        ${d.subs.map((s) => `
          <div class="subdir">
            <div class="subdir-head">
              <span class="no">${s.no}</span><h3>${s.title}</h3><span class="tag">${s.tag}</span>
            </div>
            <p class="subdir-desc">${s.desc}</p>
            <div class="salary-row">
              <span class="lab">薪资参考</span>
              <div class="item"><b>${s.salary[0]}</b><span>校招</span></div>
              <div class="item"><b>${s.salary[1]}</b><span>3年</span></div>
              <div class="item"><b>${s.salary[2]}</b><span>5年+</span></div>
            </div>
            <div class="subdir-cols">
              <div class="subdir-col"><b>${icon("briefcase")}日常工作状态</b><p>${s.work}</p></div>
              <div class="subdir-col"><b>${icon("check")}适合人群</b><p>${s.fit}</p></div>
            </div>
          </div>`).join("")}
      </div>

      <div class="dir-section">
        <h2>什么专业背景更对口？</h2>
        <p class="sec-sub">常见对口专业及优势分析</p>
        <div class="major-list">
          ${d.majors.map((m) => `<div class="major-item"><b>${m.name}</b><span class="dash">—</span><span>${m.desc}</span></div>`).join("")}
        </div>
      </div>

      <div class="dir-section">
        <h2>薪资水平与职业发展</h2>
        <p class="sec-sub">行业薪资参考与职业晋升路径</p>
        <div class="salary-cards">
          ${d.salaryLevels.map((s) => `
            <div class="salary-card"><div class="lv">${s.level}</div><b>${s.range}</b><span>${s.note}</span></div>`).join("")}
        </div>
        <div class="dir-section">
          <h2>职业发展路径</h2>
          <div class="path-line">
            ${d.path.map((p) => `
              <div class="path-item"><div class="role">${p.role}</div><div class="period">${p.period}</div><p>${p.desc}</p></div>`).join("")}
          </div>
        </div>
      </div>

      <div class="dir-cta">
        <div>
          <h2>想知道自己适合${d.name}方向吗？</h2>
          <p>添加顾问微信，获取15分钟1v1免费职业诊断</p>
        </div>
        <button class="btn btn-lg" onclick="showQrModal()">免费咨询</button>
      </div>`;
  }
  if (!tabsRoot.dataset.bound) {
    tabsRoot.dataset.bound = "1";
    tabsRoot.addEventListener("click", (e) => {
      const btn = e.target.closest(".dir-tab");
      if (!btn) return;
      history.replaceState(null, "", "#" + btn.dataset.id);
      render(btn.dataset.id);
      content.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  render((location.hash || "").slice(1) || DIRECTIONS[0].id);
}

/* ---------- 关于我们页 ---------- */
function initAbout() {
  const stats = document.getElementById("aboutStats");
  if (stats) stats.innerHTML = ABOUT.stats.map((s) => `<div class="stat-card"><b>${s.value}</b><span>${s.label}</span></div>`).join("");
  const schools = document.getElementById("schoolGrid");
  if (schools) schools.innerHTML = ABOUT.schools.map((s) => `
    <div class="school-card"><span class="emo">🎓</span><div><b>${s.name}</b><span>${s.note}</span></div></div>`).join("");
}

/* ---------- 全局：移动端抽屉导航 ---------- */
function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const mask = document.querySelector(".nav-mask");
  const drawer = document.querySelector(".nav-drawer");
  if (!toggle || !drawer) return;
  function setOpen(open) {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
  if (mask) mask.addEventListener("click", () => setOpen(false));
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
}

/* ---------- 全局：导航高亮 + 按钮接线 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(".main-nav a, .nav-drawer a").forEach((a) => {
    if (a.dataset.nav === page) a.classList.add("active");
  });
  document.querySelectorAll("[data-action='qr']").forEach((b) => b.addEventListener("click", showQrModal));
  document.querySelectorAll("[data-action='login']").forEach((b) => b.addEventListener("click", () => {
    if (isLoggedIn()) {
      clearAuth();
      window.DEOU_CASES_UNLOCKED = false;
      applyAuthState();
      showModal("<h3>已退出登录</h3><p>退出后案例将恢复脱敏展示。</p>");
      setTimeout(() => location.reload(), 900); /* 重新加载以恢复脱敏数据源 */
    } else {
      showLoginModal("login");
    }
  }));
  document.querySelectorAll("[data-action='doc']").forEach((b) => b.addEventListener("click", () => showComingSoon(b.textContent.trim())));
  applyAuthState();
  unlockCases();
  initBanner();
  initMobileNav();
  applyChannelQr();
  initHomeSections();
  initProcess();
  initCases();
  initLecturers();
  initDirections();
  initAbout();
});
