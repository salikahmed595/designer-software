# Free asset platforms for client artwork (researched November 2026)

Which open asset platforms the studio's drawing agent should use, what is connected now, and why some popular sites are left out. The deliverables are sold to clients and often become **trademarks** (logos, channel branding), so the licence decides first, catalogue size second.

## Connected now — `design-assets` connector (no API keys)

| Source | Tools | What for | Licence check |
|---|---|---|---|
| **Iconify** (200k+ SVG icons: Lucide, Tabler, Phosphor, Material Symbols, Remix…) | `icons_search`, `icons_download` | Icons and symbols for overlays, badges, UI, emote props | Per icon set. Only MIT / ISC / Apache / BSD / CC0 / OFL sets by default. CC BY sets (game-icons, Solar, Font Awesome free…) only with `allow_attribution`, and never in a logo. NC / SA / GPL sets are always refused. |
| **Fontsource** (Google Fonts and other open fonts) | `fonts_search`, `fonts_download`, `fonts_install` | Display and gaming fonts for logos, titles, overlays | OFL / Apache only. OFL allows logos and needs no credit in the artwork. |
| **Poly Haven** | `textures_search`, `textures_download` | Rock, metal, wood, fabric, grunge textures | CC0. Their API terms (July 2026) ask for the credit **"Powered by Poly Haven"**, which is recorded with every download. |
| **Art Institute of Chicago** | `art_search`, `art_download` | Public-domain reference: armour, costume, ornament, composition | Public-domain works only (CC0 images). Used as reference, not pasted in. |
| **Openverse** (already connected separately) | `openverse_search_images` | Broad search across Wikimedia, Smithsonian, Flickr CC… | Mixed per item; filter `license=cc0,pdm` for anything going into a deliverable. Not given to the drawing agent, which can't download from it. |

How a download works:
- Only a fixed list of hosts can be fetched.
- Files go only into the job folder (`production/jobs/<id>/assets`) or `Documents\Lumora-assets`.
- The real bytes are checked: SVG (no scripts), JPG, PNG, TTF or OTF.
- Every file gets an entry in `asset-credits.json` next to it: source, author, licence, licence URL and page.

## The logo rule

CC0, MIT, OFL and similar licences give **no trademark rights and no exclusivity**: anyone may use the same icon. So for a logo the agent draws the mark itself from scratch and uses icons only as reference. Fonts are fine in logos (OFL allows it).

## Worth adding next (no key)

- **ambientCG**: more CC0 textures. Downloads are zip files, so the colour map would need extracting.
- **Rijksmuseum**: a new Linked Art search API with no key; public-domain and CC0 items only.
- **The Met**: CC0 public-domain objects. Its search moved to `/v1.1/search` on 1 Oct 2026, and its image server currently blocks automated downloads (checked live), so it is reference-by-link only.
- **Lospec**: pixel-art palettes, but lookup is by name only (no search).
- **Kenney**: CC0 game sprites and UI. There is no API; download the packs by hand into `Documents\Lumora-assets`.

## Not connected, on purpose

| Site | Why |
|---|---|
| **Pixabay, Pexels** | Their licences ban use in a trademark or business name, which is a large part of the studio's work. Fine for a designer's own mood boards, by hand. |
| **Unsplash** | The API requires hotlinking and a download-tracking call, and brands and people in the photos are not cleared. Reference only, by hand. |
| **Magnific (formerly Freepik) / Flaticon** | The free tier requires attribution, and trademark use is banned unless the asset is substantially modified. |
| **Noun Project** | Free icons are CC BY (credit required); removing the credit needs a paid licence. |
| **game-icons.net** | CC BY 3.0: credit required, so never in a logo. Reachable through Iconify with `allow_attribution`. |
| **SVG Repo, OpenGameArt** | The licence varies per file, and there is no API (or no usable one). |
| **NASA images** | Mostly free, but the insignia is protected and endorsement must not be implied. Too easy to misuse in branding. |

All four photo sites (Pexels, Pixabay, Unsplash, and Smithsonian with a free api.data.gov key) could be added later as **reference-only** sources. A tool would have to keep them out of the artwork itself.

## Not verified

- Wikimedia Commons could not be reached from this computer (the connection was reset).
- The Art Institute of Chicago's docs page and Noun Project's logo policy returned 403.
- Community MCP servers for these sites exist but were not audited, so none are used. The `design-assets` connector is our own code, tested in `mcp/design-assets/`.
