import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const maximum = 128 * 1024 * 1024;

// Only public static resources are accepted. HTML, routing rules, environment
// files and executable Pages workers can never enter an artifact through here.
export function restoreLegacyAssets(archive, specification, directory, { preserveServiceWorker = false } = {}) {
  if (archive.length > maximum || digest(archive) !== specification.sha256) throw new Error('Legacy archive checksum mismatch');
  const snapshot = JSON.parse(gunzipSync(archive, { maxOutputLength: 192 * 1024 * 1024 }));
  if (snapshot.schema !== 1 || snapshot.repo !== specification.repository || snapshot.origin !== specification.origin
    || !snapshot.files || Array.isArray(snapshot.files)) throw new Error('Legacy archive identity mismatch');
  const entries = Object.entries(snapshot.files);
  if (!entries.length || entries.length > 1000) throw new Error('Unexpected legacy asset count');
  const root = fs.realpathSync(directory);
  const pending = [];
  let total = 0;
  for (const [name, record] of entries) {
    if (!/^(?:assets\/[a-zA-Z0-9_./@-]+\.(?:m?js|css|wasm|png|jpe?g|svg|webp|avif|gif|woff2?|ttf|ico|mp3|wav|ogg|mp4|webm)|(?:workbox|registerSW)[a-zA-Z0-9._-]*\.js|sw\.js)$/.test(name)
      || name.split('/').some(part => !part || part === '.' || part === '..')
      || !record || typeof record.data !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Unsafe legacy asset');
    const data = Buffer.from(record.data, 'base64');
    total += data.length;
    if (data.length > 25 * 1024 * 1024 || total > maximum || digest(data) !== record.sha256) throw new Error('Invalid legacy asset contents');
    const destination = path.join(root, name);
    let parent = root;
    for (const part of name.split('/')) {
      parent = path.join(parent, part);
      if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('Legacy asset symlink refused');
    }
    if (name === 'sw.js' && !preserveServiceWorker) continue;
    if (fs.existsSync(destination) && name !== 'sw.js') {
      if (digest(fs.readFileSync(destination)) !== record.sha256 && /-[a-zA-Z0-9_-]{8,}\./.test(name)) throw new Error('Conflicting hashed legacy asset');
      continue;
    }
    pending.push({ destination, data });
  }
  // Validate the entire archive before changing any built file.
  for (const entry of pending) {
    fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
    fs.writeFileSync(entry.destination, entry.data);
  }
  return { restored: pending.length, archiveSha256: specification.sha256, preservedServiceWorker: preserveServiceWorker && Boolean(snapshot.files['sw.js']) };
}

export async function downloadLegacyAssets(specification, directory, options) {
  const url = new URL(specification.url);
  const prefix = `https://github.com/${specification.repository}/releases/download/`;
  if (!url.href.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(specification.sha256)) throw new Error('Unexpected legacy archive source');
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > maximum) throw new Error('Legacy archive unavailable');
  return restoreLegacyAssets(Buffer.from(await response.arrayBuffer()), specification, directory, options);
}
