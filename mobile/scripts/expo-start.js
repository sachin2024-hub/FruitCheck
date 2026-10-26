#!/usr/bin/env node
// Development only: starts Expo behind a Cloudflare quick tunnel instead of `--tunnel` (ngrok).
// The phone downloads the JS bundle through the tunnel; ngrok was measured at ~50 KB/s here
// (30 s to 3 min per load), Cloudflare at a few seconds for the same bundle.
// API calls still go through the /fruitcheck-api proxy in metro.config.js, so the backend
// setup does not change.
'use strict';

const fs = require('fs');
const https = require('https');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXPO_CLI = path.join(PROJECT_ROOT, 'node_modules', 'expo', 'bin', 'cli');
const METRO_PORT = 8081;
const BIN_PATH = path.join(PROJECT_ROOT, '.cloudflared', 'cloudflared.exe');
const DOWNLOAD_URL =
  'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Too many redirects while downloading cloudflared'));
    https
      .get(url, { headers: { 'User-Agent': 'FruitCheck' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`cloudflared download failed (HTTP ${res.statusCode})`));
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const tmp = `${dest}.part`;
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on('finish', () => file.close(() => (fs.renameSync(tmp, dest), resolve(dest))));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function ensureCloudflared() {
  if (fs.existsSync(BIN_PATH) && fs.statSync(BIN_PATH).size > 1_000_000) return BIN_PATH;
  console.log('Downloading cloudflared (one time, ~55 MB)...');
  return download(DOWNLOAD_URL, BIN_PATH);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => (socket.destroy(), resolve(true)));
    socket.on('error', () => resolve(false));
  });
}

function killTree(proc) {
  if (!proc || !proc.pid) return;
  spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
}

function startTunnel(binPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binPath,
      ['tunnel', '--url', `http://127.0.0.1:${METRO_PORT}`, '--no-autoupdate', '--edge-ip-version', '4', '--protocol', 'http2'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let url = null;
    let connected = false;
    const timer = setTimeout(() => (killTree(child), reject(new Error('Cloudflare tunnel took too long.'))), 90000);

    const onData = (data) => {
      const text = data.toString();
      // api.trycloudflare.com appears in error messages; it is not a tunnel URL.
      const match = text.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
      url = url || (match && match[0]);
      connected = connected || /Registered tunnel connection|Connection registered/i.test(text);
      if (url && connected) {
        clearTimeout(timer);
        resolve({ url, child });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => (clearTimeout(timer), reject(err)));
    child.on('exit', (code) => (clearTimeout(timer), reject(new Error(`cloudflared exited (code ${code})`))));
  });
}

async function startTunnelWithRetries(binPath, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await startTunnel(binPath);
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`${err.message} Retrying (${i + 1}/${attempts})...`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
}

async function main() {
  if (await portInUse(METRO_PORT)) {
    console.log(`Port ${METRO_PORT} is already in use: another Expo is running.`);
    console.log('Close that Expo window (Ctrl+C) first, then run this again.');
    process.exit(1);
  }

  let tunnel = null;
  try {
    console.log('Opening Cloudflare tunnel...');
    tunnel = await startTunnelWithRetries(await ensureCloudflared());
    console.log('');
    console.log('==============================================');
    console.log(`Tunnel ready: ${tunnel.url}`);
    console.log('Scan the QR code below with Expo Go.');
    console.log('==============================================');
    console.log('');
  } catch (err) {
    console.log('');
    console.log(`Cloudflare tunnel failed: ${err.message || err}`);
    console.log('Expo will still start, but only phones on the same Wi-Fi can connect.');
    console.log('');
  }

  const expo = spawn(process.execPath, [EXPO_CLI, 'start', '--lan', '--port', String(METRO_PORT), ...process.argv.slice(2)], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(tunnel ? { EXPO_PACKAGER_PROXY_URL: tunnel.url } : {}) },
  });

  let stopping = false;
  const shutdown = (code) => {
    if (stopping) return;
    stopping = true;
    if (tunnel) killTree(tunnel.child);
    killTree(expo);
    process.exit(code);
  };
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  expo.on('exit', (code) => shutdown(code ?? 0));
  if (tunnel) {
    tunnel.child.on('exit', () => {
      if (stopping) return;
      tunnel = null;
      console.log('\nCloudflare tunnel closed. Expo still works on the same Wi-Fi; run this again for the tunnel.\n');
    });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
