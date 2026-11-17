(function () {
  var cfg = window.APP_CONFIG || {};

  function configured() {
    return cfg.API_URL && cfg.API_URL.indexOf('請換成') === -1;
  }

  async function handle(res) {
    if (!res.ok) throw new Error('連線失敗 (' + res.status + ')');
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || '發生錯誤');
    return data;
  }

  window.API = {
    configured: configured,
    get: async function (action) {
      if (!configured()) throw new Error('尚未設定 API_URL（assets/config.js）');
      var res = await fetch(cfg.API_URL + '?action=' + encodeURIComponent(action) + '&t=' + Date.now());
      return handle(res);
    },
    post: async function (payload) {
      if (!configured()) throw new Error('尚未設定 API_URL（assets/config.js）');
      // text/plain 避免 CORS preflight（Apps Script 不支援 OPTIONS）
      var res = await fetch(cfg.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      return handle(res);
    }
  };

  window.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})();
