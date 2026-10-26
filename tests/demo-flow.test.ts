import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { scanGitDiff } from '../src/scanners/git-diff-scanner.js';
import { installHook } from '../src/hooks/git-hook.js';

describe('Demo Lifecycle & Verification Flow (Phase 3)', () => {
  let tempRepo: string;

  beforeAll(() => {
    tempRepo = mkdtempSync(resolve(tmpdir(), 'agent-leak-demo-'));
    execFileSync('git', ['init'], { cwd: tempRepo, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Demo User'], { cwd: tempRepo, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'demo@example.local'], { cwd: tempRepo, stdio: 'ignore' });
  });

  afterAll(() => {
    try {
      rmSync(tempRepo, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('Step 1 & 2: Detects and masks fake secret in staged changes', async () => {
    const vulnerableFile = resolve(tempRepo, 'app.ts');
    const fakeSecret = 'sk-proj-DEMOFAKEKEY99887766554433221100aaabbbccc';
    writeFileSync(vulnerableFile, `export const apiKey = "${fakeSecret}";\n`);

    execFileSync('git', ['add', 'app.ts'], { cwd: tempRepo, stdio: 'ignore' });

    // Run diff scan
    const result = await scanGitDiff(tempRepo, { stagedOnly: true });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.hasExceededThreshold).toBe(true);

    const secretFinding = result.findings.find((f) => f.id === 'sec-openai-key');
    expect(secretFinding).toBeDefined();
    expect(secretFinding?.maskedValue).not.toContain(fakeSecret);
    expect(secretFinding?.maskedValue).toContain('sk-proj');
  });

  it('Step 3: Pre-commit hook installs properly in repo', () => {
    const hookResult = installHook(tempRepo);
    expect(hookResult.success).toBe(true);
  });

  it('Step 4 & 5: Removing fake secret passes verification cleanly', async () => {
    const cleanFile = resolve(tempRepo, 'app.ts');
    // Refactor to environment variable
    writeFileSync(cleanFile, 'export const apiKey = process.env.OPENAI_API_KEY;\n');

    execFileSync('git', ['add', 'app.ts'], { cwd: tempRepo, stdio: 'ignore' });

    // Run verification on staged changes
    const verifyResult = await scanGitDiff(tempRepo, { stagedOnly: true });

    expect(verifyResult.findings.length).toBe(0);
    expect(verifyResult.hasExceededThreshold).toBe(false);
  });
});
