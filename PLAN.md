# Plan: Cloudflare Worker site for the X bot-collapse extension

## Goal
One Cloudflare Worker that does two jobs:
1. **Preview site** for friends: what the extension does, how to install it, download link.
2. **API proxy** (only if we use NVIDIA): the extension calls the Worker, the Worker calls
   NVIDIA with the key. The key never ships in the extension.

Not in v1: Supabase, GCP. The extension's 4 signals are read from the page and need no
backend. Add these only when a feature needs them.

## Structure
```
SF/
  extension/            # MV3 extension (manifest.json, content script, icons)
  site/
    public/             # static pages served by the Worker
      index.html        # landing + install steps
      bot-collapse.zip  # built extension (generated, not hand-edited)
    src/index.ts        # Worker: serves assets, handles /api/*
    wrangler.jsonc
    .dev.vars           # local secrets for wrangler dev (gitignored)
  .env / .env.example
  .gitignore
```

## Phase 1: Static preview site (no secrets)
- [ ] Scaffold with `npm create cloudflare@latest site`, Worker + static assets
      (`"assets": { "directory": "./public" }` in wrangler.jsonc)
- [ ] `index.html` sections:
  - What it does: collapses likely-bot posts behind a click, replies stay intact
  - What it doesn't do: misinformation detection, mobile
  - **Honesty note: thresholds are guesses, not tuned or validated.** Ask friends to
    report wrong collapses
  - Install: download zip → unzip → `chrome://extensions` → Developer mode →
    Load unpacked → pick the folder
- [ ] Script that zips **only** `extension/` into `public/bot-collapse.zip`
      (never zip the repo root: that would include `.env`)
- [ ] `npx wrangler deploy`, check the `*.workers.dev` URL loads and zip downloads

**Done when:** a friend can go from URL to working extension without asking you anything.

## Phase 2: NVIDIA proxy (only if the 4 signals miss the 80% precision target)
- [ ] `POST /api/classify` accepts post features (no raw user data beyond what's needed),
      calls `https://integrate.api.nvidia.com/v1/chat/completions` with `NVIDIA_API_KEY`
- [ ] Secrets: `npx wrangler secret put NVIDIA_API_KEY` for production,
      `.dev.vars` for local. Workers do not read `.env` in production
- [ ] CORS: allow only `chrome-extension://<your-extension-id>`
- [ ] Rate limit per IP (Workers Rate Limiting binding). The origin check is not auth;
      anyone can forge it, so rate limiting is what protects the bill
- [ ] Set a spend cap / usage alert in the NVIDIA dashboard
- [ ] Extension: call the Worker, cache verdict per account, fail open (show post)
      if the Worker is slow or down

**Done when:** `grep -r nvapi extension/` returns nothing and the extension still works
with the Worker offline.

## Security checklist
- [ ] `git check-ignore -v .env site/.dev.vars` shows both ignored
- [ ] Zip contents checked: `unzip -l public/bot-collapse.zip` has no `.env`, `.pem`, `eval/`
- [ ] No secret appears in `extension/` or `site/public/`

## Out of scope (from project spec)
Mobile, misinformation, tuned thresholds, paste-a-handle checking, non-technical users.
