# AI evaluation (writing and speaking)

The writing workspace, speaking practice, and writing questions inside practice
tests all have a **Check with AI** action backed by `/api/ai/evaluate`.

## Configuration

Set these on the server (`.env.local` locally, Vercel project settings in production):

```bash
# Any OpenAI-compatible chat-completions provider
OPENAI_API_KEY=sk-...          # or AI_API_KEY
AI_MODEL=gpt-4o-mini           # optional
AI_BASE_URL=https://api.openai.com/v1   # optional (OpenRouter, Groq, etc.)
```

The key is used only in the route handler; it is never sent to the browser.
Without a key, the route returns a clearly labelled **local estimate** so the UI
still works.

## What it returns

```json
{
  "overall": 7.0,
  "criteria": {
    "taskResponse": 7, "coherence": 7,
    "lexicalResource": 6.5, "grammaticalRange": 7
  },
  "summary": "…",
  "strengths": ["…"],
  "improvements": ["…"],
  "source": "ai"
}
```

Speaking uses `fluency`, `lexicalResource`, `grammaticalRange` and
`pronunciation`. Pronunciation is estimated from the transcript, and the UI says
so.

## Guardrails

- Minimum 30 words for writing, 15 for speaking.
- Temperature 0.2, JSON-only response, bands rounded to 0.5.
- Provider errors fall back to the local heuristic with the error noted in the
  summary.
- These are study estimates, not official IELTS results.

## Local heuristic

Without an AI key the estimator uses word count, paragraphing, sentence length,
linking devices and vocabulary variety. It is deliberately conservative and
labels itself "local estimate".
