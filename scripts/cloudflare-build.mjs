import fs from 'node:fs';
import path from 'node:path';
import { downloadLegacyAssets } from './restore-legacy-assets.mjs';

// Flat HTML preserves the existing extensionless URLs without adding a slash.
const dist = path.resolve('dist');
const flattenPrerenderedRoutes = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'assets') flattenPrerenderedRoutes(path.join(directory, entry.name));
  }
  const index = path.join(directory, 'index.html');
  if (directory !== dist && fs.existsSync(index)) {
    fs.renameSync(index, `${directory}.html`);
    if (!fs.readdirSync(directory).length) fs.rmdirSync(directory);
  }
};
flattenPrerenderedRoutes(dist);
const legacy = JSON.parse(fs.readFileSync(new URL('./legacy-assets.json', import.meta.url), 'utf8'));
await downloadLegacyAssets(legacy, dist);


const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const preview = process.env.CLOUDFLARE_BUILD_PREVIEW === 'true';
const blocks = (config.headers ?? []).map(rule => {
  const pattern = rule.source.replace('(.*)', '*');
  if (/[()]/.test(pattern)) throw new Error('Unsupported Cloudflare header route');
  const headers = Object.fromEntries(rule.headers.map(header => [header.key, header.value]));
  if (preview && pattern === '/*') headers['X-Robots-Tag'] = 'noindex, nofollow';
  const lines = [pattern, ...Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`)];
  if (lines.some(line => line.length > 2000)) throw new Error('Cloudflare header exceeds supported length');
  return lines.join('\n');
});
blocks.push('/index.html\n  Cache-Control: no-cache');
fs.writeFileSync('dist/_headers', `${blocks.join('\n\n')}\n`);
console.log(`Cloudflare headers prepared from versioned configuration (${preview ? 'preview' : 'production'}).`);

fs.writeFileSync('dist/_redirects', 'https://www.antl.fr/* https://antl.fr/:splat 301\n');
