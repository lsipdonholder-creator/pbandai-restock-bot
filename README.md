# P-Bandai One Piece Card Game drop bot

Checks Premium Bandai every 15 minutes for **One Piece Card Game** products and
sends a Telegram message when one becomes orderable (new pre-order, restock,
or an open "chance to buy" drawing). Notify only: it never logs in or buys.

Adapted from [chunkeat00/pbandai-restock-bot](https://github.com/chunkeat00/pbandai-restock-bot)
(no license file upstream, so keep this for personal use).

How it works: a Cloudflare Worker triggers a GitHub Actions run every 15 min.
`check.py` reads the listing page's embedded `PRELOAD_DATA` JSON (no browser,
standard library only), pages to the end, checks it got exactly `totalCount`
items, diffs against `state/seen.json`, and messages you. ~5 s per run.

---

## Setup checklist

### 1. Telegram
1. Message **@BotFather** → `/newbot` → copy the token (`TELEGRAM_BOT_TOKEN`).
2. Message **@userinfobot** → copy your `Id` (`TELEGRAM_CHAT_ID`).
3. Open your new bot and press **Start**, or it can't message you.

### 2. GitHub repo (must be **public**: unlimited free Actions)
1. Create an empty public repo, e.g. `pbandai-restock-bot`, and push this folder:
   ```
   git remote add origin https://github.com/<you>/pbandai-restock-bot.git
   git push -u origin main
   ```
2. **Settings → Secrets and variables → Actions → Secrets**:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, optionally `HEALTHCHECK_URL` (step 4).
3. Same page, **Variables** tab → `WATCH_URLS`, one URL per line, for the
   regions you can actually buy from:

   | Region | URL |
   |---|---|
   | Singapore | `https://p-bandai.com/sg/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |
   | USA | `https://p-bandai.com/us/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |
   | Hong Kong | `https://p-bandai.com/hk/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |
   | Taiwan | `https://p-bandai.com/tw/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |
   | Australia | `https://p-bandai.com/au/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |
   | New Zealand | `https://p-bandai.com/nz/category/card-games?_f_series=03-002&offset=0&limit=20&sortType=NewArrival` |

   (`04-011` = Card Games category, `03-002` = One Piece series. Don't add
   `_f_productStatuses`; the site ignores it when nothing matches.)
4. **Settings → Actions → General → Workflow permissions → Read and write**.
5. **Actions** tab → *P-Bandai restock check* → **Run workflow**. First run
   records a baseline and sends "bot started". Tick **dry_run** to test without
   messaging or committing.

### 3. Cloudflare Worker (the clock)
1. Make a **fine-grained** GitHub token: Settings → Developer settings →
   Fine-grained tokens. Repository access: only this repo. Permission:
   **Actions: Read and write**. **Put its expiry date in your calendar.**
2. Cloudflare → Workers & Pages → Create Worker → paste
   [`cloudflare/worker.js`](cloudflare/worker.js) → Deploy.
3. Worker **Settings → Variables and Secrets**:
   - `GITHUB_REPO` (Text): `<you>/pbandai-restock-bot`
   - `GITHUB_PAT` (Secret): the token
   - optional `TELEGRAM_BOT_TOKEN` (Secret) + `TELEGRAM_CHAT_ID` (Text): pings
     you hourly if triggering fails, e.g. expired token
4. **Settings → Trigger events → Cron**: `*/15 * * * *`, then **Deploy again**.
   The first fire can take up to an hour.

### 4. Dead man's switch (recommended)
healthchecks.io (free) → Add Check, period 15 min, grace 30 min → copy the
ping URL into the GitHub secret `HEALTHCHECK_URL`. Treat it like a password.
It alerts you when runs stop happening at all, which nothing else can catch.

---

## What counts as "orderable"

Any product whose badges don't contain one of these whole words:
`OUT OF STOCK, SOLD OUT, CLOSED, NO LONGER AVAILABLE, END OF SALE, SALE ENDED,
ENDED, SUSPENDED, CANCELLED, CANCELED, NOT AVAILABLE`, and whose `saleStatus`
isn't `End`. Unknown badges count as orderable, so new badge wording still alerts.
Edit `UNAVAILABLE_MARKERS` in `check.py` to change it.

## Run locally

```
DRY_RUN=1 WATCH_URLS='<url>' python check.py
```

Optional env vars: `ALERT_ON_ALL=1` (alert on sold-out too), `MAX_PAGES`
(default 50), `REQUEST_DELAY` (default 0.5 s), `STATE_FILE`.

## Limits

Polling every 15 min will not win sell-in-seconds drops. It's built for
pre-order windows and lottery entries, which stay open for hours or days.
