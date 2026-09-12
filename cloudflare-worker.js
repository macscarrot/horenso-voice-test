export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, cors);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY is not configured' }, 500, cors);
    }

    try {
      const body = await request.json();
      const base64 = String(body.audioBase64 || '');
      const mimeType = String(body.mimeType || 'audio/webm');
      if (!base64) return json({ error: 'audioBase64 is required' }, 400, cors);

      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      if (bytes.byteLength > 20 * 1024 * 1024) {
        return json({ error: 'audio is too large' }, 413, cors);
      }

      const form = new FormData();
      form.append('model', 'gpt-transcribe');
      form.append('language', 'ja');
      form.append('file', new File([bytes], filenameFor(mimeType), { type: mimeType }));

      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form
      });

      const text = await r.text();
      if (!r.ok) {
        return json({ error: 'OpenAI transcription failed', detail: text.slice(0, 1000) }, 502, cors);
      }

      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { text }; }
      return json({ text: parsed.text || '', model: 'gpt-transcribe' }, 200, cors);
    } catch (e) {
      return json({ error: 'worker_error', detail: String(e && e.message || e) }, 500, cors);
    }
  }
};

function filenameFor(mimeType) {
  if (mimeType.includes('mp4')) return 'voice.m4a';
  if (mimeType.includes('ogg')) return 'voice.ogg';
  if (mimeType.includes('wav')) return 'voice.wav';
  return 'voice.webm';
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
