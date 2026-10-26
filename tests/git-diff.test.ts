import { describe, it, expect } from 'vitest';
import { parseDiffOutput } from '../src/utils/git.js';
import { HOOK_SCRIPT, HOOK_MARKER } from '../src/hooks/git-hook.js';

describe('Git Diff and Pre-commit Hooks', () => {
  it('parses unified git diff correctly', () => {
    const rawDiff = `diff --git a/src/config.ts b/src/config.ts
index 83a0e..91df1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@ export const port = 3000;
 export const host = "localhost";
+export const apiKey = "sk-proj-FAKEKEY12345678901234567890";
`;

    const parsed = parseDiffOutput(rawDiff);
    expect(parsed.length).toBe(1);
    expect(parsed[0].filePath).toBe('src/config.ts');
    expect(parsed[0].additions.length).toBe(1);
    expect(parsed[0].additions[0].line).toBe(11);
    expect(parsed[0].additions[0].content).toContain('export const apiKey');
  });

  it('hook script contains proper marker and safe bypass mechanism', () => {
    expect(HOOK_SCRIPT).toContain(HOOK_MARKER);
    expect(HOOK_SCRIPT).toContain('AGENT_LEAK_ALLOW=1');
    expect(HOOK_SCRIPT).toContain('agent-leak diff --staged-only');
  });
});
