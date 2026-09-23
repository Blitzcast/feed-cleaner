# Handoff: feed-cleaner Phase 1 (preview site)

Paste this into a local Claude Code session started in `SF/`.

## Context
- Building Phase 1 of PLAN.md: a Cloudflare Worker that serves a preview/install site for the
  X bot-collapse Chrome extension. The name is **feed-cleaner** (Worker name and site title).
- `SF/` already has its own `.gitignore` and `.env`. **Do not overwrite either. Do not read `.env`.**
- There's no extension code yet. `extension/` doesn't exist.

## What's in this zip (built and partly tested in a cloud session)
```
site/
  wrangler.jsonc            Worker "feed-cleaner", serves ./public, falls through to src/index.ts
  src/index.ts              returns 404 JSON for /api/* (Phase 2 goes here), else serves assets
  public/index.html         landing: what it does / doesn't, honesty note, install steps
  public/style.css, 404.html
  scripts/zip-extension.mjs zips ../extension -> public/bot-collapse.zip, no dependencies
  package.json, tsconfig.json
README.md                   deploy steps (merge into SF's README if one exists)
.env.example                variable names only, no values
```

## Tested vs. not tested
- Tested: the zip script (skips dotfiles/.pem/.key; the zip passes an integrity check; skips cleanly
  when extension/manifest.json is missing).
- **Not tested** (npm was blocked in the cloud): `npm install`, `wrangler dev`, `wrangler deploy`,
  `tsc`. Run these first.

## Steps for the local session
1. Unzip into `SF/` so `SF/site/` exists. Keep SF's own `.gitignore`. Only add `README.md` /
   `.env.example` if SF doesn't have them; otherwise merge.
2. Add any of these lines missing from `SF/.gitignore`:
   ```
   .env
   .env.*
   !.env.example
   .dev.vars
   *.pem
   node_modules/
   .wrangler/
   site/public/bot-collapse.zip
   ```
3. Verify: `git check-ignore -v .env site/.dev.vars` lists both.
4. `cd site && npm install && npm run typecheck && npm run dev`, then open http://localhost:8787.
5. Deploy: the Cloudflare token is account-owned, with Workers Scripts: Edit and
   Account Settings: Read. Wrangler needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the
   shell env. Then `npm run deploy`. Check that the `*.workers.dev` URL loads (the zip will 404 until
   the extension exists).
6. Update `index.html` "What it does" with the real 4 signals once they're decided.

## Next after Phase 1
Build `extension/` (MV3 manifest + content script). Then `npm run zip` and check it with
`unzip -l site/public/bot-collapse.zip`.
