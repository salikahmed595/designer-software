/**
 * Drawing engines: the pair of apps a job is drawn in. The designer picks one per job.
 *   adobe: Adobe Photoshop 2023 + Illustrator 2022, through the cli-anything connectors.
 *   craft: PhotoCraft + VectorCraft (ArtCraft), headless engines with their own MCP servers.
 *
 * Plans and the asset registry keep the role names "Photoshop" (raster / painted) and "Illustrator" (vector), so
 * older jobs stay valid; the app a role is drawn in comes from the job's engine (appFor).
 * Everything the server and the prompts need to know about an engine lives here, in one place.
 */
export const ENGINE_IDS = ['adobe', 'craft'] as const;
export type EngineId = (typeof ENGINE_IDS)[number];
export const DEFAULT_ENGINE: EngineId = 'adobe';
/** A part's role in a plan: "Photoshop" = painted / raster, "Illustrator" = vector. */
export type AppRole = 'Photoshop' | 'Illustrator';

export interface Engine {
  id: EngineId;
  /** shown to the designer */
  label: string;
  /** "<raster> and/or <vector>" as the agent's instructions say it */
  phrase: string;
  apps: Record<AppRole, string>;
  /** MCP server names, as registered with Claude Code (raster app first) */
  servers: [string, string];
  /** the drawing agent may call tools starting with these */
  toolPrefixes: [string, string];
  /** connector tools the drawing agent never gets (tracing, driving the app window) */
  deniedTools: string[];
  /** engine command ids (regular expressions) the guard refuses inside command_run / command_batch */
  deniedCommands: string[];
  /** how to draw with this engine's tools — part of the drawing agent's instructions */
  notes: string[];
}

const ADOBE: Engine = {
  id: 'adobe',
  label: 'Photoshop + Illustrator (Adobe)',
  phrase: 'Adobe Photoshop and/or Illustrator',
  apps: { Photoshop: 'Photoshop', Illustrator: 'Illustrator' },
  servers: ['photoshop', 'illustrator'],
  toolPrefixes: ['mcp__photoshop', 'mcp__illustrator'],
  deniedTools: ['mcp__illustrator__trace'],
  deniedCommands: [],
  notes: [
    'Tools: Photoshop (mcp__photoshop__*, pixels, origin top-left) for painted parts and the final composition; Illustrator (mcp__illustrator__*, points, origin top-left of the artboard, y down) for vector parts. Name every item you create.',
    'In Illustrator, draw organic shapes (flames, feathers, hair, fur, leaves, petals, swooshes, lettering) as real Bezier curves, not as straight-sided polygons: write them as SVG path data with C, Q or A curves and draw them with path_svg (several M parts make one compound path with holes), or give path_draw a few points with smooth=true and mark sharp tips with "corner": true. Check the exported PNG: jagged, angular edges mean straight segments slipped in.',
    'Save Illustrator work with doc_save (artwork.ai, checkpoints .ai) and Photoshop work with doc_save (artwork.psd, checkpoints .psd); look at your work with doc_export to a PNG and Read it.',
  ],
};

const CRAFT: Engine = {
  id: 'craft',
  label: 'PhotoCraft + VectorCraft',
  phrase: 'PhotoCraft and/or VectorCraft',
  apps: { Photoshop: 'PhotoCraft', Illustrator: 'VectorCraft' },
  servers: ['photocraft', 'vectorcraft'],
  toolPrefixes: ['mcp__photocraft', 'mcp__vectorcraft'],
  // The run is headless: nothing may drive an app window (it could reach the designer's own open documents).
  deniedTools: [
    'mcp__photocraft__control_call', 'mcp__photocraft__ui_inspect', 'mcp__photocraft__ui_menu_invoke', 'mcp__photocraft__ui_pointer',
    'mcp__photocraft__ui_screenshot', 'mcp__photocraft__ui_set',
    'mcp__vectorcraft__answer_dialog', 'mcp__vectorcraft__inspect_ui', 'mcp__vectorcraft__invoke_menu', 'mcp__vectorcraft__open_panel',
    'mcp__vectorcraft__pointer_gesture', 'mcp__vectorcraft__press_key', 'mcp__vectorcraft__screenshot', 'mcp__vectorcraft__type_text',
    'mcp__vectorcraft__ui_inspect', 'mcp__vectorcraft__ui_screenshot',
  ],
  deniedCommands: ['imagetrace', 'batchtrace'],
  notes: [
    'Tools: PhotoCraft (mcp__photocraft__*, pixels, origin top-left) for painted parts and the final composition; VectorCraft (mcp__vectorcraft__*, points, origin top-left of the first artboard, y down) for vector parts. Both run headless: file paths are relative to this production folder (or absolute inside it). Name every layer and object you create.',
    'Neither app creates folders: before the first save into a new folder (output/, checkpoints/<asset>/<stage>/<run>/, evidence/…), create it by writing a small file there with Write (for example <folder>/.keep).',
    'Find commands before guessing: command_list with a filter (VectorCraft: add brief=true, then filter by the exact id to read its params) gives each command id and its params; run them with command_run, or several in order with command_batch. Read errors: they say which param is wrong.',
    'VectorCraft: start with command_run file.new {"width": W, "height": H, "units": "Pixels", "backgroundContents": "transparent"} at the canvas size. Draw with draw_shape and draw_path; draw organic shapes (flames, feathers, hair, fur, leaves, petals, swooshes, lettering) as real Bezier curves — draw_path with SVG path data `d` using C, Q or A curves, or points with in/out handles — never as straight-sided polygons. Pass an explicit fill and stroke:"none" for filled shapes. add_text makes live text; set_paint, pathfinder, apply_effect and transform finish shapes. render_preview shows the document; doc_inspect lists it.',
    'VectorCraft saving: save_file {"path": "output/artwork.ai"} writes the layered .ai (checkpoints: save_file to the checkpoint .ai path); export {"path": ".../x.svg"} or .png gives a file PhotoCraft can place, and a PNG capture you can Read.',
    'PhotoCraft: doc_new {"width": W, "height": H, "background": "transparent" or a colour} at the canvas size; make named layers and groups with command_run layer.new.layer / layer.new.group; fills, gradients and adjustment layers with layer.newFillLayer.* and layer.newAdjustmentLayer.*; filters with filter.* (find ids with command_list). doc_place {"path": "<vector export>.svg"} brings a VectorCraft part in as a Smart Object layer. render_preview shows the document; doc_inspect lists layers.',
    'PhotoCraft saving: doc_save {"path": "output/artwork.psd"} writes the layered PSD (checkpoints: doc_save to the checkpoint .psd path); doc_export {"path": ".../capture.png"} writes a flattened PNG capture without changing the document.',
  ],
};

export const ENGINES: Record<EngineId, Engine> = { adobe: ADOBE, craft: CRAFT };

const isEngineId = (v: unknown): v is EngineId => typeof v === 'string' && (ENGINE_IDS as readonly string[]).includes(v);

/** The engine of a job; jobs saved before engines existed were drawn in Adobe. */
export const engineOf = (id: unknown): Engine => ENGINES[isEngineId(id) ? id : DEFAULT_ENGINE];

export const appFor = (engine: EngineId, role: AppRole): string => ENGINES[engine].apps[role];

/** The engine from an untrusted request: missing = Adobe (the default), anything unknown is refused. */
export function parseEngine(raw: unknown): { ok: true; engine: EngineId } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, engine: DEFAULT_ENGINE };
  return isEngineId(raw) ? { ok: true, engine: raw } : { ok: false, error: 'Unknown drawing apps. Choose Photoshop + Illustrator or PhotoCraft + VectorCraft.' };
}
