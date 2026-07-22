# Personal Knowledge Wiki — Master Plan

## 1. Concept
A living knowledge base covering coding, bioinformatics, biology, and ML/DL/AI — organized around a **growth-stage metaphor** rather than a traditional "finished article" model:

- 🧬 **Seedling** — raw idea, just planted
- 🌱 **Sprout** — has structure, still growing
- 🌳 **Established** — mature, well-linked, stable

This keeps the barrier to publishing low (a seedling takes 5 minutes) and reframes incompleteness as natural rather than embarrassing — the core mechanism for keeping the site perpetually growing instead of stalling out.

Domains (coding / bioinformatics / biology / ML-DL-AI) act as distinct visual "biomes." Optional future layer: a phylogenetic/lineage view showing which notes descended from which ideas.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro** (hybrid/SSR mode) | Content-first, minimal JS, file-based routing, MDX support. SSR needed for auth/dashboard pages; public notes stay static. |
| Content format | **MDX** + Content Collections | Type-safe frontmatter (domain, tags, growth-stage, related notes) |
| Math | `remark-math` + `rehype-katex` | ML/bioinformatics formula rendering |
| Code | Shiki (built-in) | Syntax highlighting |
| Search | **Pagefind** | Free, static, zero-backend full-text search |
| Hosting | **Vercel** or **Cloudflare Pages** | Free tier, auto-deploy on `git push` |
| Published content storage | **GitHub repo** | Source of truth for live notes — versioned, portable |
| User data storage | **Supabase** (Postgres, free tier) | Roles, drafts, bookmarks, comments — relational data that doesn't belong in git |
| Auth | **Supabase Auth, GitHub as OAuth provider** | Login with GitHub; Supabase handles the OAuth handshake, sessions, and user table |
| Write path for publishing | **Octokit** | Commits approved drafts/revisions to GitHub as MDX files, triggering rebuild |

**Split of responsibility:** git = published, permanent content. Supabase = everything in-progress or interactive (drafts, revisions, bookmarks, comments, roles, audit log).

---

## 3. Data Model

**`users`**
- `id`, `github_username`, `role` (`reader` | `writer` | `admin`), `created_at`

**`role_requests`**
- `id`, `user_id`, `requested_role`, `status` (`pending` | `approved` | `denied`), `created_at`

**`drafts`**
- `id` (stable UUID), `author_id`, `title`, `content` (MDX), `domain`, `growth_stage`, `slug`, `status` (`draft` | `pending_publish` | `published`), `updated_at`

**`pending_revisions`**
- `id`, `note_id` (references the live note), `author_id`, `content`, `status` (`pending_review` | `approved` | `rejected`), `created_at`
- Represents an edit to an *already-published* note, held for Admin approval before it overwrites the live file

**`bookmarks`**
- `user_id`, `note_id` (not slug — slugs can change), `created_at`

**`comments`**
- `id`, `user_id`, `note_id`, `content`, `status` (`pending` | `approved` | `flagged`), `created_at`

**`audit_log`**
- `id`, `actor_id`, `action`, `target`, `timestamp` — records role changes, publishes, approvals, rejections

---

## 4. Roles & Permissions

| Role | Capabilities |
|---|---|
| **Reader** (default on sign-in) | Bookmark notes, add comments |
| **Writer** (requires Admin approval) | Reader abilities + create/edit drafts |
| **Admin** (requires Admin approval) | Writer abilities + publish drafts, approve/reject pending revisions, manage role requests, moderate comments |

- Role upgrades are **request-based, never self-assigned** — a user requests Writer/Admin, it lands in the Admin dashboard's approval queue.
- Editing an **already-published** note creates a `pending_revision`, not a direct overwrite — it only goes live after Admin approval (this also resolves the "two sources of truth" problem: the pending revision is the explicit in-between state).

---

## 5. Security

**Auth & sessions**
- Session tokens in httpOnly cookies (via Supabase SSR mode) — never localStorage, to limit XSS blast radius
- Short-lived access tokens with silent refresh (Supabase default)
- Minimal GitHub OAuth scopes — basic profile only

**Authorization — defense in depth**
- API-layer role checks on every sensitive request (publish, approve, change role) — re-checked from the database each time, never trusted from the client
- **Supabase Row Level Security (RLS)** as a second, independent layer — e.g. a user can only insert a bookmark with their own `user_id`; only admins can update the `role` column. This means a bug in app code doesn't automatically become a data breach.

**Secrets**
- GitHub token: a **fine-grained PAT scoped to just this one repo**, `contents:write` only — never a whole-account token
- Supabase: public **anon key** in the browser (constrained by RLS); **service role key** server-side only, never exposed to the client

**Content injection (XSS)**
- Comments stored as plain text or restricted markdown, sanitized before rendering (e.g. `sanitize-html`) — never rendered as raw HTML
- Writer drafts render as plain MDX without arbitrary component embedding until actually published, removing risk from a compromised writer account

**Audit log**
- Every role change, publish, approval, and rejection recorded (`audit_log` table) — cheap to add now, hard to retrofit later

---

## 6. Spam & Bot Prevention

Baseline advantage: commenting/bookmarking requires a completed GitHub OAuth login, which already filters out most drive-by bots.

Layered on top:
1. **Honeypot field** on comment forms — invisible to humans, catches simple bots for free
2. **Rate limiting** — max N comments per user per minute, enforced server-side via Supabase
3. **Cloudflare Turnstile** — free CAPTCHA alternative, add if honeypot proves insufficient
4. **New-commenter review queue** — first comment(s) from a new account held for approval, then auto-approved once trusted
5. **Content heuristics** — flag comments with unusual link density for manual review
6. **Writer draft cap** — limit drafts per writer per day so the Admin review queue can't be flooded even by an approved account

---

## 7. Build Phases

**Phase 1 — Static site skeleton**
- Astro project (hybrid/SSR mode), content collections for the 4 domains
- Base layout, note page template, homepage
- Deploy to Vercel/Cloudflare, confirm auto-deploy on push

**Phase 2 — Content & design polish**
- Growth-stage badges, domain-based visual theming
- Math + code rendering end-to-end
- Pagefind search wired in

**Phase 3 — Auth & users**
- Supabase project, GitHub as OAuth provider
- `users` table, auto-admin for your account, httpOnly cookie sessions

**Phase 4 — Reader features**
- Bookmarks (Supabase-backed)
- Comments with sanitization + moderation status field

**Phase 5 — Writer dashboard**
- Draft list/editor, gated to writer+ role
- "Plant a seedling" quick-capture flow
- Draft-per-day cap

**Phase 6 — Admin dashboard**
- Two separate review queues: **new drafts awaiting first publish** and **revisions awaiting re-approval**
- Publish action (Octokit commit → triggers rebuild, with "publishing…" state in UI)
- Role request approvals
- Comment moderation
- Audit log view

**Phase 7 — Security & anti-spam hardening**
- RLS policies for every table
- Honeypot + rate limiting on comments
- Fine-grained GitHub PAT, key separation review

**Phase 8 — Nice-to-haves**
- Phylogenetic/lineage view
- Revision history styled as "mutations"
- Weekly surfacing of oldest seedlings (Claude Code slash command)

---

## 8. Content Exposure

**Decision: reading is fully public.** No login required to browse or search notes — public + search-indexable. Login is only required for bookmarks, comments, and writing (Reader role and above). This doesn't change the security or anti-spam plan above.

Implications for later phases:
- All note pages render statically/publicly (Phase 1–2), independent of the Phase 3 auth work.
- Pagefind indexes the full public note set — no gating needed there.
- SSR/auth is only invoked on interactive routes (bookmark/comment actions, dashboards), not on note reads.
