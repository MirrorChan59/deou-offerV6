/* ============================================================
 * 得欧求职 · 配置实时同步加载器
 * 策略（与 data.js 头部注释约定一致：字段结构保持不变）：
 *   1. 页面先用内置 data.js 秒开（弱网 / 接口异常体验不降级）；
 *   2. 异步拉取 /api/config，比对版本号，仅更新变化的模块；
 *   3. 60 秒轮询 + 页面重新可见时立即拉取；
 *   4. 远程模块为空数组时保留本地内置数据（空表不清空官网）。
 * ============================================================ */
(function () {
  var API_URL = "/api/config";
  var POLL_MS = 60 * 1000;
  var currentVersion = null;

  /* ---------- 各模块应用（就地更新 data.js 的全局常量并局部重渲染） ---------- */
  function applyBanners(list) {
    if (!Array.isArray(list) || !list.length || typeof BANNERS === "undefined") return false;
    var mapped = list.map(function (b, i) {
      var local = BANNERS[i] || {};
      return {
        tag: b.tag || local.tag || "",
        title: b.title || local.title || "",
        subtitle: b.subtitle || local.subtitle || "",
        gradient: b.gradient || local.gradient || "linear-gradient(120deg, #1e3a8a 0%, #4f46e5 60%, #6d28d9 100%)",
        image: b.image || local.image || "",
        detailImage: b.detailImage || local.detailImage || "",
      };
    });
    BANNERS.splice.apply(BANNERS, [0, BANNERS.length].concat(mapped));
    return true;
  }

  function applyCases(list) {
    if (!Array.isArray(list) || !list.length || typeof CASES === "undefined") return false;
    CASES.splice.apply(CASES, [0, CASES.length].concat(list));
    return true;
  }

  function applyInstructors(list) {
    if (!Array.isArray(list) || !list.length || typeof INSTRUCTORS === "undefined") return false;
    INSTRUCTORS.splice.apply(INSTRUCTORS, [0, INSTRUCTORS.length].concat(list));
    return true;
  }

  /* 合作企业：按名称对位合并（远程字段为空时保留本地值，如未上传图标则沿用本地品牌图标） */
  function applyCompanies(list) {
    if (!Array.isArray(list) || !list.length || typeof COMPANIES === "undefined") return false;
    var mapped = list.map(function (c, i) {
      var local = COMPANIES.filter(function (x) { return x.name === c.name; })[0] || COMPANIES[i] || {};
      return {
        name: c.name || local.name || "",
        product: c.product || local.product || "",
        color: c.color || local.color || "#2563eb",
        icon: c.icon || local.icon || "",
      };
    });
    COMPANIES.splice.apply(COMPANIES, [0, COMPANIES.length].concat(mapped));
    return true;
  }

  /* 服务流程：按步骤编号对位合并（只覆盖标题和图片，保留本地文案与配图说明） */
  function applyProcess(list) {
    if (!Array.isArray(list) || !list.length || typeof PROCESS_STEPS === "undefined") return false;
    var changed = false;
    list.forEach(function (s) {
      var idx = parseInt(s.no, 10) - 1;
      if (isNaN(idx) || !PROCESS_STEPS[idx]) return;
      if (s.title) { PROCESS_STEPS[idx].title = s.title; changed = true; }
      (s.images || []).forEach(function (url, j) {
        if (url && PROCESS_STEPS[idx].shots[j]) {
          PROCESS_STEPS[idx].shots[j].img = url;
          changed = true;
        }
      });
    });
    return changed;
  }

  function applyChannels(list) {
    if (!Array.isArray(list)) return false;
    window.DEOU_CHANNELS = list;
    if (typeof applyChannelQr === "function") {
      try { applyChannelQr(); } catch (e) { /* 页面静态二维码更新失败不影响其他模块 */ }
    }
    return false; /* 渠道数据供弹窗与后台消费，无需重渲染页面区块 */
  }

  var RENDERERS = {
    banners: function () { if (typeof initBanner === "function") initBanner(); },
    cases: function () { if (typeof initCases === "function") initCases(); },
    instructors: function () { if (typeof initLecturers === "function") initLecturers(); },
    companies: function () { if (typeof initHomeSections === "function") initHomeSections(); },
    processSteps: function () { if (typeof initProcess === "function") initProcess(); },
  };

  var APPLIERS = {
    banners: applyBanners,
    cases: applyCases,
    instructors: applyInstructors,
    companies: applyCompanies,
    processSteps: applyProcess,
    channels: applyChannels,
  };

  function apply(modules) {
    if (!modules) return;
    Object.keys(APPLIERS).forEach(function (key) {
      if (!(key in modules)) return;
      var changed = false;
      try { changed = APPLIERS[key](modules[key]); } catch (e) { /* 单模块失败不影响其他模块 */ }
      if (changed && RENDERERS[key]) {
        try { RENDERERS[key](); } catch (e) { /* 重渲染失败保留现状 */ }
      }
    });
  }

  /* ---------- 拉取 ---------- */
  function pull() {
    fetch(API_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || !cfg.ok || !cfg.version || cfg.version === currentVersion) return;
        currentVersion = cfg.version;
        apply(cfg.modules);
      })
      .catch(function () { /* 接口异常时静默，继续用内置数据 */ });
  }

  window.addEventListener("load", pull);
  setInterval(pull, POLL_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) pull();
  });
})();
