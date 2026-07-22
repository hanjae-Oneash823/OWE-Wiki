# OWE-Wiki

A stable, ever-growing knowledge archive for personal and team-level use — covering coding, bioinformatics, biology, and ML/DL/AI.

🔗 **Live site:** [owe-wiki.vercel.app](https://owe-wiki.vercel.app)

## Concept

Most wikis stall because the bar for "finished" is too high. OWE-Wiki reframes notes around a **growth-stage metaphor** instead of a traditional finished-article model:

- 🧬 **Seedling** — a raw idea, just planted
- 🌱 **Sprout** — has structure, still growing
- 🌳 **Established** — mature, well-linked, stable

A seedling takes five minutes to publish. Incompleteness is treated as natural, not embarrassing — the core mechanism that keeps the wiki perpetually growing instead of stalling out.

Each domain (coding / bioinformatics / biology / ML-DL-AI) acts as its own visual "biome." A phylogenetic/lineage view — showing which notes descended from which ideas — is planned as a future layer.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro (hybrid/SSR) | Content-first, minimal JS, file-based routing, MDX support; SSR powers the auth/dashboard pages while public notes stay static |
| Content | MDX + Content Collections | Type-safe frontmatter (domain, tags, growth stage, related notes) |
| Math | remark-math + rehype-katex | Formula rendering for ML/bioinformatics notes |
| Code | Shiki | Syntax highlighting |
| Search | Pagefind | Free, static, zero-backend full-text search |
| Hosting | Vercel / Cloudflare Pages | Free tier, auto-deploy on `git push` |
| Content storage | GitHub repo | Source of truth for published notes — versioned, portable |
| User data | Supabase (Postgres) | Roles, drafts, bookmarks, comments — relational data that doesn't belong in git |
| Auth | Supabase Auth (GitHub OAuth) | Login with GitHub; Supabase handles the OAuth handshake, sessions, and user table |
| Publishing | Octokit | Commits approved drafts/revisions to GitHub as MDX, triggering a rebuild |

**Split of responsibility:** git holds published, permanent content. Supabase holds everything in-progress or interactive — drafts, revisions, bookmarks, comments, roles, audit log.

## Roles & Publishing Flow

| Role | Capabilities |
|---|---|
| Reader (default) | Bookmark notes, comment |
| Writer (approval required) | + create/edit drafts |
| Admin (approval required) | + publish drafts, approve/reject revisions, manage roles, moderate comments |

- Role upgrades are request-based, never self-assigned.
- Editing an already-published note creates a **pending revision** rather than overwriting it directly — it only goes live once an Admin approves it.
- **Reading is fully public** — no login required to browse or search notes. Login is only needed to bookmark, comment, or write.

## Security & Anti-Spam

- Session tokens in httpOnly cookies, never localStorage
- API-layer role checks on every sensitive request, backed by Supabase Row Level Security as a second, independent layer
- Fine-grained GitHub PAT scoped to this repo only (`contents:write`)
- Comments sanitized before rendering; never rendered as raw HTML
- Honeypot fields, server-side rate limiting, and a new-commenter review queue guard against spam and bots

## Project Structure

```
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
├── AGENTS.md
├── CLAUDE.md
├── knowledge-wiki-masterplan.md
└── package.json
```

Astro looks for `.astro`, `.md`, and `.mdx` files under `src/pages/`; each maps to a route by file name. Static assets live in `public/`.

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build the production site to `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run astro ...` | Run Astro CLI commands (`astro add`, `astro check`, etc.) |

## Status

Early stage — the project skeleton is in place; content collections, auth, and the writer/admin dashboards are being built out in phases per [`knowledge-wiki-masterplan.md`](./knowledge-wiki-masterplan.md), which is the source of truth for design decisions and build order.

## Learn More

- [Astro documentation](https://docs.astro.build)
- [Astro Discord](https://astro.build/chat)
