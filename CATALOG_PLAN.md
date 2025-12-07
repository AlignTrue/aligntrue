# AlignTrue Align Catalog – Plan

**Instruction:** AI editors must update this plan and progress tracker after each meaningful change to the catalog implementation.

**Progress tracker**

- [x] Phase 0 – Create new `apps/web` catalog app, keep `apps/docs` static, add routing
- [x] Phase 1 – Core Align model, IDs, normalization, KV store with sorted sets
- [x] Phase 2 – Home `/` submission UI and URL extraction helper
- [x] Phase 3 – Submission API + KV persistence + redirect to `/a/<id>`
- [x] Phase 4 – `/a/[id]` detail page with view/install tracking
- [x] Phase 5 – Popular + recent lists on `/`
- [x] Phase 6 – Format toggle + viewer polish

Goal: Implement a new **Align Catalog** at `aligntrue.ai` with:

- Home `/` = catalog + ad hoc URL submission
- Align detail `/a/[id]`
- Docs still at `/docs`
- All units are **Aligns** (rules, packs, skills, MCPs, etc.)
- Align metadata + metrics stored in **Vercel KV** via an `AlignStore` abstraction
- IDs are 64-bit hash → URL-safe base64 (11 chars)

Follow the phases in order. Keep changes tightly scoped and incremental.

---

## Phase 0 – Create new `apps/web` and preserve `/docs`

**Objective (finalized):** Add a new `apps/web` Next.js app for the catalog. Keep `apps/docs` unchanged as the static Nextra site served at `/docs` via path routing/rewrites. Catalog owns `/` and `/a/[id]`. No folder rename.

### Tasks

1. **Add catalog app**
   - Create `apps/web` (App Router, server/runtime capable). Keep `apps/docs` intact.
   - `apps/web/package.json` named `@aligntrue/web`; include `@vercel/kv`.

2. **Workspace and scripts**
   - In `pnpm-workspace.yaml` add `"apps/web"` (keep `"apps/docs"`).
   - Root `package.json` scripts: add `dev:web`, keep `dev:docs`, root `dev` may run `@aligntrue/web`.
   - `scripts/dev-all.mjs` should run the catalog app, not docs.

3. **Preserve docs routing**
   - `/docs/**` served by the existing `apps/docs` static export (Nextra) via Vercel rewrite/monorepo routing.
   - Catalog owns `/` and `/a/[id]`.

4. **Home and detail entry points**
   - `apps/web/app/page.tsx` → catalog home (submission UI).
   - `apps/web/app/a/[id]/page.tsx` → detail page.

5. **Verify locally**
   - Run `pnpm dev` (or `pnpm dev:web`).
   - Confirm `/` (catalog), `/a/test-id` (detail stub), `/docs` (served from docs app).

---

## Phase 1 – Core Align model, IDs, normalization, and KV store

**Objective:** Introduce `AlignRecord`, `AlignStore`, and GitHub normalization/ID helpers backed by Vercel KV.

### Tasks

1.  **Create Align types**
    - Add `apps/web/lib/aligns/types.ts`:

      ```ts
      export type AlignKind = "rule" | "rule_group" | "skill" | "mcp" | "other";

      export type AlignRecord = {
        schemaVersion: 1;
        id: string; // URL-safe base64 ID (11 chars)
        url: string; // original submitted URL
        normalizedUrl: string; // canonical GitHub blob URL
        provider: "github" | "unknown";
        kind: AlignKind;
        title: string | null;
        description: string | null;
        fileType: "markdown" | "yaml" | "unknown";
        createdAt: string; // ISO timestamp
        lastViewedAt: string; // ISO timestamp
        viewCount: number;
        installClickCount: number;
      };
      ```

2.  **Create AlignStore interface**
    - Add `apps/web/lib/aligns/store.ts`:

      ```ts
      import type { AlignRecord } from "./types";

      export interface AlignStore {
        get(id: string): Promise<AlignRecord | null>;

        upsert(align: AlignRecord): Promise<void>;

        increment(
          id: string,
          field: "viewCount" | "installClickCount",
        ): Promise<void>;

        listRecent(limit: number): Promise<AlignRecord[]>;

        listPopular(limit: number): Promise<AlignRecord[]>;
      }
      ```

3.  **Implement KV-backed AlignStore**
    - Add `apps/web/lib/aligns/kvStore.ts`:

      ```ts
      import { kv } from "@vercel/kv";
      import type { AlignStore } from "./store";
      import type { AlignRecord } from "./types";

      const ALIGN_KEY_PREFIX = "v1:align:";

      function alignKey(id: string) {
        return `${ALIGN_KEY_PREFIX}${id}`;
      }

      export class KvAlignStore implements AlignStore {
        async get(id: string): Promise<AlignRecord | null> {
          return (await kv.get<AlignRecord>(alignKey(id))) ?? null;
        }

        async upsert(align: AlignRecord): Promise<void> {
          await kv.set(alignKey(align.id), align);
        }

        async increment(
          id: string,
          field: "viewCount" | "installClickCount",
        ): Promise<void> {
          const key = alignKey(id);
          const existing = await kv.get<AlignRecord>(key);
          if (!existing) return;

          const updated: AlignRecord = {
            ...existing,
            [field]: (existing[field] ?? 0) + 1,
            lastViewedAt:
              field === "viewCount"
                ? new Date().toISOString()
                : existing.lastViewedAt,
          };

          await kv.set(key, updated);
        }

        async listRecent(limit: number): Promise<AlignRecord[]> {
          const keys = await kv.keys<string>(`${ALIGN_KEY_PREFIX}*`);
          if (!keys.length) return [];
          const records = await kv.mget<AlignRecord>(keys);
          const list = records.filter(Boolean) as AlignRecord[];
          return list
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, limit);
        }

        async listPopular(limit: number): Promise<AlignRecord[]> {
          const keys = await kv.keys<string>(`${ALIGN_KEY_PREFIX}*`);
          if (!keys.length) return [];
          const records = await kv.mget<AlignRecord>(keys);
          const list = records.filter(Boolean) as AlignRecord[];
          return list
            .sort((a, b) => b.installClickCount - a.installClickCount)
            .slice(0, limit);
        }
      }
      ```

    - Ensure `@vercel/kv` is installed and configured in the project.

4.  **Add normalization + ID helpers** (GitHub-only v1)
    - Add `apps/web/lib/aligns/normalize.ts`:

      ```ts
      import crypto from "crypto";
      ```

    export type NormalizedGitSource = {
    provider: "github" | "unknown"; // v1 GitHub-only
    normalizedUrl: string | null; // canonical blob URL for GitHub
    };

    /\*\*
    - v1: only GitHub is fully supported.
    - - Accepts github.com blob URLs and raw.githubusercontent.com URLs.
    - - Normalizes to: https://github.com/{owner}/{repo}/blob/{branch}/{path}
        \*/
        export function normalizeGitUrl(input: string): NormalizedGitSource {
        const trimmed = input.trim();

        let url: URL;
        try {
        url = new URL(trimmed);
        } catch {
        return { provider: "unknown", normalizedUrl: null };
        }

        // GitHub blob URLs
        if (url.hostname === "github.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        const [owner, repo, maybeBlob, branch, ...rest] = parts;
        if (
        owner &&
        repo &&
        maybeBlob === "blob" &&
        branch &&
        rest.length > 0
        ) {
        const path = rest.join("/");
        const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
        return { provider: "github", normalizedUrl: normalized };
        }
        return { provider: "github", normalizedUrl: null };
        }

        // GitHub raw URLs
        if (url.hostname === "raw.githubusercontent.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        const [owner, repo, branch, ...rest] = parts;
        if (owner && repo && branch && rest.length > 0) {
        const path = rest.join("/");
        const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
        return { provider: "github", normalizedUrl: normalized };
        }
        return { provider: "github", normalizedUrl: null };
        }

        // v1: treat everything else as unsupported
        return { provider: "unknown", normalizedUrl: null };

    }

    /\*\*
    - Compute an 11-char URL-safe base64 ID from normalizedUrl.
    - - Uses first 8 bytes (64 bits) of SHA-256 hash
    - - Encodes in base64, then makes it URL-safe and strips padding.
        \*/
        export function alignIdFromNormalizedUrl(normalizedUrl: string): string {
        const hash = crypto.createHash("sha256").update(normalizedUrl).digest();
        const first8 = hash.subarray(0, 8);
        const b64 = first8.toString("base64");
        return b64.replace(/\+/g, "-").replace(/\//g, "\_").replace(/=+$/g, "");
        }

    /\*\*
    - Convert a normalized GitHub blob URL back to a raw URL for fetching content.
      \*/
      export function githubBlobToRawUrl(blobUrl: string): string | null {
      try {
      const url = new URL(blobUrl);
      if (url.hostname !== "github.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const [owner, repo, maybeBlob, branch, ...rest] = parts;
      if (
      owner &&
      repo &&
      maybeBlob === "blob" &&
      branch &&
      rest.length > 0
      ) {
      const path = rest.join("/");
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      }
      return null;
      } catch {
      return null;
      }
      }

    ```

    ```

5.  **Quick unit tests (optional but ideal)**
    - Add basic tests for:
      - `normalizeGitUrl` on blob + raw URLs.
      - `alignIdFromNormalizedUrl` returning 11-char URL-safe strings.
      - `githubBlobToRawUrl` inverse behavior for valid inputs.

---

## Phase 2 – Home `/` ad hoc preview (no KV yet)

**Objective:** Let a user paste a GitHub URL on `/` and see the content rendered via client-side fetch.

### Tasks

1. **URL extraction helper for marketing mode**
   - Add `apps/web/lib/aligns/urlFromSearch.ts`:

     ```ts
     export function getSubmittedUrlFromSearch(search: string): string | null {
       const params = new URLSearchParams(search);

       // Preferred: ?url=<git-url>
       const explicit = params.get("url");
       if (explicit) return explicit;

       // Marketing mode: ?https://github.com/...
       const keys = Array.from(params.keys());
       if (keys.length === 1 && !params.get(keys[0])) {
         const candidate = keys[0];
         if (
           candidate.startsWith("http://") ||
           candidate.startsWith("https://")
         ) {
           return candidate;
         }
       }

       return null;
     }
     ```

2. **Build basic home UI**
   - In `/` page component:
     - Create a layout with:
       - Title: “AlignTrue Align Catalog”
       - Subtitle: e.g. “Paste any public GitHub align URL to get a shareable page.”
       - Card with:
         - URL input
         - “Preview align” button
       - Placeholder sections: “Popular aligns” and “Recent aligns” (static text for now).
   - On “Preview align” click:
     - Normalize URL on the client using `normalizeGitUrl`.
     - If invalid → show error.
     - If valid and provider is `github`:
       - Use `githubBlobToRawUrl` to get raw URL.
       - Fetch raw content in the browser.
       - Render it in a basic viewer:
         - If ends with `.md`/`.mdc` → render with `react-markdown`.
         - If ends with `.yaml`/`.yml` → show in `<pre><code>`.

3. **No KV integration in this phase**  
   Just focus on correct fetch + render for GitHub URLs.

---

## Phase 3 – Submission API + KV persistence + redirect to `/a/<id>`

**Objective:** Turn “paste URL” into a persisted Align in KV and redirect to canonical `/a/<id>`.

### Tasks

1. **Implement submission API**
   - Add `apps/web/pages/api/aligns/submit.ts` **or** `apps/web/app/api/aligns/submit/route.ts`:
     - Accept `POST` JSON `{ url: string }`.
     - Steps:
       1. Normalize with `normalizeGitUrl`.
          - If `provider !== 'github'` or `normalizedUrl === null` → return 400 with error JSON.
       2. Compute `id = alignIdFromNormalizedUrl(normalizedUrl)`.
       3. Derive raw URL via `githubBlobToRawUrl(normalizedUrl)` and fetch content server-side.
          - Enforce a size cap (e.g. 256 KB).
          - Reject non-2xx or oversized responses.
       4. Determine `fileType`:
          - If extension `.yaml`/`.yml` or YAML parse succeeds → `fileType = 'yaml'`.
          - Else → `fileType = 'markdown'`.
       5. Extract basic metadata:
          - For Markdown:
            - Use `gray-matter` to read frontmatter `title`/`description` if present.
            - If no frontmatter, use first `# Heading` as title if available.
          - For YAML:
            - Use `js-yaml.safeLoad` and try to read `title` / `description` if present.
       6. Determine `kind`:
          - If YAML manifest → `kind = 'rule_group'`.
          - Else → `kind = 'rule'` for v1.
       7. Build `AlignRecord`:
          - If `KvAlignStore.get(id)` returns existing:
            - Preserve `createdAt`, `viewCount`, `installClickCount`.
            - Update other fields.
          - Else:
            - Set `createdAt` and `lastViewedAt` to `new Date().toISOString()`.
            - Set counters to `0`.
            - Set `schemaVersion = 1`.
       8. Call `KvAlignStore.upsert` with the record.
       9. Return JSON `{ id }`.

2. **Wire `/` to submission API (ad hoc + button)**
   - On home page:
     - On initial load:
       - Use `getSubmittedUrlFromSearch(window.location.search)`.
       - If it returns a URL:
         - Call `POST /api/aligns/submit` with `{ url }`.
         - On success `{ id }`, redirect to `/a/${id}`.
     - On “Get shareable align” button click:
       - Take URL from input.
       - Call `POST /api/aligns/submit`.
       - On success, redirect to `/a/${id}`.
     - Show clear error messages for invalid URL / unsupported host / fetch failure.

3. **Stop doing client-only preview in this phase**
   - At this point the main flow is:
     - Home → submit → redirect to `/a/<id>` where the real viewer lives.

---

## Phase 4 – `/a/<id>` detail page backed by KV + view tracking

**Objective:** `/a/<id>` should load metadata from KV, fetch raw content from GitHub, render it, and track views.

### Tasks

1. **Align fetch API**
   - Add `apps/web/pages/api/aligns/[id].ts` or `app/api/aligns/[id]/route.ts`:
     - `GET /api/aligns/:id`:
       - Use `KvAlignStore.get(id)`.
       - If null → 404 JSON `{ error: 'Not found' }`.
       - Else → return `AlignRecord` as JSON.

2. **View / install event API**
   - Add `apps/web/pages/api/aligns/[id]/event.ts` or `app/api/aligns/[id]/event/route.ts`:
     - Accept `POST` JSON `{ type: 'view' | 'install' }`.
     - Map:
       - `'view'` → `AlignStore.increment(id, 'viewCount')`.
       - `'install'` → `AlignStore.increment(id, 'installClickCount')`.
     - Return 204 on success.

3. **Implement `/a/[id]` real behavior**
   - In `/a/[id]` page component:
     - On server or client load:
       - Fetch `AlignRecord` from `GET /api/aligns/:id`.
       - If 404, show “Align not found.”
     - Once metadata is loaded:
       - Use `githubBlobToRawUrl(align.normalizedUrl)` to derive raw URL.
       - Fetch raw content client-side.
       - Render:
         - Title (`align.title` or fallback)
         - Kind chip (e.g. `AlignKind` as a badge)
         - Source link (link to `align.normalizedUrl` on GitHub)
         - Main content:
           - If `fileType === 'markdown'`: render via `react-markdown`.
           - If `fileType === 'yaml'`: show as formatted code block.
     - On first successful render:
       - Call `POST /api/aligns/:id/event` with `{ type: 'view' }`.

4. **Add basic install panel**
   - On `/a/[id]`:
     - Add an “Install with AlignTrue” panel showing:

       ```bash
       npm install -g aligntrue
       aligntrue init --source <align.url>
       ```

     - `<align.url>` should be the original submitted URL (not the raw URL).
     - Add “Copy command” button:
       - Copies both lines to clipboard.
       - Calls `POST /api/aligns/:id/event` with `{ type: 'install' }`.

---

## Phase 5 – Popular + recent lists on `/`

**Objective:** Show “Most popular aligns” and “Recently submitted aligns” on the homepage using KV.

### Tasks

1. **Popular + recent APIs**
   - Add `apps/web/pages/api/aligns/popular.ts` and `apps/web/pages/api/aligns/recent.ts`
     **or** equivalent `app/api/aligns/popular/route.ts` and `recent/route.ts`:
     - `GET /api/aligns/popular?limit=20`:
       - Parse `limit` with a safe default (e.g. 8).
       - Use `AlignStore.listPopular(limit)`.
     - `GET /api/aligns/recent?limit=20`:
       - Use `AlignStore.listRecent(limit)`.

2. **Render lists on `/`**
   - On home page (when not in ad hoc redirect flow):
     - On initial render:
       - Fetch `/api/aligns/popular?limit=8` and `/api/aligns/recent?limit=8`.
     - Render:
       - “Most popular aligns”:
         - Grid or list of cards:
           - Title
           - Short description
           - Provider icon (GitHub)
           - Optional metrics (views/installs)
           - Click → navigate to `/a/${align.id}`
       - “Recently submitted aligns”:
         - Similar cards, ordered by `createdAt`.

---

## Phase 6 – (Optional) Format toggle + nicer viewer

**Objective:** Add UX sugar: format toggling (Align `.md` vs Cursor `.mdc`) and cleaner Markdown/YAML rendering.

### Tasks

1. **Format conversion helper**
   - Add `apps/web/lib/aligns/format.ts`:

     ```ts
     export type TargetFormat = "align-md" | "cursor-mdc";

     export function convertAlignContentForFormat(
       content: string,
       format: TargetFormat,
     ): { filename: string; text: string } {
       const base = "align";
       if (format === "align-md") {
         return { filename: `${base}.md`, text: content };
       }
       return { filename: `${base}.mdc`, text: content };
     }
     ```

   - v1: Only change filename extension. Keep text identical.

2. **Wire format toggle in `/a/[id]`**
   - Add UI controls near the viewer:
     - Dropdown: “Download as: Align (.md) | Cursor (.mdc)”
     - “Download file” button:
       - Uses `convertAlignContentForFormat` and triggers browser download.
     - “Copy as text” button:
       - Uses `convertAlignContentForFormat` and copies to clipboard.

3. **Optionally track format usage**
   - Extend `/api/aligns/[id]/event` to accept an optional `format` field.
   - Fire events when users download / copy in a specific format.

---

You can implement Phases 0–4 first to get a fully functional catalog with shareable `/a/<id>` URLs and KV persistence, then iterate on Phases 5–6 for polish, popularity lists, and nicer UX.
