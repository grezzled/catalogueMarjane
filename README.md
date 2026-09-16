# Catalogue Marjane - AI SEO Content Platform

A Next.js application for ingesting Marjane promotional catalogues (PDF), analyzing them with AI, extracting products/offers, and generating SEO-optimized articles.

## Features

- **PDF Catalogue Upload** - Upload Marjane catalogue PDFs via admin interface
- **AI Page Analysis** - Multimodal AI analyzes every catalogue page individually
- **Product Extraction** - Automatic extraction of products, prices, discounts
- **Category Detection** - Automatic classification of products by category
- **Current vs Archive** - Promotions split into `En cours` (`startDate <= now AND endDate >= now`) and `Archive` (`endDate < now`, `?statut=archive`, noindex)
- **SEO Article Generation** - AI generates high-quality French SEO articles
- **Content Quality Scoring** - AI validates article quality before publishing
- **Internal Linking** - Automatic internal linking between articles and catalogues
- **JSON-LD Structured Data** - Schema.org markup for rich search results
- **File-based Sitemap** - `public/sitemap.xml` regenerated from SQLite with no rebuild and no running server required
- **Admin Dashboard** - Full admin interface for managing catalogues and articles
- **Background Worker** - Job queue for processing large catalogues

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- **SQLite + Prisma ORM** (single file, no Postgres server)
- pm2 for production processes (no Docker required)
- AI Providers: Gemini (default), Ollama (local), OpenAI-compatible

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env (DATABASE_URL="file:./prisma/dev.db" works locally)
npx prisma db push
npm run dev     # http://localhost:3006
npm run worker  # second terminal: background jobs
```

---

## Server Deploy (Ubuntu + pm2 + SQLite)

### 1. Prerequisites (on the server)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx sqlite3

# pm2 + certbot
sudo npm i -g pm2
sudo apt install -y certbot python3-certbot-nginx

# Optional: faster PDF page rendering
sudo apt install -y poppler-utils   # provides pdftoppm
```

### 2. Get the code on the server

```bash
sudo mkdir -p /var/www/marjanecatalogue
sudo chown $USER:$USER /var/www/marjanecatalogue
cd /var/www/marjanecatalogue
git clone <your-repo-url> .
```

### 3. Environment variables

```bash
cp .env.example .env
nano .env
```

Required values (production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/var/www/marjanecatalogue/prisma/prod.db` (absolute path!) |
| `NEXT_PUBLIC_APP_URL` | `https://cataloguemarjane.com` |
| `ADMIN_PASSWORD` | strong password for `/admin` |
| `ADMIN_SECRET` | `openssl rand -hex 32` (min 32 chars) |
| `GEMINI_API_KEY` | your key (or Ollama/OpenAI vars instead) |
| `AI_PROVIDER` / `AI_MODEL` | `gemini` / `gemini-2.0-flash` (defaults are fine) |

> Use an **absolute** `file:` path for SQLite in production. A relative
> `file:./dev.db` resolves against the Prisma schema directory and breaks
> under pm2. Local dev can keep the relative path.

### 4. First deploy

```bash
npm ci            # must include dev deps: worker/sitemap run on tsx
npx prisma generate
npx prisma db push
npm run build
npm run sitemap   # writes public/sitemap.xml once
pm2 start ecosystem.config.js
pm2 save
pm2 startup       # run the command it prints (sudo ...)
```

pm2 starts 3 processes (see `ecosystem.config.js`):

| Process | Command | Role |
|---|---|---|
| `marjane-app` | `npm start` | Next.js on port **3006** |
| `marjane-worker` | `npm run worker` | AI jobs, article expiry, sitemap refresh on boot + hourly |
| `marjane-sitemap` | `npm run sitemap` | Safety net, cron `7 * * * *`, rewrites sitemap hourly even if the worker is down |

Check: `pm2 status` → all `online`. `pm2 logs marjane-worker` → `Sitemap refreshed (N URLs)`.

### 5. nginx reverse proxy + HTTPS

```nginx
# /etc/nginx/sites-available/cataloguemarjane
server {
  listen 80;
  server_name cataloguemarjane.com www.cataloguemarjane.com;

  location / {
    proxy_pass http://127.0.0.1:3006;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  client_max_body_size 60M;  # PDF uploads (see MAX_UPLOAD_SIZE_MB)
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cataloguemarjane /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cataloguemarjane.com -d www.cataloguemarjane.com
```

### 6. Sitemap — how it stays fresh (no rebuild needed)

`public/sitemap.xml` is a plain file served directly by Next.js. It updates via:

1. **Deploy**: `npm run sitemap` (manual, also scriptable in cron).
2. **Worker**: rewrites it on boot and every hour alongside article expiry.
3. **On publish**: every admin publish/edit triggers a best-effort rewrite.
4. **pm2 cron**: `marjane-sitemap` runs the script hourly regardless.

Verify: `curl -s https://cataloguemarjane.com/sitemap.xml | head -5`
Expired catalogues are included but demoted (`priority 0.3`, `yearly`); archive offer pages (`?statut=archive`) are `noindex` and never enter the sitemap.

### 7. Current vs historical offers

- **En cours (default)**: `startDate <= now AND endDate >= now` on `/`, `/promotions-marjane`, `/category/[category]`.
- **Archive**: append `?statut=archive` (e.g. `/promotions-marjane?statut=archive`) → `endDate < now`, `Expiré · prix indicatif` badges, amber "prix indicatifs, non disponibles" banner, `noindex,follow`.
- **Catalogue archives**: `/catalogue-marjane` groups `en cours / prochains / Archive`.

### 8. Updating the server (code deploys)

```bash
cd /var/www/marjanecatalogue
git pull
npm ci
npm run build
pm2 reload all
```

No sitemap or database action needed — the file and DB persist (`next build` never touches `public/sitemap.xml` or the SQLite file).

### 9. Backup (do this on a cron)

SQLite is one file — back it up together with uploads:

```bash
# Example daily cron: sqlite backup + uploads snapshot
sqlite3 /var/www/marjanecatalogue/prisma/prod.db ".backup '/root/backups/prod-$(date +%F).db'"
tar -czf /root/backups/uploads-$(date +%F).tar.gz -C /var/www/marjanecatalogue/public uploads
```

Restore = copy the `.db` file back and `pm2 reload all`.

### 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: Cannot find module 'tsx'` (worker/sitemap) | Reinstall with dev deps: `npm ci` (not `npm ci --omit=dev`) |
| Prisma `Can't reach database` / wrong path | `DATABASE_URL` must be absolute `file:/...` in production; `echo $DATABASE_URL` under pm2 via `pm2 env 0` |
| `ADMIN_SECRET must be at least 32 chars` | `openssl rand -hex 32` into `.env`, then `pm2 reload all` |
| Port 3006 in use | `pm2 delete all` then `pm2 start ecosystem.config.js`; check `ss -tlnp \| grep 3006` |
| Stale sitemap | `npm run sitemap`, then check `pm2 logs marjane-worker marjane-sitemap` |
| `pdftoppm not found` | `sudo apt install poppler-utils` |
| View logs | `pm2 logs`, `pm2 logs marjane-app --lines 100` |
| Uploads 413 error | Raise `client_max_body_size` in nginx + `MAX_UPLOAD_SIZE_MB` in `.env` |

## Configuration

### AI Providers

**Gemini (default, lowest cost):**
```env
AI_PROVIDER=gemini
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_key_here
```

**Ollama (local, free):**
```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llava:latest
```

**OpenAI-compatible:**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

## Useful Commands

```bash
npm run dev        # dev server :3006
npm run worker     # background AI worker
npm run sitemap    # regenerate public/sitemap.xml (no server needed)
npm run build      # production build
npm start          # production server :3006
npx prisma studio  # inspect SQLite in browser
pm2 status|logs    # process supervision
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes
│   ├── catalogue-marjane/  # Public catalogue pages
│   ├── promotions-marjane/ # Promotions pages (en cours + ?statut=archive)
│   └── articles/           # SEO articles
├── ai/                     # AI provider abstraction
│   └── providers/          # Gemini, Ollama, OpenAI
├── services/               # Business logic
│   ├── pdf.ts              # PDF processing
│   ├── processing.ts       # AI analysis pipeline
│   ├── articles.ts         # Article generation
│   ├── categories.ts       # Product normalization
│   ├── sitemap-file.ts     # File-based sitemap builder
│   └── jobs.ts             # Job queue
├── lib/                    # Utilities
└── types/                  # TypeScript types
scripts/
├── generate-sitemap.ts     # npm run sitemap (standalone, cron-safe)
└── migrate-to-webp.ts      # image migration
ecosystem.config.js          # pm2: app + worker + sitemap cron
```

## Workflow

1. Upload PDF via `/admin/catalogues`
2. Extract PDF text and render pages
3. AI analyzes each page individually
4. Products and offers are extracted and normalized
5. Categories are detected automatically
6. SEO articles are generated from catalogue data
7. Articles go through quality scoring
8. Admin reviews and publishes articles (sitemap refreshes automatically)
9. Expired articles/catalogues move to Archive; worker unpublishes them hourly

## SEO Strategy

- Target Moroccan search terms: "catalogue Marjane", "promotions Marjane", etc.
- French primary language with natural Moroccan phrasing
- Fresh content updated with each new catalogue
- Internal linking between catalogues, categories, and articles
- JSON-LD structured data for rich snippets
- Current offers indexed; archive pages noindex/demoted, no thin or duplicate content
- Anti-hallucination system ensures factual accuracy

## License

MIT
