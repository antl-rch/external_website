import fs from 'node:fs';

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
