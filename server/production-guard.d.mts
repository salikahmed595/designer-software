export interface GuardConfig {
  production: string; allowedRoots: string[]; deniedRoots: string[]; jobsRoot: string;
  /** tool-name prefixes this job may use (default: Photoshop, Illustrator, design-assets) */
  connectors?: string[];
  /** connector tools refused for this job (default: Illustrator's Image Trace) */
  deniedTools?: string[];
  /** engine command ids (regular expressions, case-insensitive) refused in command_run / command_batch */
  deniedCommands?: string[];
}
export function decide(
  input: { tool_name?: unknown; tool_input?: unknown; cwd?: unknown } | null | undefined,
  config: GuardConfig,
): { allow: true } | { allow: false; reason: string };
