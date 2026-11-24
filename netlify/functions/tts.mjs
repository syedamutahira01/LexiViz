export const handler = async (event) => {
  const q = event.queryStringParameters?.q;
  const tl = event.queryStringParameters?.tl || 'en';

  if (!q) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Missing required query parameter "q"',
    };
  }

  try {
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(q)}&tl=${encodeURIComponent(tl)}&client=tw-ob`;
    const resp = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'text/plain' },
        body: 'TTS upstream error: ' + resp.status,
      };
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err?.message ?? 'TTS proxy function failed',
    };
  }
};
