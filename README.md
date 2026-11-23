# Lumora — 2D artwork studio (frontend)

A goal-first, dark-glass guided flow for a design team: pick what the client wants from thumbnails, set a few essentials, and get a production brief for Photoshop / Illustrator.

**Honest scope:** this is the frontend only. Nothing is produced or exported — the last screen says so. The Photoshop / Illustrator pipeline is not connected, there is no backend and no network call.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: catalog, flow, classic generator, App integration (jsdom)
npm run e2e        # Playwright, system Chrome, desktop 1440 + phone 375
npm run build      # tsc + vite build
```

## Flow

`Home → Category → Artwork type → Customize → Brief` (stepper: 1 Choose artwork · 2 Customize · 3 Create & refine).

- **Browse-first:** six categories → eight artwork types each, every one with its own drawn thumbnail. Two clicks.
- **Prompt-first:** type an idea. A clear match goes to Customize with the guess shown and a *Change* link; an unclear one offers up to three choices and never auto-picks.
- **Search:** global and per category, with synonyms (pfp, brb, facecam, reactive avatar…).
- **Customize:** style, colours, optional name/text, optional idea, optional reference (its role is required). Canvas shape and variations sit under *More options*.
- **Brief:** summary plus JSON hand-off (`toJobBrief`), save to My Projects (this device only).
- **Tools menu:** the original Image / Edit / Video / Music / Voice / Sound / Graphic generators (demo).

2D still artwork only: Animation is shown as "Coming later", and no static/animated switch is offered.

## Production (agent → Photoshop / Illustrator)

The **Production** page sends a job: art style + client brief + optional reference image + ratio.

1. The dev server's local bridge (`server/plugin.ts`) validates the request and writes `production/jobs/<id>/` with `job.json`, the reference image, and `prompt.txt` (the agent's instructions).
2. It starts a Claude Code agent in that folder, one job at a time. The agent may use only the `photoshop` and `illustrator` tool servers plus file tools — no shell.
3. The agent loads the style's skill, draws, and saves `output/artwork.psd` (+ `.ai`), `output/preview.png` and `output/result.json`. The page polls and shows the status, the preview and the agent's notes.

**Adding your skills:** edit `production/styles.json`. Put the exact skill name in a style's `"skill"`; `null` uses `"defaultSkill"`. A new style also needs a thumbnail drawing named `style-<id>` in `src/glass/Thumb.tsx` (a test fails if it is missing).

**Turning the agent on:** the bridge looks for a `claude` command. If Claude Code is not installed as a command, either install the CLI or set its full path before starting the app:

```
$env:LUMORA_CLAUDE_BIN = "C:\path\to\claude.exe"; npm run dev
```

Other switches: `LUMORA_RUNNER=mock` (placeholder result, used by the tests), `LUMORA_RUNNER=off` (save jobs only), `LUMORA_JOBS_DIR` (where job folders go — must be inside the Adobe tool servers' allowed folders).

**Safety:** the bridge runs with `npm run dev` only and accepts requests only from this computer. The skill, canvas size and file names are decided on the server, never taken from the browser. The client's text is kept in `job.json` as data and the agent is told to treat it as art direction only.

**Not verified yet:** a real end-to-end agent run. Tests use the mock runner.

## Where things are

- `src/state/catalog.ts` — the data-driven registry: categories, 40 templates (canonical ids, aliases, styles, planned Photoshop/Illustrator route, capability notes, bundles), search and prompt intent.
- `src/state/flow.ts` — pure reducer for navigation, the brief, validation, projects and persistence.
- `src/glass/Thumb.tsx` — one SVG thumbnail per template. Add a template → add its drawing (a test fails if one is missing).
- `src/glass/` — header, stepper, cards, pages. `src/index.css` — design tokens and glass styles.
- `src/components/`, `src/state/studio.ts`, `src/state/styles.ts` — the classic generators under Tools.

## To connect production later

`toJobBrief(brief)` returns `{ template, madeIn, deliverables, style, colors, text, idea, reference, canvas, variations }`. Route on `template` (the canonical id), not on the category. `madeIn`, the capability notes and the Advanced options are UI assumptions — replace them with what the pipeline really supports.
