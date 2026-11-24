import { describe, expect, it } from 'vitest';
import { accountsSummary, agentAccounts, agentArgs, agentEnv, bareSkillNote, mcpServersFor, runWithFallback, type AgentAccount } from './accounts';
import { accountProblem } from '../src/state/production';

const LOGIN: AgentAccount = { label: 'This computer’s Claude login', kind: 'login', secret: null };

describe('agentAccounts', () => {
  it('is just this computer’s login when nothing else is set up', () => {
    expect(agentAccounts({})).toEqual([LOGIN]);
  });

  it('adds backup Claude accounts in number order, then the API key last', () => {
    const accounts = agentAccounts({
      LUMORA_CLAUDE_TOKEN_10: 'tok-ten', LUMORA_CLAUDE_TOKEN_2: ' tok-two ', LUMORA_CLAUDE_TOKEN_3: '   ',
      LUMORA_ANTHROPIC_API_KEY: 'sk-key', LUMORA_CLAUDE_TOKEN_X: 'ignored',
    });
    expect(accounts.map((a) => [a.kind, a.secret])).toEqual([['login', null], ['token', 'tok-two'], ['token', 'tok-ten'], ['apikey', 'sk-key']]);
    expect(accounts.map((a) => a.label)).toEqual(['This computer’s Claude login', 'Backup Claude account 2', 'Backup Claude account 3', 'Anthropic API key']);
  });
});

describe('agentEnv', () => {
  const base = {
    PATH: 'C:\\bin', ANTHROPIC_API_KEY: 'inherited', ANTHROPIC_AUTH_TOKEN: 'inherited', CLAUDE_CODE_OAUTH_TOKEN: 'inherited',
    LUMORA_CLAUDE_TOKEN_2: 'tok-two', LUMORA_ANTHROPIC_API_KEY: 'sk-key',
  };

  it('uses the stored login with no credential variables at all', () => {
    const env = agentEnv(base, LOGIN);
    expect(env.PATH).toBe('C:\\bin');
    for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'LUMORA_CLAUDE_TOKEN_2', 'LUMORA_ANTHROPIC_API_KEY']) expect(env[k]).toBeUndefined();
  });

  it('gives a backup account only its own token, and the API key only the key', () => {
    const tokenEnv = agentEnv(base, { label: 'b', kind: 'token', secret: 'tok-two' });
    expect(tokenEnv.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok-two');
    expect(tokenEnv.ANTHROPIC_API_KEY).toBeUndefined();
    expect(tokenEnv.LUMORA_ANTHROPIC_API_KEY).toBeUndefined();
    const keyEnv = agentEnv(base, { label: 'k', kind: 'apikey', secret: 'sk-key' });
    expect(keyEnv.ANTHROPIC_API_KEY).toBe('sk-key');
    expect(keyEnv.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(keyEnv.LUMORA_CLAUDE_TOKEN_2).toBeUndefined();
  });

  it('never changes the server’s own environment', () => {
    const copy = { ...base };
    agentEnv(base, { label: 'k', kind: 'apikey', secret: 'sk-key' });
    expect(base).toEqual(copy);
  });
});

describe('agentArgs', () => {
  it('runs the API key in bare mode with the Adobe connectors passed in', () => {
    expect(agentArgs(['-p'], { label: 'k', kind: 'apikey', secret: 'x' }, 'C:\\job\\mcp.json')).toEqual(['--bare', '--mcp-config', 'C:\\job\\mcp.json', '-p']);
    expect(agentArgs(['-p'], LOGIN, 'C:\\job\\mcp.json')).toEqual(['-p']);
  });
});

describe('mcpServersFor / bareSkillNote', () => {
  it('keeps only the photoshop, illustrator and design-assets connectors', () => {
    const assets = { command: 'node.exe', args: ['server.mjs', '--save-root', 'D:\jobs'] };
    const text = JSON.stringify({ mcpServers: { photoshop: { type: 'stdio', command: 'ps.exe', args: ['mcp'] }, gmail: { command: 'x' }, illustrator: { command: 'ai.exe', args: [] }, 'design-assets': assets } });
    expect(mcpServersFor(text)).toEqual({ mcpServers: { photoshop: { type: 'stdio', command: 'ps.exe', args: ['mcp'] }, illustrator: { command: 'ai.exe', args: [] }, 'design-assets': assets } });
    expect(mcpServersFor('{bad')).toEqual({ mcpServers: {} });
  });

  it('tells a bare-mode agent where each skill file is', () => {
    expect(bareSkillNote([{ name: 'a-skill', file: 'C:\\s\\a-skill\\SKILL.md' }])).toMatch(/a-skill.*C:\\s\\a-skill\\SKILL\.md/);
    expect(bareSkillNote([])).toBe('');
  });
});

describe('accountsSummary', () => {
  it('says nothing extra with one account, and lists the order with more', () => {
    expect(accountsSummary([LOGIN])).toBe('');
    expect(accountsSummary(agentAccounts({ LUMORA_CLAUDE_TOKEN_2: 't', LUMORA_ANTHROPIC_API_KEY: 'k' }))).toBe(
      'If an account runs out, the next one is used: this computer’s Claude login → backup Claude account 2 → Anthropic API key.',
    );
  });
});

describe('accountProblem', () => {
  it('spots usage limits and sign-in failures, and nothing else', () => {
    expect(accountProblem('You’ve hit your 5-hour limit · resets 7:30pm (Asia/Karachi)')).toBe('limit');
    expect(accountProblem("You've hit your weekly limit")).toBe('limit');
    expect(accountProblem('Failed to authenticate. API Error: 401 OAuth access token is invalid.')).toBe('auth');
    expect(accountProblem('Invalid API key · Fix external API key')).toBe('auth');
    expect(accountProblem('Credit balance is too low')).toBe('limit');
    expect(accountProblem('Photoshop crashed')).toBeNull();
    expect(accountProblem('')).toBeNull();
  });
});

describe('runWithFallback', () => {
  const accounts = agentAccounts({ LUMORA_CLAUDE_TOKEN_2: 't', LUMORA_ANTHROPIC_API_KEY: 'k' });

  it('stops at the first account that works', async () => {
    const seen: string[] = [];
    const r = await runWithFallback(accounts, async (a) => (seen.push(a.kind), { problem: null, value: 0 }));
    expect(seen).toEqual(['login']);
    expect(r).toMatchObject({ value: 0, account: accounts[0], tried: ['This computer’s Claude login'] });
  });

  it('moves to the next account when one is out of usage or cannot sign in', async () => {
    const problems = ['limit', 'auth', null] as const;
    const r = await runWithFallback(accounts, async (_a, i) => ({ problem: problems[i], value: i }));
    expect(r.value).toBe(2);
    expect(r.account.kind).toBe('apikey');
    expect(r.tried).toHaveLength(3);
  });

  it('does not retry a drawing failure on another account', async () => {
    const seen: number[] = [];
    const r = await runWithFallback(accounts, async (_a, i) => (seen.push(i), { problem: null, value: 1 }));
    expect(seen).toEqual([0]);
    expect(r.value).toBe(1);
  });

  it('returns the last attempt when every account is out', async () => {
    const r = await runWithFallback(accounts, async (_a, i) => ({ problem: 'limit' as const, value: i }));
    expect(r.value).toBe(2);
    expect(r.tried).toHaveLength(3);
    expect(r.exhausted).toBe(true);
  });
});
