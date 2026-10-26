// Netlify Serverless Function: High-speed proxy for Google Apps Script & Google Drive
// Eliminates browser CORS issues and follows 302 redirects seamlessly on Netlify

export default async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch (e) {
        body = {};
      }
    }

    const url = new URL(req.url);
    const gasUrl = body.gasUrl || url.searchParams.get('gasUrl');
    const method = (body.method || req.method || 'POST').toUpperCase();
    const payload = body.payload;
    const params = body.params;

    if (!gasUrl || typeof gasUrl !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing gasUrl parameter' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    let targetUrl = gasUrl.trim();
    if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + q;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    let resp: Response;
    if (method === 'GET') {
      resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
    } else {
      resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        redirect: 'follow',
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);

    const contentType = resp.headers.get('content-type') || '';
    let responseBody = '';
    if (contentType.includes('application/json')) {
      const json = await resp.json();
      responseBody = JSON.stringify(json);
    } else {
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        responseBody = JSON.stringify(json);
      } catch {
        responseBody = JSON.stringify({ status: 'SUCCESS', raw: text });
      }
    }

    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Proxy Error' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
