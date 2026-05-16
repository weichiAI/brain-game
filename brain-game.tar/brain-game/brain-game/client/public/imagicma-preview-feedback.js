(function () {
  var PREVIEW_REPAIR_CHANNEL = 'imagicma.preview-repair';
  var PREVIEW_REPAIR_VERSION = 1;
  var PROD_PARENT_ORIGINS = {
    'https://agentma.cn': true,
    'https://imagicma.cn': true,
  };
  var LOCAL_PARENT_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  var LOCAL_IMAGICMA_PARENT_RE = /^https?:\/\/([a-z0-9-]+\.)?local\.(agentma\.cn|imagicma\.cn)(:\d+)?$/i;
  var MAX_RESOURCE_CANDIDATES = 12;
  var PANEL_ID = 'imagicma-preview-feedback-root';

  var state = {
    panel: null,
    titleEl: null,
    bodyEl: null,
    metaEl: null,
    detailEl: null,
    statusEl: null,
    repairButton: null,
    refreshButton: null,
    error: null,
    requestInFlight: false,
    lastSignature: '',
    observer: null,
    parentOrigin: '',
  };

  var originalConsoleError = typeof console !== 'undefined' && typeof console.error === 'function'
    ? console.error.bind(console)
    : null;

  window.__IMAGICMA_PREVIEW_FEEDBACK__ = {
    reportModuleBootstrapError: function (error) {
      if (!error) return;
      resolveLatestViteErrorDetails().then(function (details) {
        if (details) {
          renderError(details);
          return;
        }
        reportStartupError(
          trimText(error.name) || 'ModuleBootstrapError',
          trimText(error.message) || normalizeWhitespace(error),
          trimText(error.stack) || trimText(error.message),
        );
      });
    },
  };

  if (originalConsoleError) {
    console.error = function () {
      maybeCaptureViteConsoleError(arguments);
      return originalConsoleError.apply(console, arguments);
    };
  }

  function trimText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeWhitespace(value) {
    return trimText(String(value || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n'));
  }

  function stringifyConsoleArgs(args) {
    return Array.prototype.map.call(args, function (arg) {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') {
        var message = trimText(arg.message);
        var stack = trimText(arg.stack);
        if (message && stack) return message + '\n' + stack;
        if (message) return message;
        try {
          return JSON.stringify(arg);
        } catch (_error) {
          return String(arg);
        }
      }
      return String(arg);
    }).join('\n');
  }

  function maybeCaptureViteConsoleError(argsLike) {
    var text = normalizeWhitespace(stringifyConsoleArgs(argsLike));
    if (!text) return;
    if (text.indexOf('[vite] Internal Server Error') !== 0) return;

    renderError({
      title: '预览编译失败',
      errorName: 'ViteConsoleError',
      errorMessage: text,
      errorStack: text,
    });
  }

  function isAllowedParentOrigin(origin) {
    if (!origin) return false;
    return !!PROD_PARENT_ORIGINS[origin] || LOCAL_PARENT_RE.test(origin) || LOCAL_IMAGICMA_PARENT_RE.test(origin);
  }

  function resolveParentOrigin() {
    if (state.parentOrigin && isAllowedParentOrigin(state.parentOrigin)) {
      return state.parentOrigin;
    }

    if (window.parent === window) {
      state.parentOrigin = '';
      return '';
    }

    var referrer = trimText(document.referrer);
    if (!referrer) {
      state.parentOrigin = '';
      return '';
    }

    try {
      var origin = new URL(referrer).origin;
      state.parentOrigin = isAllowedParentOrigin(origin) ? origin : '';
      return state.parentOrigin;
    } catch (_error) {
      state.parentOrigin = '';
      return '';
    }
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'repair_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function hasBootstrappedApp() {
    var root = document.getElementById('root');
    if (!root) return false;
    if (root.childElementCount > 0) return true;
    return trimText(root.textContent).length > 0;
  }

  function buildSummary(details) {
    var message = normalizeWhitespace(details.errorMessage);
    if (!message) {
      return '检测到预览初始化失败，请刷新页面后重试。';
    }

    var lines = message.split('\n').map(trimText).filter(Boolean);
    if (lines.length === 0) {
      return '检测到预览初始化失败，请刷新页面后重试。';
    }

    var firstLine = lines[0];
    if (/^Internal Server Error$/i.test(firstLine) && lines[1]) {
      firstLine = lines[1];
    }
    return firstLine;
  }

  function getNormalizedLines(text) {
    return normalizeWhitespace(text).split('\n').map(trimText).filter(Boolean);
  }

  function extractKeyErrorLine(text) {
    var lines = getNormalizedLines(text);
    for (var index = 0; index < lines.length; index += 1) {
      var line = lines[index];
      if (!line) continue;
      if (/^\[vite\]/i.test(line)) continue;
      if (/^Internal Server Error$/i.test(line)) continue;
      if (/^plugin:/i.test(line)) continue;
      if (/^id:/i.test(line)) continue;
      if (/^at\s+/i.test(line)) continue;
      if (/^\(?Error overlay failed to load\)?$/i.test(line)) continue;
      return line;
    }
    return '';
  }

  function extractFieldValue(text, fieldName) {
    var escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regexp = new RegExp('^' + escapedFieldName + ':\\s*(.+)$', 'mi');
    var match = normalizeWhitespace(text).match(regexp);
    return match && match[1] ? trimText(match[1]) : '';
  }

  function extractFrameSnippet(text) {
    var lines = normalizeWhitespace(text).split('\n');
    var caretIndex = -1;
    var index = 0;
    for (; index < lines.length; index += 1) {
      if (lines[index].indexOf('^') >= 0) {
        caretIndex = index;
        break;
      }
    }

    if (caretIndex >= 0) {
      var start = Math.max(0, caretIndex - 2);
      var end = Math.min(lines.length, caretIndex + 2);
      return lines.slice(start, end).join('\n').trim();
    }

    var frameLines = lines.filter(function (line) {
      return /^\s*(>?[\s\d|]+|at\s+)/.test(line);
    });
    return frameLines.slice(0, 5).join('\n').trim();
  }

  function buildRenderedDetail(error) {
    var sourceText = [error.errorMessage, error.errorStack].filter(Boolean).join('\n\n');
    var keyErrorLine = extractKeyErrorLine(sourceText);
    var frameSnippet = extractFrameSnippet(sourceText);
    var plugin = extractFieldValue(sourceText, 'plugin');
    var id = extractFieldValue(sourceText, 'id');
    var sections = [];

    if (trimText(error.errorName)) {
      sections.push('错误类型\n' + trimText(error.errorName));
    }
    if (trimText(error.errorMessage)) {
      sections.push('错误信息\n' + trimText(error.errorMessage));
    }
    if (trimText(error.errorStack)) {
      sections.push('完整堆栈\n' + trimText(error.errorStack));
    }
    if (!sections.length && frameSnippet) {
      sections.push('定位片段\n' + frameSnippet);
    }

    return {
      keyErrorLine: keyErrorLine,
      detailText: sections.join('\n\n'),
      metaText: [
        plugin ? ('plugin: ' + plugin) : '',
        id ? ('id: ' + id) : '',
      ].filter(Boolean).join('   '),
    };
  }

  function getViteOverlayText(overlay) {
    if (!overlay) return '';
    var root = overlay.shadowRoot || overlay;
    return normalizeWhitespace(root.textContent || overlay.textContent || '');
  }

  function sameOriginUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function isLikelySourceRequest(pathname) {
    return (
      pathname.indexOf('/src/') === 0
      || pathname.indexOf('/@fs/') === 0
      || /\.(?:[cm]?js|[jt]sx?|css)$/.test(pathname)
    );
  }

  function listRecentResourceCandidates() {
    if (!window.performance || typeof window.performance.getEntriesByType !== 'function') {
      return [];
    }

    var entries = window.performance.getEntriesByType('resource');
    var seen = {};
    var urls = [];

    for (var index = entries.length - 1; index >= 0; index -= 1) {
      var entry = entries[index];
      if (!entry || !entry.name) continue;
      var parsed = sameOriginUrl(entry.name);
      if (!parsed) continue;
      if (!isLikelySourceRequest(parsed.pathname)) continue;
      if (parsed.pathname.indexOf('/imagicma-preview-feedback.js') >= 0) continue;
      if (parsed.pathname.indexOf('/@vite/client') >= 0) continue;
      if (seen[parsed.href]) continue;
      seen[parsed.href] = true;
      urls.push(parsed.href);
      if (urls.length >= MAX_RESOURCE_CANDIDATES) {
        break;
      }
    }

    return urls;
  }

  function parseViteErrorPayloadFromHtml(html) {
    var text = typeof html === 'string' ? html : '';
    if (!text) return null;

    var match = text.match(/const error = (\{[\s\S]*?\})\s*try\s*\{/);
    if (!match || !match[1]) return null;

    try {
      return JSON.parse(match[1]);
    } catch (_error) {
      return null;
    }
  }

  function buildDetailedViteMessage(payload, requestUrl) {
    if (!payload) return '';

    var sections = ['[vite] Internal Server Error'];
    var message = trimText(payload.message);
    var frame = trimText(payload.frame);
    var plugin = trimText(payload.plugin);
    var id = trimText(payload.id) || trimText(requestUrl);
    var stack = trimText(payload.stack);

    if (message) sections.push(message);
    if (frame) sections.push(frame);
    if (plugin) sections.push('plugin: ' + plugin);
    if (id) sections.push('id: ' + id);
    if (stack) sections.push(stack);

    return sections.join('\n\n');
  }

  function fetchViteErrorDetailsFromUrl(url) {
    return window.fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(function (response) {
      if (!response || response.status < 500) {
        return null;
      }

      return response.text().then(function (html) {
        var payload = parseViteErrorPayloadFromHtml(html);
        if (!payload) return null;

        var detailedMessage = buildDetailedViteMessage(payload, url);
        return {
          title: '预览编译失败',
          errorName: trimText(payload.plugin) || 'ViteCompileError',
          errorMessage: detailedMessage || trimText(payload.message) || 'Vite 编译失败',
          errorStack: [trimText(payload.frame), trimText(payload.stack)].filter(Boolean).join('\n\n') || detailedMessage,
        };
      }).catch(function () {
        return null;
      });
    }).catch(function () {
      return null;
    });
  }

  function resolveLatestViteErrorDetails() {
    var candidates = listRecentResourceCandidates();
    if (candidates.length === 0) {
      return Promise.resolve(null);
    }

    var index = 0;

    function next() {
      if (index >= candidates.length) {
        return Promise.resolve(null);
      }

      var candidate = candidates[index];
      index += 1;
      return fetchViteErrorDetailsFromUrl(candidate).then(function (details) {
        if (details) return details;
        return next();
      });
    }

    return next();
  }

  function dismissPanel() {
    if (state.panel && state.panel.parentNode) {
      state.panel.parentNode.removeChild(state.panel);
    }
    state.panel = null;
    state.titleEl = null;
    state.bodyEl = null;
    state.metaEl = null;
    state.detailEl = null;
    state.statusEl = null;
    state.repairButton = null;
    state.refreshButton = null;
    state.error = null;
    state.requestInFlight = false;
    state.lastSignature = '';
  }

  function ensurePanel() {
    if (state.panel && document.body.contains(state.panel)) {
      return state.panel;
    }

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'alert');
    panel.style.position = 'fixed';
    panel.style.inset = '0';
    panel.style.zIndex = '2147483647';
    panel.style.display = 'flex';
    panel.style.alignItems = 'center';
    panel.style.justifyContent = 'center';
    panel.style.padding = '24px';
    panel.style.background = 'linear-gradient(135deg, #243b53 0%, #3f497f 48%, #145374 100%)';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

    var card = document.createElement('div');
    card.style.width = 'min(720px, 100%)';
    card.style.maxHeight = 'min(88vh, 900px)';
    card.style.overflow = 'auto';
    card.style.borderRadius = '28px';
    card.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    card.style.background = 'rgba(7, 16, 34, 0.38)';
    card.style.boxShadow = '0 28px 80px rgba(2, 8, 23, 0.45)';
    card.style.backdropFilter = 'blur(18px)';
    card.style.padding = '32px';

    var badge = document.createElement('div');
    badge.textContent = 'Preview bootstrap error';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.borderRadius = '999px';
    badge.style.padding = '6px 10px';
    badge.style.fontSize = '12px';
    badge.style.letterSpacing = '0.08em';
    badge.style.textTransform = 'uppercase';
    badge.style.color = 'rgba(255,255,255,0.82)';
    badge.style.background = 'rgba(255,255,255,0.1)';

    var title = document.createElement('h1');
    title.style.margin = '18px 0 10px';
    title.style.fontSize = 'clamp(28px, 4vw, 36px)';
    title.style.lineHeight = '1.1';
    title.style.fontWeight = '700';

    var body = document.createElement('p');
    body.style.margin = '0';
    body.style.fontSize = '15px';
    body.style.lineHeight = '1.7';
    body.style.color = 'rgba(255,255,255,0.82)';

    var meta = document.createElement('p');
    meta.style.margin = '12px 0 0';
    meta.style.fontSize = '12px';
    meta.style.lineHeight = '1.6';
    meta.style.color = 'rgba(255,255,255,0.62)';
    meta.style.display = 'none';

    var detail = document.createElement('pre');
    detail.style.margin = '18px 0 0';
    detail.style.padding = '18px';
    detail.style.borderRadius = '20px';
    detail.style.background = 'rgba(2, 6, 23, 0.42)';
    detail.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    detail.style.whiteSpace = 'pre-wrap';
    detail.style.wordBreak = 'break-word';
    detail.style.fontSize = '13px';
    detail.style.lineHeight = '1.65';
    detail.style.color = 'rgba(255,255,255,0.92)';

    var status = document.createElement('p');
    status.style.minHeight = '22px';
    status.style.margin = '16px 0 0';
    status.style.fontSize = '13px';
    status.style.lineHeight = '1.6';
    status.style.color = 'rgba(255,255,255,0.76)';

    var actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '12px';
    actions.style.marginTop = '24px';

    var repairButton = document.createElement('button');
    repairButton.type = 'button';
    repairButton.textContent = '一键修复';
    repairButton.style.height = '42px';
    repairButton.style.padding = '0 18px';
    repairButton.style.borderRadius = '999px';
    repairButton.style.border = 'none';
    repairButton.style.background = '#ffffff';
    repairButton.style.color = '#0f172a';
    repairButton.style.fontSize = '14px';
    repairButton.style.fontWeight = '600';
    repairButton.style.cursor = 'pointer';

    var refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.textContent = '刷新页面';
    refreshButton.style.height = '42px';
    refreshButton.style.padding = '0 18px';
    refreshButton.style.borderRadius = '999px';
    refreshButton.style.border = '1px solid rgba(255,255,255,0.18)';
    refreshButton.style.background = 'rgba(255,255,255,0.08)';
    refreshButton.style.color = '#ffffff';
    refreshButton.style.fontSize = '14px';
    refreshButton.style.fontWeight = '600';
    refreshButton.style.cursor = 'pointer';

    repairButton.addEventListener('click', function () {
      void sendRepairRequest();
    });
    refreshButton.addEventListener('click', function () {
      window.location.reload();
    });

    actions.appendChild(repairButton);
    actions.appendChild(refreshButton);

    card.appendChild(badge);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(meta);
    card.appendChild(detail);
    card.appendChild(status);
    card.appendChild(actions);
    panel.appendChild(card);
    document.body.appendChild(panel);

    state.panel = panel;
    state.titleEl = title;
    state.bodyEl = body;
    state.metaEl = meta;
    state.detailEl = detail;
    state.statusEl = status;
    state.repairButton = repairButton;
    state.refreshButton = refreshButton;

    return panel;
  }

  function updateRepairButtonState() {
    if (!state.repairButton) return;
    var canRepair = !!resolveParentOrigin() && window.parent !== window && !!state.error;
    state.repairButton.disabled = state.requestInFlight || !canRepair;
    state.repairButton.style.opacity = state.requestInFlight || !canRepair ? '0.7' : '1';
    state.repairButton.style.cursor = state.requestInFlight || !canRepair ? 'not-allowed' : 'pointer';
    state.repairButton.textContent = canRepair ? '一键修复' : '仅支持在主界面预览中修复';
  }

  function renderError(details) {
    var signature = [
      trimText(details.title),
      trimText(details.errorName),
      trimText(details.errorMessage),
    ].join('|');
    if (signature === state.lastSignature) {
      return;
    }

    state.lastSignature = signature;
    state.error = {
      title: trimText(details.title) || '预览暂时不可用',
      errorName: trimText(details.errorName) || 'PreviewBootstrapError',
      errorMessage: normalizeWhitespace(details.errorMessage),
      errorStack: normalizeWhitespace(details.errorStack || details.errorMessage),
      timestamp: Date.now(),
    };

    ensurePanel();

    state.titleEl.textContent = state.error.title;
    var renderedDetail = buildRenderedDetail(state.error);
    state.bodyEl.textContent = renderedDetail.keyErrorLine
      ? ('检测到错误，完整报错信息如下。首条关键信息：' + renderedDetail.keyErrorLine)
      : '检测到预览初始化阶段的错误，下面展示完整报错信息。你可以把这些内容同步回主界面并自动发起修复，或先刷新页面。';
    if (state.metaEl) {
      state.metaEl.textContent = renderedDetail.metaText;
      state.metaEl.style.display = renderedDetail.metaText ? 'block' : 'none';
    }
    state.detailEl.textContent = renderedDetail.detailText;
    state.statusEl.textContent = '';
    state.requestInFlight = false;
    updateRepairButtonState();
  }

  function sendRepairRequest() {
    var parentOrigin = resolveParentOrigin();
    if (!state.error || !parentOrigin || window.parent === window || state.requestInFlight) {
      updateRepairButtonState();
      return Promise.resolve();
    }

    state.requestInFlight = true;
    state.statusEl.textContent = '';
    updateRepairButtonState();

    var requestId = createRequestId();

    return new Promise(function (resolve) {
      var timer = window.setTimeout(function () {
        cleanup();
        state.requestInFlight = false;
        state.statusEl.textContent = '主界面响应超时，请稍后重试或先刷新页面。';
        updateRepairButtonState();
        resolve();
      }, 4000);

      function cleanup() {
        window.clearTimeout(timer);
        window.removeEventListener('message', handleAck);
      }

      function handleAck(event) {
        if (event.source !== window.parent) return;
        if (event.origin !== parentOrigin) return;
        var data = event.data;
        if (!data || data.channel !== PREVIEW_REPAIR_CHANNEL || data.version !== PREVIEW_REPAIR_VERSION) return;
        if (data.type !== 'IMAGICMA_PREVIEW_REPAIR_ACK' || data.requestId !== requestId) return;

        cleanup();
        state.requestInFlight = false;
        state.statusEl.textContent = data.payload && data.payload.status === 'error'
          ? (trimText(data.payload && data.payload.message) || '同步失败，请稍后重试。')
          : '';
        updateRepairButtonState();
        resolve();
      }

      window.addEventListener('message', handleAck);

      try {
        window.parent.postMessage(
          {
            channel: PREVIEW_REPAIR_CHANNEL,
            version: PREVIEW_REPAIR_VERSION,
            type: 'IMAGICMA_PREVIEW_REPAIR_REQUEST',
            requestId: requestId,
            payload: {
              pageUrl: window.location.href,
              errorName: state.error.errorName,
              errorMessage: state.error.errorMessage,
              errorStack: state.error.errorStack,
              timestamp: state.error.timestamp,
            },
          },
          parentOrigin,
        );
      } catch (_error) {
        cleanup();
        state.requestInFlight = false;
        state.statusEl.textContent = '同步失败，请稍后重试或先刷新页面。';
        updateRepairButtonState();
        resolve();
      }
    });
  }

  function maybeReportOverlay() {
    var overlay = document.querySelector('vite-error-overlay');
    if (!overlay) {
      if (state.panel && hasBootstrappedApp()) {
        dismissPanel();
      }
      return;
    }

    window.setTimeout(function () {
      var text = getViteOverlayText(overlay);
      if (!text) return;
      try {
        overlay.style.display = 'none';
      } catch (_error) {
        // Ignore Vite overlay style write failures.
      }
      renderError({
        title: '预览编译失败',
        errorName: 'ViteCompileError',
        errorMessage: text,
        errorStack: text,
      });
    }, 0);
  }

  function reportStartupError(errorName, errorMessage, errorStack) {
    if (hasBootstrappedApp()) return;
    if (!trimText(errorMessage)) return;
    renderError({
      title: '预览加载失败',
      errorName: trimText(errorName) || 'PreviewBootstrapError',
      errorMessage: errorMessage,
      errorStack: errorStack || errorMessage,
    });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    if (!isAllowedParentOrigin(event.origin)) return;
    state.parentOrigin = event.origin;
    updateRepairButtonState();
  });

  window.addEventListener('error', function (event) {
    var error = event && event.error;
    var errorName = trimText(error && error.name) || 'PreviewBootstrapError';
    var errorMessage = trimText(error && error.message) || trimText(event && event.message);
    var errorStack = trimText(error && error.stack);
    reportStartupError(errorName, errorMessage, errorStack);
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    if (!reason) return;

    if (typeof reason === 'string') {
      reportStartupError('UnhandledRejection', reason, reason);
      return;
    }

    reportStartupError(
      trimText(reason.name) || 'UnhandledRejection',
      trimText(reason.message) || normalizeWhitespace(reason),
      trimText(reason.stack) || trimText(reason.message),
    );
  });

  state.observer = new MutationObserver(function () {
    maybeReportOverlay();
  });
  state.observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeReportOverlay, { once: true });
  } else {
    maybeReportOverlay();
  }

  window.setTimeout(maybeReportOverlay, 300);
})();
