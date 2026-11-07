const pilotHost = 'migration-pilote.antl.fr';
const publicHost = 'antl.fr';
const fallbackOrigin = 'https://antl-external-website.vercel.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pilot = url.hostname === pilotHost;
    if (!pilot && url.hostname !== publicHost) return new Response(null, { status: 404 });

    // Only replay static reads. In particular, never replay a form submission.
    if (request.method !== 'GET' && request.method !== 'HEAD') return fetch(request);

    let primary;
    try {
      primary = await fetch(request, { signal: AbortSignal.timeout(3500) });
    } catch {
      // The previous origin can serve these routes while Pages initializes.
    }
    if (primary && primary.status < 500) return pilotResponse(primary, pilot, 'primary');

    const fallbackUrl = new URL(fallbackOrigin);
    fallbackUrl.pathname = url.pathname;
    fallbackUrl.search = url.search;
    const headers = new Headers();
    for (const name of ['accept', 'range']) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const fallback = await fetch(fallbackUrl, {
      method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(7000),
    });
    if (primary?.body) await primary.body.cancel().catch(() => {});
    const response = new Response(fallback.body, fallback);
    response.headers.set('cache-control', 'no-store');
    const location = response.headers.get('location');
    if (location && new URL(location, fallbackUrl).origin === fallbackOrigin) {
      const redirect = new URL(location, fallbackUrl);
      redirect.hostname = url.hostname;
      response.headers.set('location', redirect.href);
    }
    return pilotResponse(response, pilot, 'fallback');
  },
};

function pilotResponse(response, pilot, source) {
  if (!pilot) return response;
  const result = new Response(response.body, response);
  result.headers.set('x-robots-tag', 'noindex, nofollow');
  result.headers.set('x-antl-relay', source);
  return result;
}
