/**
 * Which Claude account the drawing agent uses, with fallback (dev server only, this computer only).
 *
 * Tried in this order, moving on ONLY when an account is out of usage/credit or cannot sign in:
 *   1. this computer's Claude login (what `claude` is signed in with),
 *   2. backup Claude accounts: env LUMORA_CLAUDE_TOKEN_2, _3, … — each a token from `claude setup-token`
 *      signed in with that account (passed to the agent as CLAUDE_CODE_OAUTH_TOKEN),
 *   3. an Anthropic API key: env LUMORA_ANTHROPIC_API_KEY (pay per use; run in --bare mode, the only mode
 *      where the CLI uses a key while a subscription login exists, so the Adobe connectors are passed in).
 * Secrets live only in environment variables — never in the repo, job files, prompts or logs — and each
 * agent run gets only its own account's credential.
 */
export type AccountKind = 'login' | 'token' | 'apikey';
export interface AgentAccount { label: string; kind: AccountKind; secret: string | null }
export type AccountProblem = 'limit' | 'auth' | null;
type Env = Record<string, string | undefined>;

const TOKEN_VAR = /^LUMORA_CLAUDE_TOKEN_(\d+)$/;
const API_KEY_VAR = 'LUMORA_ANTHROPIC_API_KEY';
/** Credential variables the agent must never inherit from the server. */
const CREDENTIAL_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', API_KEY_VAR];

export function agentAccounts(env: Env): AgentAccount[] {
  const accounts: AgentAccount[] = [{ label: 'This computer’s Claude login', kind: 'login', secret: null }];
  const tokens = Object.keys(env)
    .map((k) => ({ n: Number(TOKEN_VAR.exec(k)?.[1]), value: env[k]?.trim() ?? '' }))
    .filter((t) => Number.isInteger(t.n) && t.value)
    .sort((a, b) => a.n - b.n);
  tokens.forEach((t, i) => accounts.push({ label: `Backup Claude account ${i + 2}`, kind: 'token', secret: t.value }));
  const key = env[API_KEY_VAR]?.trim();
  if (key) accounts.push({ label: 'Anthropic API key', kind: 'apikey', secret: key });
  return accounts;
}

/** The agent's environment: the server's, minus every credential, plus this account's one. */
export function agentEnv(base: Env, account: AgentAccount): Env {
  const env: Env = {};
  for (const [k, v] of Object.entries(base)) if (!CREDENTIAL_VARS.includes(k) && !TOKEN_VAR.test(k)) env[k] = v;
  if (account.kind === 'token' && account.secret) env.CLAUDE_CODE_OAUTH_TOKEN = account.secret;
  if (account.kind === 'apikey' && account.secret) env.ANTHROPIC_API_KEY = account.secret;
  return env;
}

export const agentArgs = (base: string[], account: AgentAccount, mcpConfigFile: string): string[] =>
  account.kind === 'apikey' ? ['--bare', '--mcp-config', mcpConfigFile, ...base] : base;

/** The photoshop / illustrator / design-assets MCP entries from ~/.claude.json, as an --mcp-config file body. */
export function mcpServersFor(claudeJsonText: string): { mcpServers: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  try {
    const servers = (JSON.parse(claudeJsonText) as { mcpServers?: Record<string, unknown> }).mcpServers ?? {};
    for (const name of ['photoshop', 'illustrator', 'design-assets']) if (servers[name]) out[name] = servers[name];
  } catch {
    /* unreadable config: no connectors */
  }
  return { mcpServers: out };
}

/** Bare mode may not load skills by name, so tell the agent where each skill file is. */
export function bareSkillNote(skills: Array<{ name: string; file: string }>): string {
  if (!skills.length) return '';
  return ['', 'If the Skill tool cannot load a skill, Read its file instead and follow it:', ...skills.map((s) => `- "${s.name}": ${s.file}`)].join('\n');
}

export function accountsSummary(accounts: AgentAccount[]): string {
  if (accounts.length < 2) return '';
  const names = accounts.map((a, i) => (i === 0 ? 'this computer’s Claude login' : a.label.replace(/^Backup/, 'backup')));
  return `If an account runs out, the next one is used: ${names.join(' → ')}.`;
}

/**
 * Run with each account in turn. Only an account problem (out of usage/credit, cannot sign in) moves on;
 * any other result — success or a drawing failure — is final, so a job is never drawn twice.
 */
export async function runWithFallback<T>(
  accounts: AgentAccount[],
  attempt: (account: AgentAccount, index: number) => Promise<{ problem: AccountProblem; value: T }>,
): Promise<{ value: T; account: AgentAccount; tried: string[]; exhausted: boolean }> {
  const tried: string[] = [];
  let last: { value: T; account: AgentAccount } | null = null;
  for (const [i, account] of accounts.entries()) {
    tried.push(account.label);
    const r = await attempt(account, i);
    last = { value: r.value, account };
    if (!r.problem) return { ...last, tried, exhausted: false };
  }
  if (!last) throw new Error('No Claude account is set up.');
  return { ...last, tried, exhausted: true };
}
