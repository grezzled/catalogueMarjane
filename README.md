# Catalogue Marjane - AI SEO Content Platform

A Next.js application for ingesting Marjane promotional catalogues (PDF), analyzing them with AI, extracting products/offers, and generating SEO-optimized articles.

## Features

- **PDF Catalogue Upload** - Upload Marjane catalogue PDFs via admin interface
- **AI Page Analysis** - Multimodal AI analyzes every catalogue page individually
- **Product Extraction** - Automatic extraction of products, prices, discounts
- **Category Detection** - Automatic classification of products by category
- **SEO Article Generation** - AI generates high-quality French SEO articles
- **Content Quality Scoring** - AI validates article quality before publishing
- **Internal Linking** - Automatic internal linking between articles and catalogues
- **JSON-LD Structured Data** - Schema.org markup for rich search results
- **Sitemap Generation** - Dynamic XML sitemap
- **Admin Dashboard** - Full admin interface for managing catalogues and articles
- **Background Worker** - Job queue for processing large catalogues

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL + Prisma ORM
- AI Providers: Gemini (default), Ollama (local), OpenAI-compatible

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- (Optional) `pdftoppm` for rendering PDF pages to images

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and AI provider keys

# Run database migrations
npx prisma db push

# Seed default categories (optional)
npx prisma db seed

# Start development server
npm run dev

# In another terminal, start the background worker
npm run worker
```

### Docker Compose

```bash
# Start everything with Docker
docker-compose up -d

# Run migrations
docker-compose exec app npx prisma db push
```

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

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes
│   ├── catalogue-marjane/  # Public catalogue pages
│   ├── promotions-marjane/ # Promotions pages
│   └── articles/           # SEO articles
├── ai/                     # AI provider abstraction
│   └── providers/          # Gemini, Ollama, OpenAI
├── services/               # Business logic
│   ├── pdf.ts              # PDF processing
│   ├── processing.ts       # AI analysis pipeline
│   ├── articles.ts         # Article generation
│   ├── categories.ts       # Product normalization
│   └── jobs.ts             # Job queue
├── lib/                    # Utilities
└── types/                  # TypeScript types
```

## Workflow

1. Upload PDF via `/admin/catalogues`
2. Extract PDF text and render pages
3. AI analyzes each page individually
4. Products and offers are extracted and normalized
5. Categories are detected automatically
6. SEO articles are generated from catalogue data
7. Articles go through quality scoring
8. Admin reviews and publishes articles
9. Sitemap and metadata are auto-generated

## SEO Strategy

- Target Moroccan search terms: "catalogue Marjane", "promotions Marjane", etc.
- French primary language with natural Moroccan phrasing
- Fresh content updated with each new catalogue
- Internal linking between catalogues, categories, and articles
- JSON-LD structured data for rich snippets
- No thin or duplicate content
- Anti-hallucination system ensures factual accuracy

## License

MIT
