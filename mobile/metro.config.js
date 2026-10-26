// Development only: forwards /fruitcheck-api/* from the Expo dev server to the local
// FastAPI backend. The phone already reaches Metro (it loads the app from it), so API
// calls work without opening another firewall port or tunnel.
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const BACKEND = new URL(process.env.FRUITCHECK_BACKEND_URL || 'http://127.0.0.1:8000');
const PREFIX = '/fruitcheck-api';

function proxy(req, res) {
  const started = Date.now();
  const path = req.url.slice(PREFIX.length) || '/';
  res.on('finish', () =>
    console.log(`[fruitcheck-api] ${req.method} ${path} -> ${res.statusCode} (${Date.now() - started} ms)`),
  );
  const upstream = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port,
      path,
      method: req.method,
      headers: { ...req.headers, host: BACKEND.host },
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    console.warn(`[fruitcheck-api] backend ${BACKEND.origin} unreachable: ${err.code || err.message}`);
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        detail: 'The FruitCheck backend is not running on the computer. Start it on port 8000.',
      }),
    );
  });
  req.pipe(upstream);
}

const previous = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => (req.url && req.url.startsWith(PREFIX) ? proxy(req, res) : base(req, res, next));
  },
};

module.exports = config;
