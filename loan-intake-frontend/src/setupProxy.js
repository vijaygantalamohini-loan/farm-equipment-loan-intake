const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

module.exports = function(app) {
  const target = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const commonOptions = {
    target,
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq(proxyReq, req, res) {
      // ensure no unexpected headers break preflight
      // leave as-is
    },
    onError(err, req, res) {
      console.error('[proxy:error]', req.method, req.url, String(err && err.message || err));
      try {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Dev proxy error', error: String(err && err.message || err) }));
      } catch (_) {}
    },
    onProxyRes(proxyRes, req, res) {
      const status = proxyRes && proxyRes.statusCode;
      if (status >= 500) {
        console.error('[proxy:server-5xx]', req.method, req.url, 'status', status);
      }
    },
  };

  // IMPORTANT: Let CRA dev server serve index.html for SPA routes.
  // Do NOT send raw public/index.html here, or %PUBLIC_URL% placeholders remain unresolved.

  // Bypass auth callback when token/user are present so frontend handles it
  const authProxy = createProxyMiddleware({
    ...commonOptions,
    bypass: function(req, res, proxyOptions) {
      const url = req.url || "";
      const accept = req.headers && req.headers.accept ? String(req.headers.accept) : "";

      // If this is the SPA callback with token/user, do NOT proxy.
      if ((url.includes('/auth/callback') && (url.includes('token=') || url.includes('user='))) ||
          url.startsWith('/auth/callback-spa')) {
        // Serve index via CRA dev server (not raw file), so React boots and parses query
        console.log('[proxy:bypass] Serving SPA index for', url);
        return '/index.html';
      }

      // IMPORTANT: Proxy /auth/callback with code/state to backend for token exchange.
      // Do not intercept generic /auth HTML requests; let backend handle auth routes.

      // Otherwise, proxy to backend (login, verify, profile, etc.)
      console.log('[proxy:forward] Forwarding to API', url);
      return false;
    }
  });

  app.use(['/ocr', '/lookup', '/address', '/loans'], createProxyMiddleware(commonOptions));

  // Whitelist specific auth API endpoints to proxy
  app.use(['/auth/login', '/auth/verify', '/auth/profile', '/auth/debug', '/auth/debug/*', '/auth/callback'], authProxy);
};
