import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const workflow = Bun.YAML.parse(readFileSync(
  new URL('../.github/workflows/miaomiao-preview.yml', import.meta.url), 'utf8',
)) as any;
const script = workflow.jobs.source.steps[0].with.script;
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github', 'context', 'core', script,
);

async function run({ prChanges = {}, eventChanges = {}, mergeResult = {}, mergeError = null }:
  { prChanges?: any; eventChanges?: any; mergeResult?: any; mergeError?: Error | null } = {}) {
  const pr = {
    number: 123,
    user: { login: 'Roomen' },
    base: { ref: 'miaomiao', repo: { full_name: 'router-for-me/EasyCLIProxyAPI' } },
    head: { sha: 'a'.repeat(40) },
    state: 'open',
    draft: false,
    ...prChanges,
  };
  const context = {
    repo: { owner: 'router-for-me', repo: 'EasyCLIProxyAPI' },
    eventName: 'pull_request_target',
    ref: 'refs/heads/miaomiao',
    sha: 'c'.repeat(40),
    payload: { pull_request: { number: 123, head: { sha: 'a'.repeat(40) } } },
    ...eventChanges,
  };
  const merges: any[] = [];
  const outputs: Record<string, string> = {};
  const github = { rest: { pulls: {
    get: async () => ({ data: pr }),
    merge: async (request: any) => {
      merges.push(request);
      if (mergeError) throw mergeError;
      return { data: { merged: true, sha: 'b'.repeat(40), ...mergeResult } };
    },
  } } };
  const summary = { addRaw: () => summary, write: async () => {} };
  const core = {
    info: () => {}, summary,
    setOutput: (name: string, value: string) => { outputs[name] = value; },
  };
  let error: unknown;
  try { await execute(github, context, core); } catch (caught) { error = caught; }
  return { merges, outputs, error };
}

describe('miaomiao automatic merge', () => {
  test('merges the checked head and builds the resulting merge commit', async () => {
    const result = await run();
    expect(result.error).toBeUndefined();
    expect(result.merges).toEqual([{
      owner: 'router-for-me', repo: 'EasyCLIProxyAPI', pull_number: 123,
      sha: 'a'.repeat(40), merge_method: 'merge',
    }]);
    expect(result.outputs.sha).toBe('b'.repeat(40));
  });

  for (const [name, prChanges] of [
    ['another author', { user: { login: 'someone-else' } }],
    ['draft', { draft: true }],
    ['closed', { state: 'closed' }],
    ['retargeted PR', { base: { ref: 'dev' } }],
    ['wrong repository', { base: { ref: 'miaomiao', repo: { full_name: 'other/repo' } } }],
    ['newer head than event', { head: { sha: 'd'.repeat(40) } }],
  ] as const) {
    test(`skips ${name}`, async () => {
      const result = await run({ prChanges });
      expect(result.error).toBeUndefined();
      expect(result.merges).toHaveLength(0);
      expect(result.outputs).toEqual({});
    });
  }

  test('does not build an unsuccessful merge', async () => {
    const result = await run({ mergeResult: { merged: false, message: 'Conflict' } });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.outputs).toEqual({});
  });

  test('does not bypass protection or retry a changed head', async () => {
    const error = new Error('409: Head branch was modified');
    const result = await run({ mergeError: error });
    expect(result.error).toBe(error);
    expect(result.merges).toHaveLength(1);
    expect(result.outputs).toEqual({});
  });

  test('builds direct pushes without attempting a PR merge', async () => {
    const result = await run({ eventChanges: { eventName: 'push' } });
    expect(result.outputs.sha).toBe('c'.repeat(40));
    expect(result.merges).toHaveLength(0);
  });

  for (const eventChanges of [
    { eventName: 'push', ref: 'refs/heads/dev' },
    { eventName: 'push', payload: { deleted: true } },
  ]) {
    test(`ignores non-buildable push ${JSON.stringify(eventChanges)}`, async () => {
      const result = await run({ eventChanges });
      expect(result.outputs).toEqual({});
      expect(result.merges).toHaveLength(0);
    });
  }
});
