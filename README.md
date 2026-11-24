# Lumora — artwork studio for streamer and gamer clients

A small tool for a design studio. A designer picks what the client needs, adds the art style and the client's brief, and an agent draws it in Photoshop and Illustrator.

Three screens, nothing else:

1. **Choose artwork** — 40 artwork types for streamers and gamers (stream overlays, Discord art, characters and VTubers, emotes and badges, gaming branding), each with a thumbnail. Search understands everyday words (pfp, brb, facecam…).
2. **Brief** — art style, the client's brief, an optional reference image, and the size. A checklist shows what is still missing.
3. **Jobs** — what is being drawn, and the finished artwork with the agent's notes.

**3D** is listed as "coming soon": Photoshop and Illustrator are 2D tools, so 3D needs its own production pipeline before it can be offered.

## Thumbnails

Every card shows an illustration from `thumbnails/` (56 SVG files: 40 artwork types, 16 art styles).

- **Replace one with real studio work:** put a PNG, JPG, WebP or SVG in `thumbnails/` named after the card, for example `stream-overlay.jpg`. `thumbnails/README.md` lists every name. Remove the old `.svg` of the same name so there is only one file per card.
- **Regenerate the drawn ones:** `npm run thumbnails`. The drawings are built from shared parts in `scripts/thumbs/` (one sample character, one mascot, common scenes), so a change there updates every card that uses it. Three files are hand-drawn and not regenerated: `stream-overlay`, `style-anime-cel`, `style-semi-real`.
- If a card has no file, a simple built-in sketch is shown instead.

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
3. The agent loads the job's skills (see below), draws by hand — no AI image generation — and saves layered `output/artwork.psd` and/or `output/artwork.ai`, a flattened `output/preview.png` and `output/result.json`.
4. The bridge checks the result before calling it finished: there must be a preview **and** a layered source file. It reads the layer count from `artwork.psd`; a flattened PSD (one layer) is marked "Needs attention", because designers must be able to edit every part.
5. The Jobs screen shows the status, the skills used, the notes, and **Download layered PSD** / **Download Illustrator file** buttons.

### Adding your skills

Every art style and every artwork type has its own slot in `production/skills.json`:

- `"styles"` — each style's `"skill"` decides **how it looks** (e.g. Anime → `anime-art`, Manga → `manga-effects`).
- `"artworks"` — each artwork type's skill decides **what is delivered**: layout, sizes, parts (e.g. VTuber Model Art → `vtuber-master`).
- `null` means the general skill (`"defaultSkill"`) is used until you add one.

A job loads the style's skill first, then the artwork's skill (once, if they are the same). Use the skill's folder name from `~/.claude/skills/`. Save the file and the running app picks it up.

**Skill setup** (Jobs → Skill setup) lists every slot, which skill it uses, and whether that skill is installed on this computer. A job whose skill is missing is refused with a clear message instead of failing later. Extra skill folders can be added with `LUMORA_SKILLS_DIRS` (separated by `;` on Windows). Plugin skills (`plugin:skill`) can't be checked and are shown as "Plugin skill".

A new art style also needs a thumbnail named `style-<id>` in `thumbnails/` (a test fails if it is missing).

### Turning the agent on (studio admin)

The bridge looks for a `claude` command. If Claude Code is not installed as a command on the studio computer, install the Claude Code CLI, or set its full path before starting the app:

```
$env:LUMORA_CLAUDE_BIN = "C:\path\to\claude.exe"; npm run dev
```

Other switches: `LUMORA_RUNNER=mock` (placeholder result — used by the tests), `LUMORA_RUNNER=off` (save jobs only), `LUMORA_JOBS_DIR` (where job folders go; it must be inside the Adobe tool servers' allowed folders).

### Safety

- The bridge runs with `npm run dev` only and accepts requests only from this computer.
- The skills, canvas size and file names are decided on the server, never taken from the browser.
- Downloads serve only `artwork.psd` and `artwork.ai` from a job's `output/` folder — no other file or path.
- The client's text stays in `job.json` as data; the agent is told to treat it as art direction only.
- `production/jobs/` (client briefs and reference images) is never committed.

### Not verified yet

A real end-to-end agent run in Photoshop and Illustrator. The tests use the demo runner, which writes a placeholder preview and a skeleton 3-layer PSD that go through the same checks as a real job.

## Where things are

- `src/state/catalog.ts` — categories, the 40 artwork types, search.
- `src/state/flow.ts` — the three screens and the brief (pure reducer, saved on this device).
- `production/skills.json` — which skill draws each art style and artwork type.
- `src/state/production.ts` — skill routing, job validation, the agent's instructions, judging the result.
- `src/glass/Skills.tsx` — the Skill setup screen.
- `server/files.ts` — PSD layer count, installed-skill lookup.
- `src/glass/Thumb.tsx` — one drawn thumbnail per artwork type and per art style.
- `src/glass/pages.tsx` (step 1), `src/glass/Produce.tsx` (steps 2 and 3), `src/glass/ui.tsx`, `src/index.css`.
- `server/plugin.ts` — the local production bridge.
