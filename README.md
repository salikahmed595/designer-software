# Lumora — artwork studio for streamer and gamer clients

A small tool for a design studio. A designer picks what the client needs, adds the art style and the client's brief, and an agent draws it in Photoshop and Illustrator.

Three screens, nothing else:

1. **Choose artwork** — 40 artwork types for streamers and gamers (stream overlays, Discord art, characters and VTubers, emotes and badges, gaming branding), each with a thumbnail. Search understands everyday words (pfp, brb, facecam…).
2. **Brief** — art style, the client's brief, an optional reference image, and the size. A checklist shows what is still missing.
3. **Jobs** — what is being drawn, and the finished artwork with the agent's notes.

**3D** is listed as "coming soon": Photoshop and Illustrator are 2D tools, so 3D needs its own production pipeline before it can be offered.

## Real thumbnails

Every card ships with a simple drawn sketch. To show real artwork instead, put an image in `thumbnails/` named after the card (for example `stream-overlay.jpg` or `style-manga.png`). `thumbnails/README.md` lists all 56 file names. Cards without an image keep their sketch.

## Run

```
npm install
npm run dev        # http://localhost:5173  (also starts the production bridge)
npm test           # unit + integration tests
npm run e2e        # browser tests (system Chrome, desktop + phone), demo runner only
npm run build
```

## How production works

1. The dev server's local bridge (`server/plugin.ts`) checks the request and writes `production/jobs/<id>/` with `job.json`, the reference image and `prompt.txt` (the agent's instructions).
2. It starts a Claude Code agent in that folder, one job at a time. The agent may use only the `photoshop` and `illustrator` tool servers plus file tools — no command line.
3. The agent loads the art style's skill, draws, and saves `output/artwork.psd` (+ `.ai`), `output/preview.png` and `output/result.json`. The Jobs screen shows the status, the preview and the notes.

### Adding your skills

Edit `production/styles.json`. Put the exact skill name in a style's `"skill"`; `null` uses `"defaultSkill"`. A new style also needs a thumbnail drawing named `style-<id>` in `src/glass/Thumb.tsx` (a test fails if it is missing).

### Turning the agent on (studio admin)

The bridge looks for a `claude` command. If Claude Code is not installed as a command on the studio computer, install the Claude Code CLI, or set its full path before starting the app:

```
$env:LUMORA_CLAUDE_BIN = "C:\path\to\claude.exe"; npm run dev
```

Other switches: `LUMORA_RUNNER=mock` (placeholder result — used by the tests), `LUMORA_RUNNER=off` (save jobs only), `LUMORA_JOBS_DIR` (where job folders go; it must be inside the Adobe tool servers' allowed folders).

### Safety

- The bridge runs with `npm run dev` only and accepts requests only from this computer.
- The skill, canvas size and file names are decided on the server, never taken from the browser.
- The client's text stays in `job.json` as data; the agent is told to treat it as art direction only.
- `production/jobs/` (client briefs and reference images) is never committed.

### Not verified yet

A real end-to-end agent run. The tests use the demo runner.

## Where things are

- `src/state/catalog.ts` — categories, the 40 artwork types, search.
- `src/state/flow.ts` — the three screens and the brief (pure reducer, saved on this device).
- `src/state/production.ts` — art styles and skills, job validation, the agent's instructions.
- `src/glass/Thumb.tsx` — one drawn thumbnail per artwork type and per art style.
- `src/glass/pages.tsx` (step 1), `src/glass/Produce.tsx` (steps 2 and 3), `src/glass/ui.tsx`, `src/index.css`.
- `server/plugin.ts` — the local production bridge.
