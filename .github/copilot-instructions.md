# Copilot instructions for Mona Mayhem

## Project shape

This repository contains two related deliverables:

- The Astro application lives under `src/`. `src/pages/index.astro` is the app entry page, and `src/pages/api/contributions/[username].ts` is the server API route reserved for fetching a user's GitHub contribution data. The app is configured for server output with the standalone `@astrojs/node` adapter in `astro.config.mjs`.
- The workshop/documentation site is a static site assembled from `docs/`, `workshop/`, and the localized workshop trees. `docs/index.html` and `docs/step.html` provide the navigation shell; `step.html` fetches the selected Markdown step, filters `track:vscode`/`track:cli` blocks, and renders it in the browser. The Pages workflow copies this content into `_site`; it does not build or deploy the Astro app.

Keep these surfaces separate. Changes to the Astro app normally belong in `src/`, while workshop navigation, styling, or rendering changes belong in `docs/` and must preserve the Markdown/track conventions used by the workshop files.

## Commands

Install dependencies with `npm ci` (or `npm install` when following the workshop interactively).

```sh
npm run dev       # Astro development server, normally http://localhost:4321
npm run build     # production Astro build/type validation
npm run preview   # serve the built Astro output locally
```

There is no configured test runner, test script, or lint script, so there is no repository-supported single-test command. For a focused validation, run `npm run build`; for browser-facing changes, also run `npm run dev` or `npm run preview` and inspect the affected route.

The localization workflow uses Python:

```sh
python3 scripts/localization_sync.py finalize ...
python3 scripts/localization_sync.py apply-deletions ...
```

Do not invent arguments for these commands; use the argument values and staging flow in `.github/workflows/localization-sync.yml`.

## Implementation conventions

- Use Astro's file-based routing. Dynamic API parameters are supplied through `params`; API routes should return explicit JSON responses and status codes, and server-only routes must remain non-prerendered.
- Preserve the existing tab-indented formatting in Astro, JavaScript, and TypeScript files unless the surrounding file establishes a different style.
- The workshop supports both VS Code and CLI tracks in the same Markdown source. Put track-specific instructions between matching `<!-- track:vscode:start -->`/`<!-- track:vscode:end -->` or `<!-- track:cli:start -->`/`<!-- track:cli:end -->` markers. Keep shared content outside those blocks.
- Workshop step links should use the existing step IDs (`00-overview` through `06-bonus`). `docs/step.html` rewrites Markdown links to those IDs and persists the selected track in the URL/local storage; update its `steps` table if adding or renaming a step.
- The workshop renderer relies on the literal Markdown structure, fenced code, and special admonition syntax. Do not translate or rewrite commands, identifiers, URLs, HTML attributes, or code when editing localized content.
- Localization targets and rules are defined by `.github/skills/localizations/rules/`. The repository currently maintains `es`, `pt_BR`, and `ko` workshop/README translations. Keep localized files aligned with their source layout and preserve `.localization-state.json` baselines when working through the localization workflow.
- `scripts/localization_sync.py` validates safe paths, source/localized SHA-256 baselines, and deletion manifests. Treat malformed state or fingerprint mismatches as review blockers; do not overwrite metadata to hide them.

## Deployment

`.github/workflows/deploy.yml` deploys the static workshop to GitHub Pages on pushes to `main` and on manual dispatch. It copies `docs/*`, plus localized workshop directories, into `_site` and adds `.nojekyll`. If the Astro app is intentionally moved to Pages, follow the README deployment notes: switch Astro to static output, remove the Node adapter, build `dist/`, and configure `site`/`base` for project-page hosting.

## Repository-specific context

The repository is a Copilot workshop template. Workshop content intentionally teaches planning, agent mode, design iteration, and parallel workflows; preserve the two-track teaching flow when changing those documents. The `.devcontainer` uses Node 22, runs `npm ci` after creation, forwards port 4321, and recommends the Astro and GitHub Copilot extensions.

## Retro arcade design guide

- Use the dark arcade base `#0a0a1a` with neon green `#5fed83` and purple `#8a2be2` as the primary accents. Supporting surfaces should remain dark and translucent so content stays readable.
- Use Press Start 2P for prominent arcade labels, headings, and controls; keep a readable system sans-serif fallback for body copy and dense data.
- Favor restrained neon effects: CRT scanlines, glow/text-shadow, gradient shifts, shimmer, and short transform/opacity transitions. Prefer CSS animations and pseudo-elements over new dependencies.
- Respect `prefers-reduced-motion`: disable movement while retaining static decorative styling where possible.
- New UI must preserve the neon retro-arcade aesthetic, including the dark palette, glowing accents, and readable high-contrast states for focus, loading, errors, and results.
