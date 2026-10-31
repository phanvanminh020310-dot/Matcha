#!/usr/bin/env node
// Static server cho bản build production (SPA fallback) — dùng cho preview/deploy.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 4173)
const HOST = process.env.HOST ?? '0.0.0.0'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.endsWith('/')) pathname += 'index.html'
    const filePath = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
    let body
    try {
      const info = await stat(filePath)
      body = info.isDirectory() ? await readFile(join(filePath, 'index.html')) : await readFile(filePath)
    } catch {
      body = await readFile(join(ROOT, 'index.html'))
      pathname = '/index.html'
    }
    const ext = pathname === '/index.html' ? '.html' : extname(pathname)
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'frame-ancestors *',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Lỗi máy chủ: ' + String(err))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Matcha POS đang chạy tại http://${HOST}:${PORT}`)
})
