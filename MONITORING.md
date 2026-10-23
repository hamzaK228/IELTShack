# Monitoring

The app exposes a public liveness endpoint:

```bash
curl -fsS https://ieltshack.vercel.app/api/health
# {"ok":true,"service":"ieltshack","time":"..."}
```

It returns no secrets or user data, and `Cache-Control: no-store`.

## Recommended uptime check

Use any external monitor (UptimeRobot, Better Stack, Pingdom) against:

- `https://ieltshack.vercel.app/api/health` — expect `200` and `"ok":true`
- `https://ieltshack.vercel.app/dashboard` — expect `307` to `/auth`
- `https://ieltshack.vercel.app/api/questions?limit=1` — expect `401`

## GitHub Actions alternative

The repository token used by the local agent did not have the `workflow` scope,
so this file is provided for manual addition at
`.github/workflows/production-health.yml`:

```yaml
name: Production health
on:
  schedule:
    - cron: "*/15 * * * *"
  workflow_dispatch:
jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - name: Health endpoint
        run: |
          body=$(curl -fsS --max-time 20 https://ieltshack.vercel.app/api/health)
          echo "$body"
          echo "$body" | grep -q '"ok":true'
      - name: Auth gate
        run: |
          code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://ieltshack.vercel.app/dashboard)
          test "$code" = "307"
      - name: API gate
        run: |
          code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 'https://ieltshack.vercel.app/api/questions?limit=1')
          test "$code" = "401"
```

GitHub emails the repository owner when a scheduled workflow fails. For
immediate alerts, an external monitor is more reliable than GitHub cron.
