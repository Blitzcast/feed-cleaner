# Feed Cleaner

A Chrome extension that collapses likely-bot posts on X, plus a Cloudflare Worker
that serves the preview/install site.

```
extension/   MV3 extension (not written yet)
site/        Cloudflare Worker: static site in public/, API routes in src/index.ts
```

## Deploy the site

Needs Node 22+ and a Cloudflare API token with **Workers Scripts: Edit** and
**Account Settings: Read**.

```bash
cd site
npm install
export CLOUDFLARE_API_TOKEN=...   # never commit this
export CLOUDFLARE_ACCOUNT_ID=...
npm run deploy                    # zips ../extension, then wrangler deploy
```

`npm run dev` runs it locally at http://localhost:8787.

`npm run zip` builds `site/public/bot-collapse.zip` from `extension/` only (dotfiles,
`.pem` and `.key` files are skipped). Until `extension/manifest.json` exists it skips
the zip and the download link returns 404.

## Before sharing

```bash
git check-ignore -v .env site/.dev.vars    # both must be ignored
unzip -l site/public/bot-collapse.zip      # no .env, .pem, eval/
```
