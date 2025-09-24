// main/services/cacheService.js
const fs = require('fs').promises;

const cache = new Map(); // filePath -> { wb, meta, ts, mtime }

async function getFileMtimeMs(filePath) {
  try {
    const s = await fs.stat(filePath);
    return s.mtimeMs;
  } catch (e) { return 0; }
}

async function get(filePath) {
  const entry = cache.get(filePath);
  if (!entry) return null;
  const now = Date.now();
  const ttl = entry.ttl || 2000;
  if (now - entry.ts > ttl) {
    // validate mtime
    const m = await getFileMtimeMs(filePath);
    if (m !== entry.mtime) {
      cache.delete(filePath);
      return null;
    } else {
      // repopulate ts
      entry.ts = now;
      cache.set(filePath, entry);
      return entry;
    }
  }
  return entry;
}

function set(filePath, { wb, meta }, ttlMs=2000) {
  cache.set(filePath, { wb, meta, ts: Date.now(), mtime: Date.now(), ttl: ttlMs });
}

function invalidate(filePath) {
  cache.delete(filePath);
}

module.exports = { get, set, invalidate };
