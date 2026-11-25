export interface GuardConfig { production: string; allowedRoots: string[]; deniedRoots: string[]; jobsRoot: string }
export function decide(
  input: { tool_name?: unknown; tool_input?: unknown; cwd?: unknown } | null | undefined,
  config: GuardConfig,
): { allow: true } | { allow: false; reason: string };
