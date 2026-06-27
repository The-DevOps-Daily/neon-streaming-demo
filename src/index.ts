import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

app.get('/', (c) =>
  c.text(
    [
      'Neon Functions streaming demo.',
      '',
      'GET  /long-stream?seconds=90   server-sent events, one tick/second (proves the long-lived connection)',
      'POST /agent {"prompt":"..."}   streams an AI agent\'s tokens through the Neon AI Gateway',
    ].join('\n')
  )
);

// Holds an SSE connection open and emits a tick every second. The point is the
// duration: serverless platforms that cap function execution would cut this
// off; a Neon Function streams for as long as the work takes.
app.get('/long-stream', (c) => {
  const seconds = Math.min(600, Math.max(1, Number(c.req.query('seconds') ?? '90')));
  const start = Date.now();
  return streamSSE(c, async (stream) => {
    for (let i = 1; i <= seconds; i++) {
      await stream.writeSSE({
        event: 'tick',
        data: JSON.stringify({ tick: i, elapsed_ms: Date.now() - start }),
      });
      await stream.sleep(1000);
    }
    await stream.writeSSE({
      event: 'done',
      data: JSON.stringify({ ticks: seconds, total_ms: Date.now() - start }),
    });
  });
});

// Streams an AI agent's tokens. The model call runs through the Neon AI Gateway
// (one injected credential) and the function relays each token as it arrives, so
// the reader sees output immediately and the connection lasts the whole reply.
app.post('/agent', async (c) => {
  const { prompt } = await c.req.json<{ prompt?: string }>().catch(() => ({ prompt: undefined }));
  const base = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!base || !token) return c.text('AI Gateway not configured', 500);

  const upstream = await fetch(`${base}/ai-gateway/mlflow/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      stream: true,
      messages: [
        { role: 'user', content: prompt ?? 'Explain Neon database branching in three short sentences.' },
      ],
    }),
  });

  return streamSSE(c, async (stream) => {
    const reader = upstream.body?.getReader();
    if (!reader) {
      await stream.writeSSE({ event: 'error', data: '{"error":"no upstream body"}' });
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          await stream.writeSSE({ event: 'done', data: '{}' });
          return;
        }
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) await stream.writeSSE({ event: 'token', data: JSON.stringify({ delta }) });
        } catch {
          // ignore keep-alive / non-JSON lines
        }
      }
    }
    await stream.writeSSE({ event: 'done', data: '{}' });
  });
});

export default app;
