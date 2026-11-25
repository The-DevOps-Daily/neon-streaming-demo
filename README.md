<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://neon.com/brand/neon-logo-dark-color.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://neon.com/brand/neon-logo-light-color.svg">
  <img width="250px" alt="Neon Logo fallback" src="https://neon.com/brand/neon-logo-dark-color.svg">
</picture>

# Neon Functions Streaming Demo

> Companion code for [Streaming an AI Agent Without a Function Timeout](https://devops-daily.com/posts/neon-functions-streaming-without-timeout) on DevOps Daily. Two endpoints that show a Neon Function holding a long-lived streaming connection: one ticks for as long as you ask, the other streams an AI agent's tokens through the Neon AI Gateway.

A [Hono](https://hono.dev) function deployed on [Neon Functions](https://neon.com), with no database tables — just streaming.

## Endpoints

| Route | What it does |
| --- | --- |
| `GET /long-stream?seconds=90` | Server-sent events, one tick per second, for up to 600s. Proves the function holds the connection open well past short serverless caps. |
| `POST /agent` | Streams an AI agent's tokens through the Neon AI Gateway (`gpt-6-luna`) as they are generated. Body: `{"prompt":"..."}`. |

## Run it

```bash
npm install
neonctl link --project-name streaming --region-id aws-us-east-2   # add --agent to skip prompts
neonctl deploy
```

`neon link` pulls branch-scoped env into `.env.local`, including the AI Gateway credentials (because `neon.ts` sets `aiGateway: true`). `neon deploy` provisions the function and prints its URL.

## Try it

```bash
# Hold a stream open for 90 seconds, one tick/second
curl -N "https://<your-branch>-stream.compute.<region>.aws.neon.tech/long-stream?seconds=90"

# Stream an agent's tokens
curl -N -X POST "https://<your-branch>-stream.compute.<region>.aws.neon.tech/agent" \
  -H 'content-type: application/json' \
  -d '{"prompt":"In 3 short sentences, what is Neon database branching?"}'
```

The whole backend is declared in `neon.ts`, and the streaming logic is in `src/index.ts` (about 80 lines).

## Model retirement (updated 25 November 2026)

OpenAI ends API access to GPT-5, GPT-5 mini, GPT-5 nano, GPT-5 pro, o3 and o3-pro on 11 December 2026. `POST /agent` used `gpt-5-nano`; it now uses `gpt-6-luna`. The timings in the companion post were measured with `gpt-5-nano`. The skill files under `.agents/` come from [neondatabase/agent-skills](https://github.com/neondatabase/agent-skills) (pinned in `skills-lock.json`) and may still name older models.
