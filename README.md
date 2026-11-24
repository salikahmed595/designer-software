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

### Hand-made (the client's own design, drawn by a person — never generated)

For a client who wants their **own design recreated**, not AI-generated. Pick **Hand-made** on the first screen (Logo, Emblem, Illustration or Character).

- The brief asks for the **client's original** (required) instead of an art style. There is no size choice: the original decides.
- **Changes from the original**: two lists, *Add to the design* and *Take out of the design*. Type an item and press Add (or Enter); delete an item with ×. Empty lists mean an exact copy. Only approved changes go in; everything else stays as it is.
- **Send always makes a job sheet; no agent ever draws a hand-made job.** The `hand-made` skill (v3.0) forbids agent-controlled drawing for no-AI clients, so there is no redraw option. Send creates `handmade-job-sheet.md` at once — the rule (no generative AI, no auto-trace), the original's file name, the approved changes, the client's notes, a hand-over checklist and the full text of the `hand-made` skill — and a designer draws it by hand in Photoshop and Illustrator. Because no agent runs, the sheet can truthfully say no AI was used to prepare it. The bridge enforces this: a request that asks for an agent redraw (for example an old `handmadeMode: "draw"`) still becomes a job sheet.
- **Hand in the finished artwork**: on any hand-made job in **Jobs**, use **Upload layered PSD** / **Upload Illustrator file** (or **Replace…**) to add or replace the files after the designer draws it. The files are then downloadable from the job (with the PSD's layer count), and the job shows when they were handed in. The bridge checks the real file, not its name: a PSD must be a readable, layered `.psd` (a flattened one-layer PSD or a `.psb` is refused with the reason), an `.ai` must be an Illustrator file, and the limit is 1 GB. Only hand-made jobs take a hand-in.
- **Skills:** hand-made types are not on the Skills screen, because no agent draws them. The `hand-made` skill (`~/.claude/skills/hand-made/SKILL.md`) is the checklist in the job sheet; it can't be picked as a drawing skill.
- Older jobs made before this change (agent redraws) still show in Jobs with their files and a label saying how they were made.

### Free assets (icons, fonts, textures, public-domain art)

The drawing agent can use free, licence-checked assets through the **`design-assets`** connector (`mcp/design-assets/server.mjs`, no API keys). The studio registers it with Claude Code at startup, like the Adobe connectors. If that fails, jobs still run without it, and the Jobs screen shows the command to run.

- **Icons:** Iconify, 200k+ SVGs. Only sets that allow paid client work and logos (MIT, ISC, Apache, BSD, CC0, OFL). CC BY sets only when asked for, and never in a logo.
- **Fonts:** Fontsource, OFL/Apache only. `fonts_install` installs a font for the current Windows user, so Photoshop and Illustrator can use it for live text (they may need a restart).
- **Textures:** Poly Haven, CC0 ("Powered by Poly Haven").
- **Public-domain art reference:** Art Institute of Chicago.

Rules:
- Downloads go only into the job's `assets/` folder (or `Documents\Lumora-assets`) and are checked from their bytes.
- Each download is credited in `asset-credits.json` next to it.
- The agent lists the assets it used in `result.json`. It adapts icons and textures, redraws reference art by hand, and draws logo marks from scratch, because free licences give no trademark rights.

Why these sites and not Pexels, Pixabay, Unsplash or Freepik, and what to add next: see [docs/asset-platforms.md](docs/asset-platforms.md).

Tests: `npm run test:assets` (rules + live searches and downloads against the real sources).

### The Skills screen (add skills, default skill)

Click **Skills** in the header. Everything is saved the moment you change it and is used for the next job; no restart is needed.

- **Default skill**: draws every art style and artwork type that has no skill of its own. Pick it from the list. It can't be left empty.
- **Add a skill**: choose a `SKILL.md` file or paste its text. The screen shows the skill's name and description, or says in plain words what is wrong (for example a missing `name:` line). Optionally pick where to use it straight away (an art style, an artwork type or the default), then press **Add skill**. It is installed as `~/.claude/skills/<name>/SKILL.md`. An existing skill is never overwritten; a name that is already taken is refused.
- **Art styles / Artwork types**: one picker per row. A style's skill decides **how it looks** (Manga → `manga-effects`). An artwork type's skill decides **what is delivered**: layout, sizes, parts (VTuber Model Art → `vtuber-master`). "Default skill" means the default is used. Use the search box to find a row.

A job loads the style's skill first, then the artwork's skill (once, if they are the same). A skill that is chosen but not installed on this computer is marked **Not installed**, and a job that needs it is refused with a clear message instead of failing later.

The choices are stored in `production/skills.json` (`defaultSkill`, `styles`, `artworks`; `null` = default). You can edit it by hand too. If the file is broken, the screen says so, and the next save keeps the old file aside as `skills.json.broken-<time>`. Switches: `LUMORA_SKILLS_FILE` (another map file), `LUMORA_SKILLS_INSTALL_DIR` (where added skills go), `LUMORA_SKILLS_DIRS` (extra folders to look in, separated by `;` on Windows). Plugin skills (`plugin:skill`) can't be checked, so they are never marked missing.

A new art style also needs a thumbnail named `style-<id>` in `thumbnails/` (a test fails if it is missing).

### Turning the agent on (studio admin)

The bridge looks for a `claude` command. Until it finds one, jobs are saved but never start (hand-made job sheets don't need it), and the Jobs screen says the agent is not set up. If Claude Code is not installed as a command on the studio computer, install the Claude Code CLI, or set its full path before starting the app. (The copy inside the Claude desktop app works too, but its folder changes with every app update, so the CLI is the reliable choice.)

```
$env:LUMORA_CLAUDE_BIN = "C:\path\to\claude.exe"; npm run dev
```

The agent only uses **Photoshop 2023 and Illustrator 2023** (never another version). At startup the bridge checks both are installed and registers the `photoshop` / `illustrator` MCP servers with Claude Code if they are missing; if either app is missing, the Jobs screen says what to install.

#### Backup Claude accounts (when one runs out)

A job runs on this computer's Claude login first. If that account is out of usage (or can't sign in), the same job moves on to the next account. A drawing failure is never retried on another account. Set backups as **Windows user environment variables**, never in a file in this repo, then close the terminal and start the app from a new one:

1. Another Claude subscription: in a terminal run `claude setup-token`, sign in with the **other** account in the browser, and copy the token it prints. Then save it as `LUMORA_CLAUDE_TOKEN_2`, with `_3`, `_4`… for more accounts:
   ```powershell
   [Environment]::SetEnvironmentVariable('LUMORA_CLAUDE_TOKEN_2', (Read-Host 'Paste the token'), 'User')
   ```
2. An Anthropic API key (pay per use, from console.anthropic.com), tried last:
   ```powershell
   [Environment]::SetEnvironmentVariable('LUMORA_ANTHROPIC_API_KEY', (Read-Host 'Paste the API key'), 'User')
   ```

The Jobs screen then shows the order, e.g. "this computer's Claude login → backup Claude account 2 → Anthropic API key", and each job card says which account it ran on. Each agent run gets only its own account's credential; the token and key never go into job files, prompts or logs. API-key runs use the CLI's `--bare` mode, the only mode in which it uses a key while a subscription login exists; the Adobe connectors are passed to it explicitly.

Other switches: `LUMORA_RUNNER=mock` (placeholder result — used by the tests), `LUMORA_RUNNER=off` (save jobs only), `LUMORA_JOBS_DIR` (where job folders go; it must be inside the Adobe tool servers' allowed folders).

### Safety

- The bridge runs with `npm run dev` only and accepts requests only from this computer.
- The skills, canvas size and file names are decided on the server, never taken from the browser.
- An added skill's name must be lowercase letters, numbers and hyphens, so it can't point outside the skills folder; files are capped at about 200 KB and never overwrite an existing skill.
- The E2E tests use their own temporary copy of the skill map and their own install folder, so they never change your real skills.
- Downloads serve only `artwork.psd`, `artwork.ai` and `handmade-job-sheet.md` from a job's `output/` folder — no other file or path.
- A hand-in is saved under a fixed name (`artwork.psd` / `artwork.ai`), never the uploaded file's name. It is streamed to a temporary file with a 1 GB cap, checked from its bytes, and only then moved into place; a refused or broken upload leaves nothing behind. It must be sent as `application/octet-stream`, which other websites can't send without asking first.
- The client's text stays in `job.json` as data; the agent is told to treat it as art direction only.
- `production/jobs/` (client briefs and reference images) is never committed.

### Not verified yet

The tests use the demo runner, which writes a placeholder preview and a skeleton 3-layer PSD that go through the same checks as a real job. Real agent runs in Photoshop and Illustrator have been done by hand on the studio computer, not in the automated tests.

## Where things are

- `src/state/catalog.ts` — categories, the 40 artwork types, search.
- `src/state/flow.ts` — the three screens and the brief (pure reducer, saved on this device).
- `production/skills.json` — which skill draws each art style and artwork type.
- `src/state/production.ts` — skill routing, job validation, the agent's instructions, judging the result.
- `src/state/styles.ts` — the art styles.
- `src/glass/Skills.tsx` — the Skills screen (default skill, add a skill, per-style and per-artwork pickers).
- `server/files.ts` — PSD layer count, listing and installing skills, reading and saving the skill map.
- `src/glass/Thumb.tsx` — one drawn thumbnail per artwork type and per art style.
- `src/glass/pages.tsx` (step 1), `src/glass/Produce.tsx` (steps 2 and 3), `src/glass/ui.tsx`, `src/index.css`.
- `server/plugin.ts` — the local production bridge.
