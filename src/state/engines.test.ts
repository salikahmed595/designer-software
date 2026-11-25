import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINE, ENGINES, ENGINE_IDS, appFor, engineOf, parseEngine } from './engines';

describe('drawing engines', () => {
  it('has Adobe and the Craft apps, Adobe by default (older jobs were all Adobe)', () => {
    expect(ENGINE_IDS).toEqual(['adobe', 'craft']);
    expect(DEFAULT_ENGINE).toBe('adobe');
    expect(engineOf(undefined).id).toBe('adobe');
    expect(engineOf(null).id).toBe('adobe');
    expect(engineOf('craft').id).toBe('craft');
  });

  it('maps the plan roles (Photoshop = painted, Illustrator = vector) to each engine’s apps', () => {
    expect(appFor('adobe', 'Photoshop')).toBe('Photoshop');
    expect(appFor('adobe', 'Illustrator')).toBe('Illustrator');
    expect(appFor('craft', 'Photoshop')).toBe('PhotoCraft');
    expect(appFor('craft', 'Illustrator')).toBe('VectorCraft');
  });

  it('names the MCP servers and the tool prefixes the drawing agent may use', () => {
    expect(ENGINES.adobe.servers).toEqual(['photoshop', 'illustrator']);
    expect(ENGINES.craft.servers).toEqual(['photocraft', 'vectorcraft']);
    expect(ENGINES.craft.toolPrefixes).toEqual(['mcp__photocraft', 'mcp__vectorcraft']);
  });

  it('keeps tracing and app-window control away from the drawing agent', () => {
    expect(ENGINES.adobe.deniedTools).toContain('mcp__illustrator__trace');
    for (const t of ['mcp__photocraft__control_call', 'mcp__photocraft__ui_pointer', 'mcp__vectorcraft__pointer_gesture', 'mcp__vectorcraft__invoke_menu']) {
      expect(ENGINES.craft.deniedTools).toContain(t);
    }
    // VectorCraft's Image Trace is a command, not a tool: blocked by command id
    expect(ENGINES.craft.deniedCommands.some((re) => new RegExp(re, 'i').test('imageTrace.makeAndExpand'))).toBe(true);
    expect(ENGINES.craft.deniedCommands.some((re) => new RegExp(re, 'i').test('addon.document.batchTraceFolder'))).toBe(true);
    expect(ENGINES.craft.deniedCommands.some((re) => new RegExp(re, 'i').test('layer.new.layer'))).toBe(false);
  });

  it('gives the agent concrete tool notes for each engine', () => {
    const craft = ENGINES.craft.notes.join('\n');
    for (const s of ['draw_path', 'file.new', 'command_list', 'doc_place', 'doc_save', 'artwork.ai', 'artwork.psd', 'render_preview', '.keep']) expect(craft).toContain(s);
    expect(ENGINES.adobe.notes.join('\n')).toContain('path_svg');
  });

  it('reads an engine from an untrusted request', () => {
    expect(parseEngine(undefined)).toEqual({ ok: true, engine: 'adobe' });
    expect(parseEngine('craft')).toEqual({ ok: true, engine: 'craft' });
    expect(parseEngine('gimp').ok).toBe(false);
    expect(parseEngine(42).ok).toBe(false);
  });
});
